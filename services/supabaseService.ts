import { supabase } from '@/lib/supabase';
import { User, Place, Challenge, FeedPost, Plan, TripPlan, InterestTag } from '@/types';
import { feedPosts } from '@/constants/MockData';

// Refresh Supabase client to update schema cache
export const refreshSupabaseClient = async () => {
  try {
    // Force a refresh of the schema cache by making a simple query
    await supabase.from('trip_plans').select('id').limit(1);
    console.log('Schema cache refreshed');
    return true;
  } catch (error) {
    console.error('Error refreshing schema cache:', error);
    return false;
  }
};

// Tarih formatlamak için yardımcı fonksiyon
const formatTimestamp = (dateString: string): string => {
  if (!dateString) return '';
  
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  
  if (diffMin < 60) {
    return `${diffMin} dakika önce`;
  } else if (diffMin < 1440) {
    const hours = Math.floor(diffMin / 60);
    return `${hours} saat önce`;
  } else {
    const days = Math.floor(diffMin / 1440);
    return `${days} gün önce`;
  }
};

// Kullanıcı istatistikleri servisleri
export const statsService = {
  // Kullanıcı istatistiklerini getir
  getUserStats: async (userId: string) => {
    try {
      // İlk olarak user_stats tablosunda kullanıcı var mı kontrol et
      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('user_id', userId)
        .single();
      
      if (error) {
        // Eğer kullanıcının istatistikleri yoksa, yeni bir kayıt oluştur
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
  
  // Kullanıcının puanlarını artır
  addUserPoints: async (userId: string, points: number) => {
    try {
      // Önce kullanıcının mevcut istatistiklerini getir
      const stats = await statsService.getUserStats(userId);
      if (!stats) {
        console.error('User stats not found for adding points');
        return false;
      }
      
      // Yeni toplam puanı hesapla
      const currentPoints = stats.total_points || 0;
      const newTotalPoints = currentPoints + points;
      
      // Seviye hesapla (her 500 puan için 1 seviye)
      const newLevel = Math.floor(newTotalPoints / 500) + 1;
      
      // İstatistikleri güncelle
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
      
      // Rozetler için kontrol
      await statsService.checkBadgesForPoints(userId, newTotalPoints, newLevel);
      
      return true;
    } catch (error) {
      console.error('Error in addUserPoints:', error);
      return false;
    }
  },
  
  // Puan bazlı rozet kontrolleri
  checkBadgesForPoints: async (userId: string, totalPoints: number, level: number) => {
    try {
      // Belirli puan eşiklerine göre rozetleri kontrol et
      const pointBadges = [
        { id: 'points_100', name: 'İlk Adımlar', threshold: 100, icon: 'baby-carriage' },
        { id: 'points_500', name: 'Gezgin Çırak', threshold: 500, icon: 'shoe-prints' },
        { id: 'points_1000', name: 'Keşifçi', threshold: 1000, icon: 'compass' },
        { id: 'points_2500', name: 'Macera Ustası', threshold: 2500, icon: 'mountain' },
        { id: 'points_5000', name: 'Seyahat Gurusu', threshold: 5000, icon: 'globe-europe' }
      ];
      
      // Seviye rozetleri
      const levelBadges = [
        { id: 'level_3', name: 'Yükseliş', threshold: 3, icon: 'arrow-up' },
        { id: 'level_5', name: 'Uzman Gezgin', threshold: 5, icon: 'star' },
        { id: 'level_10', name: 'Keşif Üstadı', threshold: 10, icon: 'crown' }
      ];
      
      // Hak kazanılan rozetleri belirle
      const earnedPointBadges = pointBadges.filter(badge => totalPoints >= badge.threshold);
      const earnedLevelBadges = levelBadges.filter(badge => level >= badge.threshold);
      const allEarnedBadges = [...earnedPointBadges, ...earnedLevelBadges];
      
      // Kullanıcının mevcut rozetlerini getir
      const { data: existingBadges, error } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', userId);
        
      if (error) {
        console.error('Error fetching user badges:', error);
        return;
      }
      
      const existingBadgeIds = existingBadges.map(b => b.badge_id);
      
      // Yeni kazanılan rozetleri bul
      const newBadges = allEarnedBadges.filter(badge => !existingBadgeIds.includes(badge.id));
      
      for (const badge of newBadges) {
        // Önce rozet DB'de var mı kontrol et, yoksa oluştur
        const { data: badgeData, error: badgeError } = await supabase
          .from('badges')
          .select('id')
          .eq('id', badge.id)
          .maybeSingle();
          
        if (badgeError && badgeError.code !== 'PGRST116') {
          console.error(`Error checking badge ${badge.id}:`, badgeError);
          continue;
        }
        
        // Rozet yoksa oluştur
        if (!badgeData) {
          await supabase
            .from('badges')
            .insert({
              id: badge.id,
              name: badge.name,
              icon: badge.icon,
              description: `${badge.name} rozetini kazandınız!`
            });
        }
        
        // Kullanıcıya rozeti ata
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
  
  // Kullanıcı istatistiklerini oluştur
  createUserStats: async (userId: string) => {
    try {
      // Yeni bir istatistik kaydı oluştur
      const { data, error } = await supabase
        .from('user_stats')
        .insert({
          user_id: userId,
          total_points: 0,
          level: 1,
          rank: 0,
          visited_places: 0
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
  
  // Kullanıcının ziyaret ettiği yerlerin sayısını güncelle
  updateVisitedPlacesCount: async (userId: string) => {
    try {
      // Ziyaret edilen yerlerin sayısını al
      const { count, error: countError } = await supabase
        .from('visited_places')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
      
      if (countError) {
        console.error('Error counting visited places:', countError);
        return false;
      }
      
      // Kullanıcı istatistiklerini güncelle
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
  
  // Liderlik tablosunu getir
  getLeaderboard: async (limit = 10) => {
    try {
      // İlişki hatası nedeniyle ayrı sorgular kullanarak veriyi çekelim
      
      // İlk olarak kullanıcı istatistiklerini çekelim
      const { data: statsData, error: statsError } = await supabase
        .from('user_stats')
        .select('*')
        .order('total_points', { ascending: false })
        .limit(limit);
      
      if (statsError) {
        console.error('Error fetching user stats:', statsError);
        return [];
      }
      
      // Bulunan istatistiklere sahip kullanıcıların bilgilerini çekelim
      const leaderboard = await Promise.all(
        statsData.map(async (stats) => {
          const { data: userData, error: userError } = await supabase
            .from('users')
            .select('id, username, avatar, email')
            .eq('id', stats.user_id)
            .single();
          
          if (userError) {
            console.error(`Error fetching user (${stats.user_id}):`, userError);
            // Kullanıcı bulunamasa bile istatistikleri gösterelim
            return {
              id: stats.user_id,
              username: 'Kullanıcı',
              avatar: `https://ui-avatars.com/api/?name=User&background=random&color=fff&size=256`,
              level: `Seviye ${stats.level || 1}`,
              total_points: stats.total_points || 0
            };
          }
          
          return {
            id: userData.id,
            username: userData.username || userData.email?.split('@')[0] || 'Kullanıcı',
            avatar: userData.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.username || 'User')}&background=random&color=fff&size=256`,
            level: `Seviye ${stats.level || 1}`,
            total_points: stats.total_points || 0
          };
        })
      );
      
      // Eğer liderlik tablosu boşsa, örnek verilerle doldur
      if (leaderboard.length === 0) {
        return await statsService.populateLeaderboard();
      }
      
      return leaderboard;
    } catch (error) {
      console.error('Error in getLeaderboard:', error);
      return [];
    }
  },
  
  // Liderlik tablosunu örnek verilerle doldur
  populateLeaderboard: async () => {
    try {
      // Örnek kullanıcılar için veriler
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
        level: `Seviye ${user.level}`,
        total_points: user.points
      }));
      
      return leaderboard;
    } catch (error) {
      console.error('Error in populateLeaderboard:', error);
      return [];
    }
  }
};

// Kullanıcı servisleri
export const userService = {
  // Kullanıcı profil bilgilerini getir
  getCurrentUser: async (): Promise<User | null> => {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return null;
    
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single();
      
    if (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
    
    // Kullanıcının rozetlerini ayrı sorgu ile çekelim
    const { data: badgesData, error: badgesError } = await supabase
      .from('user_badges')
      .select('*, badge:badges(*)')
      .eq('user_id', user.id);
      
    if (badgesError) {
      console.error('Error fetching user badges:', badgesError);
    } else {
      data.badges = badgesData.map(ub => ub.badge);
    }
    
    return data as User;
  },
  
  // Kullanıcı arkadaşlarını getir
  getUserFriends: async (userId: string) => {
    const { data, error } = await supabase
      .from('friends')
      .select('friend_id')
      .eq('user_id', userId);
      
    if (error) {
      console.error('Error fetching user friends:', error);
      return [];
    }
    
    return data;
  }
};

// Yerler servisleri
export const placesService = {
  // Tüm yerleri getir
  getAllPlaces: async () => {
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .order('rating', { ascending: false });
      
    if (error) {
      console.error('Error fetching places:', error);
      return [];
    }
    
    return data;
  },
  
  // Belirli bir şehirdeki yerleri getir
  getPlacesByCity: async (city: string) => {
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .eq('city', city)
      .order('rating', { ascending: false });
      
    if (error) {
      console.error('Error fetching places by city:', error);
      return [];
    }
    
    return data;
  },
  
  // Yeni bir yer ekle
  insertPlace: async (place: any) => {
    const { data, error } = await supabase
      .from('places')
      .insert([place])
      .select();
      
    if (error) {
      console.error('Error inserting place:', error);
      throw error;
    }
    
    return data[0];
  },
  
  // Places tablosunun varlığını kontrol et
  checkPlacesTable: async () => {
    try {
      const { count, error } = await supabase
        .from('places')
        .select('*', { count: 'exact', head: true });
        
      if (error && error.code === '42P01') {
        // Table doesn't exist
        return false;
      }
      
      return true;
    } catch (err) {
      console.error('Error checking places table:', err);
      return false;
    }
  },
  
  // Places tablosunu oluştur
  createPlacesTable: async () => {
    const { error } = await supabase.rpc('create_places_table');
    
    if (error) {
      console.error('Error creating places table:', error);
      throw error;
    }
    
    return true;
  }
};

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
  getChallengeDetails: async (challengeId: string) => {
    try {
      const { data, error } = await supabase
        .from('challenges')
        .select(`
          *,
          requirements:challenge_requirements(*)
        `)
        .eq('id', challengeId)
        .single();
        
      if (error) {
        console.error('Error fetching challenge details:', error);
        return null;
      }
      
      // Katılımcı sayısını getir
      const { count: participationCount, error: countError } = await supabase
        .from('user_challenges')
        .select('*', { count: 'exact', head: true })
        .eq('challenge_id', challengeId);
        
      if (!countError) {
        data.participation_count = participationCount || 0;
      }
      
      return {
        ...data,
        requirements: data.requirements || []
      };
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
  },

  // Türkçe görev başlığı oluştur
  getLocalizedChallengeTitle: (placeType: string, city: string) => {
    const type = placeType.toLowerCase();
    if (type.includes('müze') || type.includes('museum')) {
      return `${city} Müze Gezgini`;
    } else if (type.includes('tarihi') || type.includes('historical')) {
      return `${city} Tarih Turu`;
    } else if (type.includes('park')) {
      return `${city} Park Keşif Turu`;
    } else if (type.includes('doğa') || type.includes('nature')) {
      return `${city} Doğa Kaşifi`;
    } else if (type.includes('restoran') || type.includes('restaurant')) {
      return `${city} Gurme Turu`;
    } else if (type.includes('kafe') || type.includes('cafe')) {
      return `${city}'in En İyi Kafeleri`;
    } else if (type.includes('spor') || type.includes('sport')) {
      return `${city} Spor Maceraları`;
    } else if (type.includes('cami') || type.includes('mosque')) {
      return `${city} Camileri Turu`;
    } else if (type.includes('alışveriş') || type.includes('shopping')) {
      return `${city} Alışveriş Turu`;
    }
    return `${city} Keşif Turu`;
  },

  // Türkçe görev açıklaması oluştur
  getLocalizedChallengeDescription: (placeType: string, city: string) => {
    const type = placeType.toLowerCase();
    if (type.includes('müze') || type.includes('museum')) {
      return `${city}'deki en önemli müzeleri ziyaret et ve kültürel mirası keşfet.`;
    } else if (type.includes('tarihi') || type.includes('historical')) {
      return `${city}'in zengin tarihine tanık ol ve tarihi yapıları ziyaret et.`;
    } else if (type.includes('park')) {
      return `${city}'in yeşil alanlarını keşfet ve parkların tadını çıkar.`;
    } else if (type.includes('doğa') || type.includes('nature')) {
      return `${city}'in doğal güzelliklerini keşfet ve doğayla bütünleş.`;
    } else if (type.includes('restoran') || type.includes('restaurant')) {
      return `${city}'in en iyi restoranlarına git ve yerel lezzetlerin tadını çıkar.`;
    } else if (type.includes('kafe') || type.includes('cafe')) {
      return `${city}'deki en popüler kafeleri ziyaret et ve kahvenin tadını çıkar.`;
    } else if (type.includes('spor') || type.includes('sport')) {
      return `${city}'deki spor tesislerini ziyaret et ve aktif bir deneyim yaşa.`;
    } else if (type.includes('cami') || type.includes('mosque')) {
      return `${city}'deki tarihi camileri ziyaret et ve mimari harikalarını keşfet.`;
    } else if (type.includes('alışveriş') || type.includes('shopping')) {
      return `${city}'in alışveriş merkezlerini ve çarşılarını keşfet.`;
    }
    return `${city}'in en ilgi çekici yerlerini keşfet ve şehri yakından tanı.`;
  },

  // Tür için görselleri belirle
  getTypeImage: (placeType: string) => {
    const type = placeType.toLowerCase();
    if (type.includes('müze') || type.includes('museum')) {
      return 'https://images.unsplash.com/photo-1566127992631-137a642a90f4';
    } else if (type.includes('tarihi') || type.includes('historical')) {
      return 'https://images.unsplash.com/photo-1558730234-d8b2281b0d00';
    } else if (type.includes('park')) {
      return 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f';
    } else if (type.includes('doğa') || type.includes('nature')) {
      return 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e';
    } else if (type.includes('restoran') || type.includes('restaurant')) {
      return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4';
    } else if (type.includes('kafe') || type.includes('cafe')) {
      return 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085';
    } else if (type.includes('spor') || type.includes('sport')) {
      return 'https://images.unsplash.com/photo-1517649763962-0c623066013b';
    } else if (type.includes('cami') || type.includes('mosque')) {
      return 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f';
    } else if (type.includes('alışveriş') || type.includes('shopping')) {
      return 'https://images.unsplash.com/photo-1481437156560-3205f6a55735';
    }
    return 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f';
  },

  // Yer türüne göre görev türü belirle
  getChallengeTypeFromPlaceType: (placeType: string) => {
    const type = placeType.toLowerCase();
    if (type.includes('müze') || type.includes('museum') || type.includes('tarihi') || 
        type.includes('historical') || type.includes('anıt') || type.includes('monument')) {
      return 'culture';
    } else if (type.includes('park') || type.includes('doğa') || type.includes('nature') ||
            type.includes('orman') || type.includes('forest')) {
      return 'nature';
    } else if (type.includes('restoran') || type.includes('restaurant') || type.includes('cafe') ||
            type.includes('kafe') || type.includes('yemek') || type.includes('food')) {
      return 'gastronomy';
    } else if (type.includes('spor') || type.includes('sport') || type.includes('aktivite') ||
            type.includes('activity') || type.includes('macera') || type.includes('adventure')) {
      return 'adventure';
    }
    return 'general';
  },

  // Yer türüne göre görev kategorisi belirle
  getCategoryFromPlaceType: (placeType: string) => {
    const type = placeType.toLowerCase();
    if (type.includes('müze') || type.includes('museum') || type.includes('tarihi') || 
        type.includes('historical') || type.includes('anıt') || type.includes('monument')) {
      return 'culture';
    } else if (type.includes('park') || type.includes('doğa') || type.includes('nature') ||
            type.includes('orman') || type.includes('forest')) {
      return 'nature';
    } else if (type.includes('restoran') || type.includes('restaurant') || type.includes('cafe') ||
            type.includes('kafe') || type.includes('yemek') || type.includes('food')) {
      return 'gastronomy';
    } else if (type.includes('spor') || type.includes('sport') || type.includes('aktivite') ||
            type.includes('activity') || type.includes('macera') || type.includes('adventure')) {
      return 'adventure';
    }
    return 'general';
  },

  // Geçerlilik süresi belirle (3 ay sonrası)
  getValidUntilDate: () => {
    const date = new Date();
    date.setMonth(date.getMonth() + 3);
    return date.toISOString();
  },
  
  // Kullanıcının bulunduğu şehre göre görevleri getir
  getLocationBasedChallenges: async (city: string) => {
    try {
      // Önce şehirdeki yerleri getir
      const { data: placesData, error: placesError } = await supabase
        .from('places')
        .select('id, name, type, city')
        .eq('city', city);
      
      if (placesError) {
        console.error(`Error fetching places in ${city}:`, placesError);
        return [];
      }

      if (!placesData || placesData.length === 0) {
        console.log(`No places found in ${city}`);
        return [];
      }

      // Bu şehirdeki yerlerle ilgili mevcut görevleri getir
      const placeIds = placesData.map(place => place.id);
      const { data: existingChallenges, error: challengesError } = await supabase
        .from('challenges')
        .select('*')
        .filter('target_place_ids', 'cs', `{${placeIds.join(',')}}`)
        .order('created_at', { ascending: false });

      if (challengesError) {
        console.error(`Error fetching existing challenges for ${city}:`, challengesError);
        return [];
      }

      // Eğer bu şehir için görevler varsa onları döndür
      if (existingChallenges && existingChallenges.length > 0) {
        return existingChallenges as Challenge[];
      }

      // Şehirdeki yerlere göre yeni otomatik görevler oluştur
      const challenges: Challenge[] = [];
      
      // Şehirdeki yerleri gruplandır (türlerine göre)
      const placesByType = placesData.reduce((acc, place) => {
        if (!acc[place.type]) acc[place.type] = [];
        acc[place.type].push(place);
        return acc;
      }, {} as Record<string, any[]>);

      // Her tür için görevler oluştur
      for (const [type, places] of Object.entries(placesByType)) {
        if (places.length >= 3) {
          // En az 3 yer varsa bir koleksiyon görevi oluştur
          const challengeTitle = challengesService.getLocalizedChallengeTitle(type, city);
          const challengeDesc = challengesService.getLocalizedChallengeDescription(type, city);
          
          const newChallenge: any = {
            title: challengeTitle,
            description: challengeDesc,
            points: Math.floor(Math.random() * 200) + 300, // 300-500 arası puan
            image_url: challengesService.getTypeImage(type),
            deadline: 'Süresiz',
            is_daily: false,
            challenge_type: challengesService.getChallengeTypeFromPlaceType(type),
            category: challengesService.getCategoryFromPlaceType(type),
            difficulty: places.length > 5 ? 'hard' : (places.length > 3 ? 'medium' : 'easy'),
            target_count: Math.min(places.length, 5),
            target_place_ids: places.slice(0, 5).map(p => p.id), // En fazla 5 yer
            valid_until: challengesService.getValidUntilDate(),
          };
          
          // Yeni görevi veritabanına ekle
          const { data, error } = await supabase
            .from('challenges')
            .insert(newChallenge)
            .select()
            .single();
            
          if (error) {
            console.error(`Error creating challenge for ${type} in ${city}:`, error);
          } else {
            // Görev gereksinimleri oluştur
            const targetPlaces = places.slice(0, 5);
            const requirements = targetPlaces.map(place => ({
              challenge_id: data.id,
              description: `${place.name} mekanını ziyaret et`,
              type: 'visit_place',
              target_id: place.id,
              count: 1
            }));
            
            const { error: reqError } = await supabase
              .from('challenge_requirements')
              .insert(requirements);
              
            if (reqError) {
              console.error(`Error creating requirements for challenge ${data.id}:`, reqError);
            }
            
            challenges.push(data);
          }
        }
      }
      
      // Şehir için en az bir özel görev oluştur
      if (placesData.length > 0) {
        const specialPlaces = placesData.sort(() => 0.5 - Math.random()).slice(0, 3);
        const specialChallenge: any = {
          title: `${city} Kaşifi`,
          description: `${city}'in en özel yerlerini keşfet ve fotoğrafla!`,
          points: 500,
          image_url: 'https://images.unsplash.com/photo-1569949381669-ecf31ae8e613',
          deadline: 'Süresiz',
          is_daily: false,
          challenge_type: 'collection',
          category: 'culture',
          difficulty: 'medium',
          target_count: specialPlaces.length,
          target_place_ids: specialPlaces.map(p => p.id),
          valid_until: getValidUntilDate(),
        };
        
        const { data, error } = await supabase
          .from('challenges')
          .insert(specialChallenge)
          .select()
          .single();
          
        if (error) {
          console.error(`Error creating special challenge for ${city}:`, error);
        } else {
          // Görev gereksinimleri oluştur
          const requirements = [];
          
          for (const place of specialPlaces) {
            requirements.push({
              challenge_id: data.id,
              description: `${place.name} mekanını ziyaret et`,
              type: 'visit_place',
              target_id: place.id,
              count: 1
            });
            
            requirements.push({
              challenge_id: data.id,
              description: `${place.name} mekanında bir fotoğraf çek ve paylaş`,
              type: 'take_photo',
              target_id: place.id,
              count: 1
            });
          }
          
          const { error: reqError } = await supabase
            .from('challenge_requirements')
            .insert(requirements);
            
          if (reqError) {
            console.error(`Error creating requirements for special challenge ${data.id}:`, reqError);
          }
          
          challenges.push(data);
        }
      }
      
      return challenges;
    } catch (error) {
      console.error(`Error in getLocationBasedChallenges for ${city}:`, error);
      return [];
    }
  },
  
  // Helper fonksiyonlar
  // Yer türüne göre görev türü belirle
  getChallengeTypeFromPlaceType: (placeType: string) => {
    const type = placeType.toLowerCase();
    if (type.includes('müze') || type.includes('museum') || type.includes('tarihi') || 
        type.includes('historical') || type.includes('anıt') || type.includes('monument')) {
      return 'culture';
    } else if (type.includes('park') || type.includes('doğa') || type.includes('nature') ||
            type.includes('orman') || type.includes('forest')) {
      return 'nature';
    } else if (type.includes('restoran') || type.includes('restaurant') || type.includes('cafe') ||
            type.includes('kafe') || type.includes('yemek') || type.includes('food')) {
      return 'gastronomy';
    } else if (type.includes('spor') || type.includes('sport') || type.includes('aktivite') ||
            type.includes('activity') || type.includes('macera') || type.includes('adventure')) {
      return 'adventure';
    }
    return 'general';
  },

  // Yer türüne göre görev kategorisi belirle
  getCategoryFromPlaceType: (placeType: string) => {
    const type = placeType.toLowerCase();
    if (type.includes('müze') || type.includes('museum') || type.includes('tarihi') || 
        type.includes('historical') || type.includes('anıt') || type.includes('monument')) {
      return 'culture';
    } else if (type.includes('park') || type.includes('doğa') || type.includes('nature') ||
            type.includes('orman') || type.includes('forest')) {
      return 'nature';
    } else if (type.includes('restoran') || type.includes('restaurant') || type.includes('cafe') ||
            type.includes('kafe') || type.includes('yemek') || type.includes('food')) {
      return 'gastronomy';
    } else if (type.includes('spor') || type.includes('sport') || type.includes('aktivite') ||
            type.includes('activity') || type.includes('macera') || type.includes('adventure')) {
      return 'adventure';
    }
    return 'general';
  },

  // Türkçe görev başlığı oluştur
  getLocalizedChallengeTitle: (placeType: string, city: string) => {
    const type = placeType.toLowerCase();
    if (type.includes('müze') || type.includes('museum')) {
      return `${city} Müze Gezgini`;
    } else if (type.includes('tarihi') || type.includes('historical')) {
      return `${city} Tarih Turu`;
    } else if (type.includes('park')) {
      return `${city} Park Keşif Turu`;
    } else if (type.includes('doğa') || type.includes('nature')) {
      return `${city} Doğa Kaşifi`;
    } else if (type.includes('restoran') || type.includes('restaurant')) {
      return `${city} Gurme Turu`;
    } else if (type.includes('kafe') || type.includes('cafe')) {
      return `${city}'in En İyi Kafeleri`;
    } else if (type.includes('spor') || type.includes('sport')) {
      return `${city} Spor Maceraları`;
    } else if (type.includes('cami') || type.includes('mosque')) {
      return `${city} Camileri Turu`;
    } else if (type.includes('alışveriş') || type.includes('shopping')) {
      return `${city} Alışveriş Turu`;
    }
    return `${city} Keşif Turu`;
  },

  // Türkçe görev açıklaması oluştur
  getLocalizedChallengeDescription: (placeType: string, city: string) => {
    const type = placeType.toLowerCase();
    if (type.includes('müze') || type.includes('museum')) {
      return `${city}'deki en önemli müzeleri ziyaret et ve kültürel mirası keşfet.`;
    } else if (type.includes('tarihi') || type.includes('historical')) {
      return `${city}'in zengin tarihine tanık ol ve tarihi yapıları ziyaret et.`;
    } else if (type.includes('park')) {
      return `${city}'in yeşil alanlarını keşfet ve parkların tadını çıkar.`;
    } else if (type.includes('doğa') || type.includes('nature')) {
      return `${city}'in doğal güzelliklerini keşfet ve doğayla bütünleş.`;
    } else if (type.includes('restoran') || type.includes('restaurant')) {
      return `${city}'in en iyi restoranlarına git ve yerel lezzetlerin tadını çıkar.`;
    } else if (type.includes('kafe') || type.includes('cafe')) {
      return `${city}'deki en popüler kafeleri ziyaret et ve kahvenin tadını çıkar.`;
    } else if (type.includes('spor') || type.includes('sport')) {
      return `${city}'deki spor tesislerini ziyaret et ve aktif bir deneyim yaşa.`;
    } else if (type.includes('cami') || type.includes('mosque')) {
      return `${city}'deki tarihi camileri ziyaret et ve mimari harikalarını keşfet.`;
    } else if (type.includes('alışveriş') || type.includes('shopping')) {
      return `${city}'in alışveriş merkezlerini ve çarşılarını keşfet.`;
    }
    return `${city}'in en ilgi çekici yerlerini keşfet ve şehri yakından tanı.`;
  },

  // Tür için görselleri belirle
  getTypeImage: (placeType: string) => {
    const type = placeType.toLowerCase();
    if (type.includes('müze') || type.includes('museum')) {
      return 'https://images.unsplash.com/photo-1566127992631-137a642a90f4';
    } else if (type.includes('tarihi') || type.includes('historical')) {
      return 'https://images.unsplash.com/photo-1558730234-d8b2281b0d00';
    } else if (type.includes('park')) {
      return 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f';
    } else if (type.includes('doğa') || type.includes('nature')) {
      return 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e';
    } else if (type.includes('restoran') || type.includes('restaurant')) {
      return 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4';
    } else if (type.includes('kafe') || type.includes('cafe')) {
      return 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085';
    } else if (type.includes('spor') || type.includes('sport')) {
      return 'https://images.unsplash.com/photo-1517649763962-0c623066013b';
    } else if (type.includes('cami') || type.includes('mosque')) {
      return 'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f';
    } else if (type.includes('alışveriş') || type.includes('shopping')) {
      return 'https://images.unsplash.com/photo-1481437156560-3205f6a55735';
    }
    return 'https://images.unsplash.com/photo-1519331379826-f10be5486c6f';
  },

  // Geçerlilik süresi belirle (3 ay sonrası)
  getValidUntilDate: () => {
    const date = new Date();
    date.setMonth(date.getMonth() + 3);
    return date.toISOString();
  },
};

// Gönderiler servisleri
export const feedService = {
  // Tüm gönderileri getir
  getAllPosts: async () => {
    try {
      // Debug için sorgu yapısını yazdıralım
      console.log('Fetching posts from database...');
      
      // İlk olarak tüm gönderileri getirelim
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });
        
      if (postsError) {
        console.error('Error fetching feed posts:', postsError);
        console.log('Returning mock data due to error');
        return feedPosts;
      }
      
      if (!postsData || postsData.length === 0) {
        console.log('No posts found in database, returning mock data');
        return feedPosts;
      }
      
      console.log('Posts found in database:', postsData.length);
      
      // Kullanıcı bilgilerini ayrı ayrı getirelim
      const formattedData = await Promise.all(postsData.map(async (post) => {
        // Her post için kullanıcı bilgilerini sorgula
        const { data: userData, error: userError } = await supabase
          .from('users')
          .select('*')
          .eq('id', post.user_id)
          .single();
          
        // Yer bilgilerini de sorgulayalım
        const { data: placeData, error: placeError } = await supabase
          .from('places')
          .select('name')
          .eq('id', post.place_id)
          .maybeSingle();
        
        // UI'da kullanılan formata uygun olarak veriyi dönüştür
        return {
          id: post.id,
          user: {
            id: post.user_id,
            username: userData?.username || 'Anonim',
            avatar_url: userData?.avatar || 'https://ui-avatars.com/api/?background=random'
          },
          location: placeData?.name || 'Güzel Yer',
          created_at: post.created_at,
          image_url: post.image,
          content: post.description,
          likes_count: post.likes || 0,
          comments_count: post.comments || 0,
          timestamp: formatTimestamp(post.created_at)
        };
      }));
      
      console.log('Formatted post data:', formattedData.length);
      return formattedData;
    } catch (e) {
      console.error('Unexpected error in getAllPosts:', e);
      return feedPosts;
    }
  },
  
  // Kullanıcının kendi gönderilerini getir
  getUserPosts: async (userId: string) => {
    const { data, error } = await supabase
      .from('posts')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Error fetching user posts:', error);
      return [];
    }
    
    return data;
  }
};

// Planlayıcı servisleri
export const plannerService = {
  // Tüm gezi planlarını getir
  getAllTripPlans: async (): Promise<TripPlan[]> => {
    try {
      const { data, error } = await supabase
        .from('trip_plans')
        .select(`
          *,
          user:users(username, avatar),
          places:plan_places(
            place:places(*)
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching trip plans:', error);
        return [];
      }
      
      // Plan verilerini düzenle
      const formattedPlans = data.map(plan => {
        return {
          ...plan,
          username: plan.user?.username || 'Kullanıcı',
          avatar: plan.user?.avatar || '',
          places: plan.places?.map((pp: any) => pp.place) || []
        };
      });
      
      return formattedPlans;
    } catch (error) {
      console.error('Error in getAllTripPlans:', error);
      return [];
    }
  },
  
  // Kullanıcının gezi planlarını getir
  getUserTripPlans: async (userId: string): Promise<TripPlan[]> => {
    try {
      const { data, error } = await supabase
        .from('trip_plans')
        .select(`
          *,
          places:plan_places(
            place:places(*)
          )
        `)
        .eq('created_by', userId)
        .order('created_at', { ascending: false });
      
      if (error) {
        console.error('Error fetching user trip plans:', error);
        return [];
      }
      
      // Plan verilerini düzenle
      const formattedPlans = data.map(plan => {
        return {
          ...plan,
          places: plan.places?.map((pp: any) => pp.place) || []
        };
      });
      
      return formattedPlans;
    } catch (error) {
      console.error('Error in getUserTripPlans:', error);
      return [];
    }
  },
  
  // Plan detaylarını getir
  getTripPlanById: async (planId: string): Promise<TripPlan | null> => {
    try {
      const { data, error } = await supabase
        .from('trip_plans')
        .select(`
          *,
          user:users(username, avatar),
          places:plan_places(
            place:places(*),
            order_index,
            status
          )
        `)
        .eq('id', planId)
        .single();
      
      if (error) {
        console.error('Error fetching trip plan:', error);
        return null;
      }
      
      // Plan verilerini düzenle
      const formattedPlan = {
        ...data,
        username: data.user?.username || 'Kullanıcı',
        avatar: data.user?.avatar || '',
        places: data.places
          ?.sort((a: any, b: any) => a.order_index - b.order_index)
          .map((pp: any) => ({
            ...pp.place,
            status: pp.status || 'not_visited' // Her yer için durum bilgisi
          })) || []
      };
      
      return formattedPlan;
    } catch (error) {
      console.error('Error in getTripPlanById:', error);
      return null;
    }
  },
  
  // Yeni gezi planı oluştur
  createTripPlan: async (planInfo: {
    title: string;
    description: string;
    category: string;
    budget: string;
    duration: string;
    image_url: string;
    created_by: string;
    place_ids: string[];
  }): Promise<TripPlan | null> => {
    try {
      // 1. Trip plan oluştur
      const { data: newPlan, error: planError } = await supabase
        .from('trip_plans')
        .insert({
          title: planInfo.title,
          description: planInfo.description,
          category: planInfo.category,
          budget: planInfo.budget,
          duration: planInfo.duration,
          image_url: planInfo.image_url,
          created_by: planInfo.created_by,
          is_public: true
        })
        .select()
        .single();
      
      if (planError) {
        console.error('Error creating trip plan:', planError);
        throw planError;
      }
      
      // 2. Plan yerlerini oluştur
      if (planInfo.place_ids && planInfo.place_ids.length > 0) {
        const planPlacesData = planInfo.place_ids.map((placeId: string, index: number) => ({
          plan_id: newPlan.id,
          place_id: placeId,
          order_index: index
        }));
        
        const { error: placesError } = await supabase
          .from('plan_places')
          .insert(planPlacesData);
        
        if (placesError) {
          console.error('Error adding places to plan:', placesError);
          // Hata durumunda oluşturulan planı silme işlemi yapılabilir
        }
      }
      
      // 3. Kategoriyi ilgi alanları tablosuna ekle
      if (planInfo.category) {
        // İlgi alanını getir veya oluştur
        let interestTagId: string | null = null;
        
        const { data: existingTag, error: tagError } = await supabase
          .from('interest_tags')
          .select('id')
          .eq('name', planInfo.category)
          .single();
        
        if (tagError && tagError.code !== 'PGRST116') {
          console.error('Error checking interest tag:', tagError);
        }
        
        if (existingTag) {
          interestTagId = existingTag.id;
        } else {
          // Yeni ilgi alanı oluştur
          const { data: newTag, error: newTagError } = await supabase
            .from('interest_tags')
            .insert({ name: planInfo.category })
            .select()
            .single();
          
          if (newTagError) {
            console.error('Error creating interest tag:', newTagError);
          } else {
            interestTagId = newTag.id;
          }
        }
        
        // Plan ile ilgi alanını ilişkilendir
        if (interestTagId) {
          const { error: interestError } = await supabase
            .from('plan_interests')
            .insert({
              plan_id: newPlan.id,
              interest_id: interestTagId
            });
          
          if (interestError) {
            console.error('Error linking interest to plan:', interestError);
          }
        }
      }
      
      return newPlan;
    } catch (error) {
      console.error('Error in createTripPlan:', error);
      throw error;
    }
  },
  
  // Gezi planını güncelle
  updateTripPlan: async (planId: string, planData: Partial<TripPlan>): Promise<TripPlan | null> => {
    try {
      const { data, error } = await supabase
        .from('trip_plans')
        .update(planData)
        .eq('id', planId)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating trip plan:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Error in updateTripPlan:', error);
      return null;
    }
  },
  
  // Gezi planını sil
  deleteTripPlan: async (planId: string): Promise<boolean> => {
    try {
      // Önce plan_places tablosundaki ilişkili yerler silinir
      const { error: placesError } = await supabase
        .from('plan_places')
        .delete()
        .eq('plan_id', planId);
      
      if (placesError) {
        console.error('Error deleting plan places:', placesError);
        return false;
      }
      
      // Sonra plan_interests tablosundaki ilişkili ilgi alanları silinir
      const { error: interestsError } = await supabase
        .from('plan_interests')
        .delete()
        .eq('plan_id', planId);
      
      if (interestsError) {
        console.error('Error deleting plan interests:', interestsError);
        return false;
      }
      
      // En son plan silinir
      const { error: planError } = await supabase
        .from('trip_plans')
        .delete()
        .eq('id', planId);
      
      if (planError) {
        console.error('Error deleting trip plan:', planError);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error in deleteTripPlan:', error);
      return false;
    }
  },
  
  // İlgi alanlarını (interest tags) getir
  getInterestTags: async (): Promise<InterestTag[]> => {
    try {
      const { data, error } = await supabase
        .from('interest_tags')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Error fetching interest tags:', error);
        return [];
      }
      
      return data;
    } catch (error) {
      console.error('Error in getInterestTags:', error);
      return [];
    }
  },
  
  // Plana yer ekle
  addPlaceToTripPlan: async (planId: string, placeId: string, orderIndex: number = 0): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('plan_places')
        .insert({
          plan_id: planId,
          place_id: placeId,
          order_index: orderIndex
        });
      
      if (error) {
        console.error('Error adding place to trip plan:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error in addPlaceToTripPlan:', error);
      return false;
    }
  },
  
  // Plandan yer çıkar
  removePlaceFromTripPlan: async (planId: string, placeId: string): Promise<boolean> => {
    try {
      const { error } = await supabase
        .from('plan_places')
        .delete()
        .eq('plan_id', planId)
        .eq('place_id', placeId);
      
      if (error) {
        console.error('Error removing place from trip plan:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error in removePlaceFromTripPlan:', error);
      return false;
    }
  },
  
  // Gezi planı yerinin ziyaret durumunu güncelle
  updatePlaceVisitStatus: async (planId: string, placeId: string, status: 'visited' | 'not_visited'): Promise<boolean> => {
    try {
      // Plan yerinin durumunu güncelle
      const { error } = await supabase
        .from('plan_places')
        .update({ status })
        .eq('plan_id', planId)
        .eq('place_id', placeId);
      
      if (error) {
        console.error('Error updating place visit status:', error);
        return false;
      }
      
      // Plan durumunu güncelleyelim
      await plannerService.updateTripPlanStatus(planId);
      
      return true;
    } catch (error) {
      console.error('Error in updatePlaceVisitStatus:', error);
      return false;
    }
  },
  
  // Tüm yerlerin durumuna göre plan durumunu güncelle
  updateTripPlanStatus: async (planId: string): Promise<boolean> => {
    try {
      // Plan yerlerini getir
      const { data: places, error: placesError } = await supabase
        .from('plan_places')
        .select('status')
        .eq('plan_id', planId);
      
      if (placesError) {
        console.error('Error fetching plan places:', placesError);
        return false;
      }
      
      // Toplam ve ziyaret edilen yer sayılarını hesapla
      const totalPlaces = places.length;
      const visitedPlaces = places.filter(place => place.status === 'visited').length;
      
      let status: 'active' | 'completed' | 'cancelled' = 'active';
      
      // Eğer tüm yerler ziyaret edildiyse planı tamamlanmış olarak işaretle
      if (totalPlaces > 0 && visitedPlaces === totalPlaces) {
        status = 'completed';
      }
      
      // Plan durumunu güncelle
      const { error: updateError } = await supabase
        .from('trip_plans')
        .update({ status })
        .eq('id', planId);
      
      if (updateError) {
        console.error('Error updating trip plan status:', updateError);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error in updateTripPlanStatus:', error);
      return false;
    }
  },
  
  // Konum bazlı otomatik ziyaret durumu kontrolü
  checkLocationBasedVisit: async (planId: string, currentLocation: {latitude: number, longitude: number}): Promise<boolean> => {
    try {
      // Önce plan yerlerini getirelim
      const { data: planPlaces, error: placesError } = await supabase
        .from('plan_places')
        .select('id, place_id, status')
        .eq('plan_id', planId);
        
      if (placesError || !planPlaces) {
        console.error('Error fetching plan places:', placesError);
        return false;
      }
      
      // Güncelleme yapıldı mı kontrolü
      let updatedAny = false;
      
      // Her yer için konum kontrolü yap
      for (const placeItem of planPlaces) {
        // Zaten ziyaret edilmişse atla
        if (placeItem.status === 'visited') continue;
        
        // Yer bilgilerini ve konumunu getir
        const { data: placeData, error: placeError } = await supabase
          .from('places')
          .select('id, name, location')
          .eq('id', placeItem.place_id)
          .single();
          
        if (placeError || !placeData || !placeData.location) {
          console.error(`Error fetching place data for ${placeItem.place_id}:`, placeError);
          continue;
        }
        
        // Mesafeyi hesapla
        const distance = calculateDistance(
          currentLocation.latitude,
          currentLocation.longitude,
          placeData.location.latitude,
          placeData.location.longitude
        );
        
        // Eğer 200 metre içindeyse ziyaret edildi olarak işaretle
        if (distance <= 0.2) { // 0.2 km = 200 metre
          const { error: updateError } = await supabase
            .from('plan_places')
            .update({ status: 'visited' })
            .eq('id', placeItem.id);
            
          if (!updateError) {
            updatedAny = true;
          } else {
            console.error('Error updating place visit status:', updateError);
          }
        }
      }
      
      // Eğer herhangi bir güncelleme yapıldıysa plan durumunu da güncelle
      if (updatedAny) {
        await plannerService.updateTripPlanStatus(planId);
      }
      
      return updatedAny;
    } catch (error) {
      console.error('Error in checkLocationBasedVisit:', error);
      return false;
    }
  }
};

// İki nokta arasındaki mesafeyi km cinsinden hesaplar (Haversine formülü)
const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Dünya yarıçapı (km)
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distance = R * c; // Kilometre cinsinden mesafe
  return distance;
};
