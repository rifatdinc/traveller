import { supabase } from '@/lib/supabase';

// User statistics service
export interface UserStats {
  user_id: string;
  total_points: number;
  level: number;
  visited_places: number;
  checkin_count: number;
  cities_visited: number;
  rank?: number;
}

export const statsService = {
  // Get user statistics
  getUserStats: async (userId: string): Promise<UserStats | null> => {
    try {
      // Ensure the user exists in our database tables
      await supabase.rpc('get_or_create_user', {
        p_user_id: userId,
        p_email: '',  // We might not have the email here
        p_username: null
      });
      
      // First check if user exists in user_stats table
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // If user doesn't have stats yet, create a new record
        if (error.code === 'PGRST116') {
          return await statsService.createUserStats(userId);
        }
        console.error('Error fetching user stats:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserStats:', error);
      return null;
    }
  },

  // Add points to a user and record in points_history
  addUserPoints: async (
    userId: string, 
    points: number,
    details?: { 
      action: string; 
      details?: Record<string, any>
    }
  ) => {
    try {
      // First get the user's current stats
      const stats = await statsService.getUserStats(userId);
      if (!stats) {
        console.error('User stats not found for adding points');
        return false;
      }

      // Calculate new total points
      const currentPoints = stats.total_points || 0;
      const newTotalPoints = currentPoints + points;

      // Calculate level (1 level for every 500 points)
      const newLevel = Math.floor(newTotalPoints / 500) + 1;

      // Update the user stats
      const { error } = await supabase
        .from('user_stats')
        .update({
          total_points: newTotalPoints,
          level: newLevel
        })
        .eq('user_id', userId);

      if (error) {
        console.error('Error updating user points:', error);
        return false;
      }

      // Record the points history
      if (details) {
        const { error: historyError } = await supabase
          .from('points_history')
          .insert({
            user_id: userId,
            points: points,
            action: details.action,
            details: details.details ? JSON.stringify(details.details) : null
          });

        if (historyError) {
          console.error('Error recording points history:', historyError);
        }
      }

      // Check for badges
      await statsService.checkBadgesForPoints(userId, newTotalPoints, newLevel);

      return true;
    } catch (error) {
      console.error('Error in addUserPoints:', error);
      return false;
    }
  },

  // Check for badges based on points and level
  checkBadgesForPoints: async (userId: string, totalPoints: number, level: number) => {
    try {
      // Define badge thresholds
      const pointBadges = [
        { id: 'points_100', name: 'First Steps', threshold: 100, icon: 'baby-carriage' },
        { id: 'points_500', name: 'Traveler Apprentice', threshold: 500, icon: 'shoe-prints' },
        { id: 'points_1000', name: 'Explorer', threshold: 1000, icon: 'compass' },
        { id: 'points_2500', name: 'Adventure Master', threshold: 2500, icon: 'mountain' },
        { id: 'points_5000', name: 'Travel Guru', threshold: 5000, icon: 'globe-europe' }
      ];

      // Level badges
      const levelBadges = [
        { id: 'level_3', name: 'Rising Star', threshold: 3, icon: 'arrow-up' },
        { id: 'level_5', name: 'Expert Traveler', threshold: 5, icon: 'star' },
        { id: 'level_10', name: 'Discovery Master', threshold: 10, icon: 'crown' }
      ];

      // Determine earned badges
      const earnedPointBadges = pointBadges.filter(badge => totalPoints >= badge.threshold);
      const earnedLevelBadges = levelBadges.filter(badge => level >= badge.threshold);
      const allEarnedBadges = [...earnedPointBadges, ...earnedLevelBadges];

      // Get user's existing badges
      const { data: existingBadges, error } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', userId);

      if (error) {
        console.error('Error fetching user badges:', error);
        return;
      }

      const existingBadgeIds = existingBadges.map(b => b.badge_id);

      // Find newly earned badges
      const newBadges = allEarnedBadges.filter(badge => !existingBadgeIds.includes(badge.id));

      for (const badge of newBadges) {
        // First check if badge exists in DB, create if not
        const { data: badgeData, error: badgeError } = await supabase
          .from('badges')
          .select('id')
          .eq('id', badge.id)
          .maybeSingle();

        if (badgeError && badgeError.code !== 'PGRST116') {
          console.error(`Error checking badge ${badge.id}:`, badgeError);
          continue;
        }

        // Create badge if it doesn't exist
        if (!badgeData) {
          await supabase
            .from('badges')
            .insert({
              id: badge.id,
              name: badge.name,
              icon: badge.icon,
              description: `You've earned the ${badge.name} badge!`
            });
        }

        // Assign badge to user
        await supabase
          .from('user_badges')
          .insert({
            user_id: userId,
            badge_id: badge.id,
            earned_at: new Date().toISOString()
          });
      }

      return newBadges;
    } catch (error) {
      console.error('Error in checkBadgesForPoints:', error);
      return [];
    }
  },

  // Create user statistics
  createUserStats: async (userId: string): Promise<UserStats | null> => {
    try {
      // Create a new stats record
      const { data, error } = await supabase
        .from('user_stats')
        .insert({
          user_id: userId,
          total_points: 0,
          level: 1,
          rank: 0,
          visited_places: 0,
          checkin_count: 0,
          cities_visited: 0
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating user stats:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in createUserStats:', error);
      return null;
    }
  },

  // Update visited places count
  updateVisitedPlacesCount: async (userId: string) => {
    try {
      // Get count of visited places
      const { count, error: countError } = await supabase
        .from('user_checkins')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) {
        console.error('Error counting visited places:', countError);
        return false;
      }

      // Update user stats
      const { error: updateError } = await supabase
        .from('user_stats')
        .update({ visited_places: count || 0 })
        .eq('user_id', userId);

      if (updateError) {
        console.error('Error updating visited places count:', updateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateVisitedPlacesCount:', error);
      return false;
    }
  },

  // Get points history for a user
  getPointsHistory: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('points_history')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching points history:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getPointsHistory:', error);
      return [];
    }
  },

  // Get leaderboard
  getLeaderboard: async (limit = 10) => {
    try {
      // First get user stats
      const { data: statsData, error: statsError } = await supabase
        .from('user_stats')
        .select('*')
        .order('total_points', { ascending: false })
        .limit(limit);

      if (statsError) {
        console.error('Error fetching user stats:', statsError);
        return [];
      }

      // Get user details for the found stats
      const leaderboard = await Promise.all(
        statsData.map(async (stats) => {
          try {
            // Try to get from profiles table first
            const { data: profileData, error: profileError } = await supabase
              .from('profiles')
              .select('id, username, avatar_url')
              .eq('user_id', stats.user_id)
              .maybeSingle();
              
            if (!profileError && profileData) {
              return {
                id: stats.user_id,
                username: profileData.username || 'User',
                avatar: profileData.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(profileData.username || 'User')}&background=random&color=fff&size=256`,
                level: `Level ${stats.level || 1}`,
                total_points: stats.total_points || 0
              };
            }
            
            // Try users table if profile not found
            const { data: userData, error: userError } = await supabase
              .from('users')
              .select('id, username, avatar, email')
              .eq('id', stats.user_id)
              .maybeSingle();
            
            if (!userError && userData) {
              return {
                id: stats.user_id,
                username: userData.username || userData.email?.split('@')[0] || 'User',
                avatar: userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.username || 'User')}&background=random&color=fff&size=256`,
                level: `Level ${stats.level || 1}`,
                total_points: stats.total_points || 0
              };
            }
            
            // Fall back to generic user if nothing found
            return {
              id: stats.user_id,
              username: 'User',
              avatar: `https://ui-avatars.com/api/?name=User&background=random&color=fff&size=256`,
              level: `Level ${stats.level || 1}`,
              total_points: stats.total_points || 0
            };
          } catch (error) {
            // Provide a fallback for any unexpected errors
            console.error(`Error fetching user details for leaderboard (${stats.user_id}):`, error);
            return {
              id: stats.user_id,
              username: 'User',
              avatar: `https://ui-avatars.com/api/?name=User&background=random&color=fff&size=256`,
              level: `Level ${stats.level || 1}`,
              total_points: stats.total_points || 0
            };
          }
        })
      );

      // If leaderboard is empty, fill with sample data
      if (leaderboard.length === 0) {
        return await statsService.populateLeaderboard();
      }

      return leaderboard;
    } catch (error) {
      console.error('Error in getLeaderboard:', error);
      return [];
    }
  },

  // Populate leaderboard with sample data
  populateLeaderboard: async () => {
    try {
      // Sample user data
      const demoUsers = [
        { username: 'AdventureSeeker', points: 3560, level: 6 },
        { username: 'WorldExplorer', points: 2890, level: 5 },
        { username: 'TravelMaster', points: 2450, level: 4 },
        { username: 'GlobalNomad', points: 1975, level: 3 },
        { username: 'Wanderlust', points: 1680, level: 3 }
      ];

      const leaderboard = demoUsers.map((user, index) => ({
        id: `demo-${index}`,
        username: user.username,
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.username)}&background=random&color=fff&size=256`,
        level: `Level ${user.level}`,
        total_points: user.points
      }));

      return leaderboard;
    } catch (error) {
      console.error('Error in populateLeaderboard:', error);
      return [];
    }
  },

  // Update all user stats from check-ins
  updateUserStatsFromCheckins: async (userId: string) => {
    try {
      // Call the Supabase function to update user stats
      const { error } = await supabase.rpc('update_user_stats_from_checkins', {
        p_user_id: userId
      });

      if (error) {
        console.error('Error updating user stats from check-ins:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in updateUserStatsFromCheckins:', error);
      return false;
    }
  }
};
