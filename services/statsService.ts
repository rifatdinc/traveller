import { supabase } from '@/lib/supabase';

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
