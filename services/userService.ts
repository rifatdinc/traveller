import { supabase } from '@/lib/supabase';
import { User } from '@/types';

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
