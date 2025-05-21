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

  // Gereksinim ilerlemesini günceller
  updateRequirementProgress: async (userChallengeId: string, requirementId: string, progress: number, completed: boolean = false) => {
    try {
      // Update the specific requirement progress
      const { data, error } = await supabase
        .from('user_challenge_requirement_progress')
        .update({
          current_count: progress,
          completed: completed,
          completion_date: completed ? new Date().toISOString() : null
        })
        .eq('user_challenge_id', userChallengeId)
        .eq('requirement_id', requirementId)
        .select()
        .single();

      if (error) {
        console.error('Error updating requirement progress:', error);
        throw error;
      }

      // Get the user_challenge record
      const { data: userChallenge, error: userChallengeError } = await supabase
        .from('user_challenges')
        .select('challenge_id')
        .eq('id', userChallengeId)
        .single();

      if (userChallengeError) {
        console.error('Error fetching user challenge:', userChallengeError);
        throw userChallengeError;
      }

      // Update overall challenge progress
      await challengesService.recalculateChallengeProgress(userChallengeId, userChallenge.challenge_id);

      return data;
    } catch (error) {
      console.error('Error in updateRequirementProgress:', error);
      throw error;
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

  // Gereksinimin tamamlanma durumunu günceller
  completeRequirement: async (userId: string, challengeId: string, requirementId: string) => {
    try {
      // Get the user_challenge record
      const { data: userChallenge, error: userChallengeError } = await supabase
        .from('user_challenges')
        .select('id')
        .eq('user_id', userId)
        .eq('challenge_id', challengeId)
        .maybeSingle();

      if (userChallengeError) {
        console.error('Error fetching user challenge:', userChallengeError);
        throw userChallengeError;
      }

      if (!userChallenge) {
        throw new Error('User is not participating in this challenge');
      }

      // Get the requirement details
      const { data: requirement, error: reqError } = await supabase
        .from('challenge_requirements')
        .select('count')
        .eq('id', requirementId)
        .single();

      if (reqError) {
        console.error('Error fetching requirement:', reqError);
        throw reqError;
      }

      // Get current progress
      const { data: progress, error: progressError } = await supabase
        .from('user_challenge_requirement_progress')
        .select('current_count')
        .eq('user_challenge_id', userChallenge.id)
        .eq('requirement_id', requirementId)
        .single();

      if (progressError) {
        console.error('Error fetching requirement progress:', progressError);
        throw progressError;
      }

      // Increment the progress count
      const newCount = (progress.current_count || 0) + 1;
      const isCompleted = newCount >= (requirement.count || 1);

      // Update the progress
      return await challengesService.updateRequirementProgress(
        userChallenge.id,
        requirementId,
        newCount,
        isCompleted
      );
    } catch (error) {
      console.error('Error in completeRequirement:', error);
      throw error;
    }
  }
};
