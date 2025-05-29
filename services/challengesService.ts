import { supabase } from '@/lib/supabase';
import { Challenge } from '@/types';
import { statsService } from './statsService';

// Görevler servisleri

export const challengesService = {
  // Tüm meydan okumaları getir
  getAllChallenges: async () => {
    try {
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching challenges:', error);
        return [];
      }

      return data as Challenge[];
    } catch (error) {
      console.error('Error in getAllChallenges:', error);
      return [];
    }
  },

  // Bir meydan okumayı ID ile getir
  getChallengeById: async (challengeId: string) => {
    try {
      // Meydan okumayı getir
      const { data: challengeData, error: challengeError } = await supabase
        .from('challenges')
        .select('*')
        .eq('id', challengeId)
        .single();

      if (challengeError) {
        console.error(`Error fetching challenge (${challengeId}):`, challengeError);
        return null;
      }

      // Meydan okumanın gereksinimlerini getir
      const { data: requirementsData, error: requirementsError } = await supabase
        .from('challenge_requirements')
        .select('*')
        .eq('challenge_id', challengeId);

      if (requirementsError) {
        console.error(`Error fetching challenge requirements (${challengeId}):`, requirementsError);
      } else {
        challengeData.requirements = requirementsData;
      }

      return challengeData as Challenge;
    } catch (error) {
      console.error('Error in getChallengeById:', error);
      return null;
    }
  },

  // Kullanıcının meydan okumalarını getir
  getUserChallenges: async (userId: string) => {
    try {
      // Kullanıcının katıldığı meydan okumaları getir
      const { data: userChallengeData, error: userChallengeError } = await supabase
        .from('user_challenges')
        .select('*, challenge:challenges(*)')
        .eq('user_id', userId);

      if (userChallengeError) {
        console.error(`Error fetching user challenges (${userId}):`, userChallengeError);
        return [];
      }

      // Her meydan okumanın gereksinimlerini getir
      const enhancedChallenges = await Promise.all(
        userChallengeData.map(async (userChallenge) => {
          const { data: requirements, error: reqError } = await supabase
            .from('challenge_requirements')
            .select('*')
            .eq('challenge_id', userChallenge.challenge_id);

          if (reqError) {
            console.error(`Error fetching challenge requirements (${userChallenge.challenge_id}):`, reqError);
          } else {
            // Her bir gereksinim için ilerleme durumunu getir
            const enhancedRequirements = await Promise.all(
              requirements.map(async (req) => {
                const { data: progress, error: progError } = await supabase
                  .from('user_challenge_requirement_progress')
                  .select('*')
                  .eq('user_challenge_id', userChallenge.id)
                  .eq('requirement_id', req.id)
                  .maybeSingle();

                if (progError && progError.code !== 'PGRST116') {
                  console.error(`Error fetching requirement progress:`, progError);
                }

                return {
                  ...req,
                  progress: progress?.current_count || 0,
                  is_completed: progress?.completed || false
                };
              })
            );

            userChallenge.challenge.requirements = enhancedRequirements;
          }

          return {
            ...userChallenge.challenge,
            user_challenge_id: userChallenge.id,
            progress: userChallenge.progress,
            progress_percentage: userChallenge.progress_percentage,
            completed: userChallenge.completed,
            joined_at: userChallenge.joined_at
          };
        })
      );

      return enhancedChallenges;
    } catch (error) {
      console.error('Error in getUserChallenges:', error);
      return [];
    }
  },

  // Meydan okuma detaylarını getir
  getChallengeDetails: async (challengeId: string, userId?: string) => {
    try {
      const { data: challengeData, error: challengeError } = await supabase
        .from('challenges')
        .select(`
          *,
          requirements:challenge_requirements(*)
        `)
        .eq('id', challengeId)
        .single();

      if (challengeError) {
        console.error('Error fetching challenge details:', challengeError.message);
        return null;
      }

      let requirements = challengeData.requirements || [];

      // Fetch user-specific progress if userId is provided
      if (userId && requirements.length > 0) {
        // 1. Get the user_challenge record to find the user_challenge_id
        const { data: userChallengeData, error: userChallengeError } = await supabase
          .from('user_challenges')
          .select('id') // We only need the id of the user_challenges record
          .eq('user_id', userId)
          .eq('challenge_id', challengeId)
          .maybeSingle();

        if (userChallengeError) {
          console.error('Error fetching user_challenge record:', userChallengeError.message);
          // Proceed without progress if this fails, or handle error as critical
        }

        if (userChallengeData) {
          const userChallengeId = userChallengeData.id;
          // 2. Fetch all progress for these requirements for this user_challenge_id
          const { data: progressData, error: progressError } = await supabase
            .from('user_challenge_requirement_progress')
            .select('requirement_id, completed, current_count')
            .eq('user_challenge_id', userChallengeId);

          if (progressError) {
            console.error('Error fetching requirement progress:', progressError.message);
          } else if (progressData && progressData.length > 0) {
            // 3. Merge progress into requirements
            requirements = requirements.map(req => {
              const userProgress = progressData.find(p => p.requirement_id === req.id);
              return {
                ...req,
                is_completed: userProgress?.completed || false,
                current_count: userProgress?.current_count || 0,
              };
            });
          }
        } else {
          // No participation record, so all requirements are not started for this user
           requirements = requirements.map(req => ({
            ...req,
            is_completed: false,
            current_count: 0,
          }));
        }
      }


      // Katılımcı sayısını getir (genel katılım)
      const { count: participationCount, error: countError } = await supabase
        .from('user_challenges')
        .select('*', { count: 'exact', head: true })
        .eq('challenge_id', challengeId);

      if (countError) {
        console.warn('Error fetching participation count:', countError.message);
      }
      
      challengeData.participation_count = participationCount || 0;
      challengeData.requirements = requirements; // Assign potentially augmented requirements

      return challengeData as Challenge;

    } catch (error) {
      console.error('Error in getChallengeDetails:', error);
      return null;
    }
  },

  // Günün meydan okumasını getir
  getDailyChallenge: async () => {
    const today = new Date().toISOString().split('T')[0];

    // .single() yerine .maybeSingle() kullanarak, sonuç bulunamadığında hata olmadan null dönmesini sağla
    const { data, error } = await supabase
      .from('challenges')
      .select(`
        *,
        requirements:challenge_requirements(*)
      `)
      .eq('is_daily', true)
      .gte('valid_until', today)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Error fetching daily challenge:', error);
      return null;
    }

    if (!data) return null;

    return {
      ...data,
      requirements: data.requirements || []
    };
  },

  // Belirli bir kategorideki görevleri getir
  getChallengesByCategory: async (category: string) => {
    const { data, error } = await supabase
      .from('challenges')
      .select(`
        *,
        requirements:challenge_requirements(*)
      `)
      .eq('category', category)
      .order('created_at', { ascending: false });

    if (error) {
      console.error(`Error fetching challenges for category ${category}:`, error);
      return [];
    }

    return data.map(challenge => ({
      ...challenge,
      requirements: challenge.requirements || []
    }));
  },

  // Kullanıcının ilgisini çekebilecek görevleri getir
  getRecommendedChallenges: async (userId: string) => {
    // Kullanıcının ziyaret ettiği yerler & tamamladığı görevler vb. bilgileri toplayarak
    // bu verilere dayalı rastgele görevler öner
    try {
      // Kullanıcının tamamladığı görevlerin kategorilerini öğren
      const { data: completedChallenges } = await supabase
        .from('user_challenges')
        .select(`
          challenge:challenges(id, category)
        `)
        .eq('user_id', userId)
        .eq('completed', true);

      if (!completedChallenges || completedChallenges.length === 0) {
        // Hiç tamamlanmış görev yoksa, rastgele görevler öner
        const { data: randomChallenges } = await supabase
          .from('challenges')
          .select(`
            *,
            requirements:challenge_requirements(*)
          `)
          .limit(5);

        return randomChallenges || [];
      }

      // Favori kategorileri belirle
      const categories = completedChallenges
        .map(c => c.challenge?.category)
        .filter(Boolean);

      // En çok tamamlanan kategoriden görevler getir
      if (categories.length > 0) {
        const favoriteCategory = categories.reduce((acc, curr) => {
          acc[curr] = (acc[curr] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        const topCategory = Object.entries(favoriteCategory)
          .sort((a, b) => b[1] - a[1])[0][0];

        const { data: recommendedChallenges } = await supabase
          .from('challenges')
          .select(`
            *,
            requirements:challenge_requirements(*)
          `)
          .eq('category', topCategory)
          .limit(5);

        return recommendedChallenges || [];
      }

      return [];
    } catch (error) {
      console.error('Error fetching recommended challenges:', error);
      return [];
    }
  },

  // Yeni bir görev oluştur
  createChallenge: async (challengeData: Partial<Challenge>, requirementsData: Partial<ChallengeRequirement>[]) => {
    try {
      // Önce görevi oluştur
      const { data: challenge, error: challengeError } = await supabase
        .from('challenges')
        .insert(challengeData)
        .select()
        .single();

      if (challengeError) throw challengeError;

      if (requirementsData && requirementsData.length > 0) {
        // Görev gereksinimlerini oluştur
        const requirementsWithChallengeId = requirementsData.map(req => ({
          ...req,
          challenge_id: challenge.id
        }));

        const { data: requirements, error: reqError } = await supabase
          .from('challenge_requirements')
          .insert(requirementsWithChallengeId)
          .select();

        if (reqError) {
          console.error('Error creating challenge requirements:', reqError);
        }

        return {
          ...challenge,
          requirements: requirements || []
        };
      }

      return {
        ...challenge,
        requirements: []
      };
    } catch (error) {
      console.error('Error creating challenge:', error);
      throw error;
    }
  },

  // Kullanıcının bir göreve katılmasını sağlar
  joinChallenge: async (userId: string, challengeId: string) => {
    try {
      // Check if user is already participating
      const { data: existingParticipation } = await supabase
        .from('user_challenges')
        .select('id')
        .eq('user_id', userId)
        .eq('challenge_id', challengeId)
        .maybeSingle();

      if (existingParticipation) {
        return existingParticipation.id; // Already joined
      }

      // Join the challenge
      const { data, error } = await supabase
        .from('user_challenges')
        .insert({
          user_id: userId,
          challenge_id: challengeId,
          progress: 0,
          progress_percentage: 0,
          completed: false,
          joined_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (error) {
        console.error('Error joining challenge:', error);
        throw error;
      }

      // Get all requirements for this challenge
      const { data: requirements, error: reqError } = await supabase
        .from('challenge_requirements')
        .select('*')
        .eq('challenge_id', challengeId);

      if (reqError) {
        console.error('Error fetching challenge requirements:', reqError);
      } else if (requirements && requirements.length > 0) {
        // Initialize progress tracking for each requirement
        const progressRecords = requirements.map(req => ({
          user_challenge_id: data.id,
          requirement_id: req.id,
          completed: false,
          current_count: 0
        }));

        const { error: progressError } = await supabase
          .from('user_challenge_requirement_progress')
          .insert(progressRecords);

        if (progressError) {
          console.error('Error initializing requirement progress:', progressError);
        }
      }

      return data.id;
    } catch (error) {
      console.error('Error in joinChallenge:', error);
      throw error;
    }
  },

  // Kullanıcının katılım durumunu kontrol eder
  checkChallengeParticipation: async (challengeId: string, userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_challenges')
        .select('*')
        .eq('challenge_id', challengeId)
        .eq('user_id', userId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        console.error('Error checking challenge participation:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error in checkChallengeParticipation:', error);
      throw error;
    }
  },

  // Kullanıcının görevden ayrılmasını sağlar
  leaveChallenge: async (challengeId: string, userId: string) => {
    try {
      // First, find the user_challenge record
      const { data: userChallenge, error: findError } = await supabase
        .from('user_challenges')
        .select('id')
        .eq('challenge_id', challengeId)
        .eq('user_id', userId)
        .maybeSingle();

      if (findError) {
        console.error('Error finding user challenge:', findError);
        throw findError;
      }

      if (!userChallenge) {
        return false; // Not participating in this challenge
      }

      // Delete progress records first (foreign key constraint)
      const { error: progressDeleteError } = await supabase
        .from('user_challenge_requirement_progress')
        .delete()
        .eq('user_challenge_id', userChallenge.id);

      if (progressDeleteError) {
        console.error('Error deleting requirement progress:', progressDeleteError);
        throw progressDeleteError;
      }

      // Delete the challenge participation
      const { error: deleteError } = await supabase
        .from('user_challenges')
        .delete()
        .eq('id', userChallenge.id);

      if (deleteError) {
        console.error('Error leaving challenge:', deleteError);
        throw deleteError;
      }

      return true;
    } catch (error) {
      console.error('Error in leaveChallenge:', error);
      throw error;
    }
  },

  // Kullanıcının bir meydan okuma gereksinimindeki ilerlemesini günceller
  updateUserChallengeRequirementProgress: async (
    userId: string, 
    challengeId: string, 
    requirementId: string, 
    currentCountIncrement: number = 0, 
    isCompletedOverride?: boolean, 
    completionDetails?: any
  ): Promise<{updatedProgress: any | null, overallChallengeProgress?: { progress: number, progress_percentage: number, completed: boolean }}> => {
    try {
      // 1. Find user_challenge_id
      const { data: userChallenge, error: userChallengeError } = await supabase
        .from('user_challenges')
        .select('id')
        .eq('user_id', userId)
        .eq('challenge_id', challengeId)
        .single();

      if (userChallengeError || !userChallenge) {
        console.error('Error finding user challenge participation or user has not joined:', userChallengeError?.message);
        throw new Error('User has not joined this challenge or an error occurred.');
      }
      const userChallengeId = userChallenge.id;

      // 2. Find or create user_challenge_requirement_progress record
      let { data: progressRecord, error: findProgressError } = await supabase
        .from('user_challenge_requirement_progress')
        .select('*')
        .eq('user_challenge_id', userChallengeId)
        .eq('requirement_id', requirementId)
        .maybeSingle();

      if (findProgressError && findProgressError.code !== 'PGRST116') { // PGRST116: row not found, which is fine
        console.error('Error finding requirement progress:', findProgressError.message);
        throw findProgressError;
      }
      
      // Fetch requirement details to check its 'count' property for completion logic
      const { data: requirementDetails, error: reqDetailsError } = await supabase
        .from('challenge_requirements')
        .select('count, type') // Also fetch type for simple non-countable tasks
        .eq('id', requirementId)
        .single();

      if (reqDetailsError || !requirementDetails) {
        console.error('Error fetching requirement details:', reqDetailsError?.message);
        throw new Error('Could not fetch requirement details.');
      }
      
      const newCurrentCount = (progressRecord?.current_count || 0) + currentCountIncrement;
      let isCompleted = progressRecord?.completed || false;

      if (isCompletedOverride !== undefined) {
        isCompleted = isCompletedOverride;
      } else if (requirementDetails.count && requirementDetails.count > 0) {
        isCompleted = newCurrentCount >= requirementDetails.count;
      } else if (currentCountIncrement > 0) { // For simple non-countable tasks that are completed by any increment
        isCompleted = true; 
      }
      // If no increment and no override, and no count, completion status remains unchanged unless already completed.

      const updateData: any = {
        current_count: newCurrentCount,
        completed: isCompleted,
        completion_details: completionDetails,
      };
      if (isCompleted && !progressRecord?.completed) { // Only set completion_date if it's newly completed
        updateData.completion_date = new Date().toISOString();
      }


      let updatedProgress;
      if (progressRecord) {
        // Update existing progress record
        const { data, error } = await supabase
          .from('user_challenge_requirement_progress')
          .update(updateData)
          .eq('id', progressRecord.id)
          .select()
          .single();
        if (error) throw error;
        updatedProgress = data;
      } else {
        // Create new progress record if it didn't exist
        const { data, error } = await supabase
          .from('user_challenge_requirement_progress')
          .insert({
            user_challenge_id: userChallengeId,
            requirement_id: requirementId,
            ...updateData,
          })
          .select()
          .single();
        if (error) throw error;
        updatedProgress = data;
      }
      
      // Recalculate overall challenge progress
      const overallChallengeProgress = await challengesService.recalculateChallengeProgress(userChallengeId, challengeId);

      return { updatedProgress, overallChallengeProgress };

    } catch (error) {
      console.error('Error in updateUserChallengeRequirementProgress:', error);
      // In a real app, you might want to throw the error or return a more structured error response
      return { updatedProgress: null }; 
    }
  },


  // Meydan okuma ilerlemesini yeniden hesaplar
  recalculateChallengeProgress: async (userChallengeId: string, challengeId: string) => {
    try {
      // Get all requirements for this challenge
      const { data: requirements, error: reqError } = await supabase
        .from('challenge_requirements')
        .select('id, count')
        .eq('challenge_id', challengeId);

      if (reqError) {
        console.error('Error fetching challenge requirements:', reqError);
        throw reqError;
      }

      // Get progress for all requirements
      const { data: progress, error: progressError } = await supabase
        .from('user_challenge_requirement_progress')
        .select('*')
        .eq('user_challenge_id', userChallengeId);

      if (progressError) {
        console.error('Error fetching requirement progress:', progressError);
        throw progressError;
      }

      // Calculate overall progress
      let completedCount = 0;
      let totalRequirements = requirements.length;

      requirements.forEach(req => {
        const reqProgress = progress.find(p => p.requirement_id === req.id);
        if (reqProgress && reqProgress.completed) {
          completedCount++;
        }
      });

      const progressPercentage = totalRequirements > 0
        ? Math.round((completedCount / totalRequirements) * 100)
        : 0;

      const allCompleted = progressPercentage === 100;

      // Update user_challenges record
      const { error: updateError } = await supabase
        .from('user_challenges')
        .update({
          progress: completedCount,
          progress_percentage: progressPercentage,
          completed: allCompleted,
          completion_date: allCompleted ? new Date().toISOString() : null
        })
        .eq('id', userChallengeId);

      if (updateError) {
        console.error('Error updating challenge progress:', updateError);
        throw updateError;
      }

      // If all completed, award points to user
      if (allCompleted) {
        const { data: challenge } = await supabase
          .from('challenges')
          .select('points')
          .eq('id', challengeId)
          .single();

        const { data: userChallenge } = await supabase
          .from('user_challenges')
          .select('user_id')
          .eq('id', userChallengeId)
          .single();

        if (challenge && userChallenge) {
          await statsService.addUserPoints(userChallenge.user_id, challenge.points);
        }
      }

      return { progress: completedCount, progress_percentage: progressPercentage, completed: allCompleted };
    } catch (error) {
      console.error('Error in recalculateChallengeProgress:', error);
      throw error;
    }
  },

  // Gereksinimin tamamlanma durumunu günceller (refactored to use the new function)
  completeRequirement: async (userId: string, challengeId: string, requirementId: string, completionDetails?: any) => {
    try {
       // Fetch requirement details to see if it's a countable task or simple completion
      const { data: requirementInfo, error: reqInfoError } = await supabase
        .from('challenge_requirements')
        .select('count, type')
        .eq('id', requirementId)
        .single();

      if (reqInfoError || !requirementInfo) {
        console.error('Could not fetch requirement info for completion logic:', reqInfoError?.message);
        throw new Error('Requirement details not found.');
      }
      
      // For countable requirements, increment by 1. For others, just mark as complete.
      const increment = (requirementInfo.count && requirementInfo.count > 0) ? 1 : 0;
      const isCompletedOverride = (requirementInfo.count && requirementInfo.count > 0) ? undefined : true;


      return await challengesService.updateUserChallengeRequirementProgress(
        userId,
        challengeId,
        requirementId,
        increment, // Increment count by 1 for countable, 0 for others (will be marked by isCompletedOverride)
        isCompletedOverride, // Override to true for non-countable, otherwise let logic decide
        completionDetails
      );
    } catch (error) {
      console.error('Error in completeRequirement wrapper:', error);
      throw error;
    }
  }
};
