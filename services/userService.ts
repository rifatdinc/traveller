import { supabase } from '@/lib/supabase';
import { User } from '@/types';

// Kullanıcı servisleri

export const userService = {
  // Kullanıcı profil bilgilerini getir
  getCurrentUser: async (): Promise<User | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) return null;

      // Ensure user exists in our database tables
      await supabase.rpc('get_or_create_user', {
        p_user_id: user.id,
        p_email: user.email || '',
        p_username: null
      });

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
    } catch (error) {
      console.error('Unexpected error in getCurrentUser:', error);
      return null;
    }
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
  },
  
  // Get user by ID
  getUserById: async (userId: string) => {
    try {
      // Try profiles table first
      let userData = null;
      
      // Check in profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('username, avatar_url, email')
        .eq('user_id', userId)
        .maybeSingle();
        
      if (!profileError && profileData) {
        return {
          id: userId,
          username: profileData.username || 'User',
          avatar: profileData.avatar_url,
          email: profileData.email
        };
      }
      
      // Check in users table if not found in profiles
      const { data, error } = await supabase
        .from('users')
        .select('username, avatar, email')
        .eq('id', userId)
        .maybeSingle();
      
      if (error) {
        // If user not found, return a generic user object
        if (error.code === 'PGRST116') {
          return {
            id: userId,
            username: 'User',
            avatar: `https://ui-avatars.com/api/?name=User&background=random&color=fff&size=256`
          };
        }
        
        console.error(`Error fetching user (${userId}):`, error);
        return null;
      }
      
      return {
        id: userId,
        username: data?.username || 'User',
        avatar: data?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(data?.username || 'User')}&background=random&color=fff&size=256`,
        email: data?.email
      };
    } catch (error) {
      console.error(`Unexpected error getting user (${userId}):`, error);
      return {
        id: userId,
        username: 'User',
        avatar: `https://ui-avatars.com/api/?name=User&background=random&color=fff&size=256`
      };
    }
  }
};
