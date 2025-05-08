import { supabase } from '@/lib/supabase';
import { statsService } from './statsService';

export interface CheckIn {
  id: string;
  user_id: string;
  place_id: string;
  created_at: string;
  notes?: string;
  photos?: string[];
  location?: {
    latitude: number;
    longitude: number;
  };
}

export const checkinService = {
  /**
   * Creates a new check-in for a user at a specific place
   */
  checkInToPlace: async (
    userId: string,
    placeId: string,
    options?: {
      notes?: string;
      photos?: string[];
      location?: { latitude: number; longitude: number };
    }
  ): Promise<CheckIn | null> => {
    try {
      // Create the check-in record
      const checkInData = {
        user_id: userId,
        place_id: placeId,
        notes: options?.notes || null,
        photos: options?.photos || null,
        location: options?.location ? JSON.stringify(options.location) : null,
      };

      const { data, error } = await supabase
        .from('user_checkins')
        .insert([checkInData])
        .select()
        .single();

      if (error) {
        console.error('Error creating check-in:', error);
        return null;
      }

      // Increment the place's visit count
      await supabase.rpc('increment_place_visit_count', {
        p_place_id: placeId,
      });

      // Get place details to award points
      const { data: placeData, error: placeError } = await supabase
        .from('places')
        .select('points, type, city')
        .eq('id', placeId)
        .single();

      if (!placeError && placeData) {
        const points = placeData.points || 10; // Default 10 points if not specified
        
        // Award points to the user
        await statsService.addUserPoints(userId, points, {
          action: 'check_in',
          details: {
            place_id: placeId,
            place_type: placeData.type,
            city: placeData.city,
          },
        });
        
        // Check if this has completed any challenges
        await checkinService.checkChallengesCompletion(userId, placeId, placeData.type, placeData.city);
      }

      return data;
    } catch (error) {
      console.error('Error in checkInToPlace:', error);
      return null;
    }
  },

  /**
   * Get all check-ins for a specific user
   */
  getUserCheckIns: async (userId: string): Promise<CheckIn[]> => {
    try {
      const { data, error } = await supabase
        .from('user_checkins')
        .select('*, places:place_id(*)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching user check-ins:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getUserCheckIns:', error);
      return [];
    }
  },

  /**
   * Check if a user has already checked in to a place
   */
  hasUserCheckedIn: async (userId: string, placeId: string): Promise<boolean> => {
    try {
      const { count, error } = await supabase
        .from('user_checkins')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('place_id', placeId);

      if (error) {
        console.error('Error checking if user checked in:', error);
        return false;
      }

      return count !== null && count > 0;
    } catch (error) {
      console.error('Error in hasUserCheckedIn:', error);
      return false;
    }
  },

  /**
   * Get check-in statistics for a user
   */
  getUserCheckInStats: async (userId: string) => {
    try {
      // Total check-ins
      const { count: totalCheckIns, error: countError } = await supabase
        .from('user_checkins')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) {
        console.error('Error getting check-in count:', countError);
      }

      // Unique cities visited
      const { data: cities, error: citiesError } = await supabase
        .from('user_checkins')
        .select('places:place_id(city)')
        .eq('user_id', userId);

      if (citiesError) {
        console.error('Error getting cities:', citiesError);
      }

      // Type assertion to specify the expected structure
      const typedCities = cities as { places: { city: string } }[] | null;
      const uniqueCities = typedCities 
        ? new Set(typedCities.map(c => c.places?.city).filter(Boolean)).size 
        : 0;

      // Get place types visited
      const { data: placeTypes, error: typesError } = await supabase
        .from('user_checkins')
        .select('places:place_id(type)')
        .eq('user_id', userId);

      if (typesError) {
        console.error('Error getting place types:', typesError);
      }

      // Type assertion to specify the expected structure
      const typedPlaceTypes = placeTypes as { places: { type: string } }[] | null;
      const placeTypeCount = typedPlaceTypes 
        ? typedPlaceTypes.reduce((acc, item) => {
            const type = item.places?.type;
            if (type) {
              acc[type] = (acc[type] || 0) + 1;
            }
            return acc;
          }, {} as Record<string, number>)
        : {};

      return {
        totalCheckIns: totalCheckIns || 0,
        uniqueCities,
        placeTypeCount,
      };
    } catch (error) {
      console.error('Error in getUserCheckInStats:', error);
      return {
        totalCheckIns: 0,
        uniqueCities: 0,
        placeTypeCount: {},
      };
    }
  },

  /**
   * Check if any challenges are completed with this check-in
   */
  checkChallengesCompletion: async (
    userId: string, 
    placeId: string, 
    placeType?: string,
    city?: string
  ) => {
    try {
      // Get active challenges for the user
      const { data: activeChallenges, error: challengesError } = await supabase
        .from('user_challenges')
        .select('*, challenge:challenge_id(*)')
        .eq('user_id', userId)
        .eq('status', 'active');

      if (challengesError || !activeChallenges) {
        console.error('Error fetching active challenges:', challengesError);
        return;
      }

      for (const userChallenge of activeChallenges) {
        const challenge = userChallenge.challenge;
        if (!challenge) continue;

        // Get the challenge requirements
        const { data: requirements, error: reqError } = await supabase
          .from('challenge_requirements')
          .select('*')
          .eq('challenge_id', challenge.id);

        if (reqError || !requirements) {
          console.error('Error fetching challenge requirements:', reqError);
          continue;
        }

        // Check if this check-in contributes to any requirement
        let requirementsMet = true;
        for (const req of requirements) {
          // Check if this checkin satisfies a specific place requirement
          if (req.place_id && req.place_id === placeId) {
            // Mark this requirement as completed
            await supabase
              .from('user_challenge_progress')
              .upsert({
                user_id: userId,
                challenge_id: challenge.id,
                requirement_id: req.id,
                completed: true,
                completed_at: new Date().toISOString(),
              });
            continue;
          }

          // Check if this checkin satisfies a place type requirement
          if (req.place_type && req.place_type === placeType) {
            // Get number of checkins for this type
            const placesWithType = await supabase
              .from('places')
              .select('id')
              .eq('type', req.place_type);
              
            if (placesWithType.error) {
              console.error('Error getting places by type:', placesWithType.error);
              requirementsMet = false;
              continue;
            }
            
            const placeIds = placesWithType.data.map(place => place.id);
            
            const { count, error: countError } = await supabase
              .from('user_checkins')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', userId)
              .in('place_id', placeIds);

            if (!countError && count !== null && count >= (req.count || 1)) {
              // Mark this requirement as completed
              await supabase
                .from('user_challenge_progress')
                .upsert({
                  user_id: userId,
                  challenge_id: challenge.id,
                  requirement_id: req.id,
                  completed: true,
                  completed_at: new Date().toISOString(),
                });
            } else {
              requirementsMet = false;
            }
          }

          // Check if this checkin satisfies a city requirement
          if (req.city && req.city === city) {
            // Get number of checkins for this city
            const placesInCity = await supabase
              .from('places')
              .select('id')
              .eq('city', req.city);
              
            if (placesInCity.error) {
              console.error('Error getting places by city:', placesInCity.error);
              requirementsMet = false;
              continue;
            }
            
            const cityPlaceIds = placesInCity.data.map(place => place.id);
            
            const { count, error: countError } = await supabase
              .from('user_checkins')
              .select('*', { count: 'exact', head: true })
              .eq('user_id', userId)
              .in('place_id', cityPlaceIds);

            if (!countError && count !== null && count >= (req.count || 1)) {
              // Mark this requirement as completed
              await supabase
                .from('user_challenge_progress')
                .upsert({
                  user_id: userId,
                  challenge_id: challenge.id,
                  requirement_id: req.id,
                  completed: true,
                  completed_at: new Date().toISOString(),
                });
            } else {
              requirementsMet = false;
            }
          }

          // Check all other requirements to see if they're already completed
          const { data: progress, error: progressError } = await supabase
            .from('user_challenge_progress')
            .select('*')
            .eq('user_id', userId)
            .eq('challenge_id', challenge.id)
            .eq('requirement_id', req.id)
            .single();

          if (!progressError && (!progress || !progress.completed)) {
            requirementsMet = false;
          }
        }

        // If all requirements are met, mark the challenge as completed
        if (requirementsMet) {
          await supabase
            .from('user_challenges')
            .update({
              status: 'completed',
              completed_at: new Date().toISOString()
            })
            .eq('id', userChallenge.id);

          // Award points for completing the challenge
          if (challenge.points) {
            await statsService.addUserPoints(userId, challenge.points, {
              action: 'challenge_complete',
              details: {
                challenge_id: challenge.id,
                challenge_name: challenge.name,
              },
            });
          }
        }
      }
    } catch (error) {
      console.error('Error in checkChallengesCompletion:', error);
    }
  }
};
