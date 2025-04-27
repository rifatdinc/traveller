import { feedPosts } from '@/constants/MockData';
import { formatTimestamp } from '@/helpers/time.helper';
import { supabase } from '@/lib/supabase';

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
