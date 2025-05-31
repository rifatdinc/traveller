import { Share } from 'react-native';
import { supabase } from '@/lib/supabase';
import { placesService } from './placesService';
import { userService } from './userService';
import { Platform } from 'react-native';

export interface SocialPost {
  id: string;
  auth_id: string;
  place_id: string;
  content: string;
  images?: string[];
  likes_count: number;
  comments_count: number;
  created_at: string;
  username?: string;
  user_avatar?: string;
  place_name?: string;
  place_city?: string;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  username?: string;
  user_avatar?: string;
}

export const socialSharingService = {
  /**
   * Share a check-in on the social feed
   */
  shareCheckIn: async (
    userId: string,
    placeId: string,
    content: string,
    images: string[] = []
  ): Promise<SocialPost | null> => {
    try {
      // Create a new post in the social_posts table
      const { data, error } = await supabase
        .from('social_posts')
        .insert({
          user_id: userId,
          place_id: placeId,
          content,
          images,
          likes_count: 0,
          comments_count: 0
        })
        .select()
        .single();

      if (error) {
        console.error('Error sharing check-in:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in shareCheckIn:', error);
      return null;
    }
  },

  /**
   * Share a check-in to external platforms (Facebook, Twitter, etc.)
   */
  shareToExternal: async (placeId: string, content: string) => {
    try {
      // Get place details
      const place = await placesService.getPlaceById(placeId);
      
      if (!place) {
        console.error('Place not found');
        return false;
      }

      const message = content || `I just checked in at ${place.name} in ${place.city}! #TravelPoints`;
      const url = Platform.OS === 'ios' ? 
        `travelpoints://place/${placeId}` : 
        `https://travelpoints.app/place/${placeId}`;

      await Share.share({
        message,
        url,
        title: 'TravelPoints Check-in'
      });

      return true;
    } catch (error) {
      console.error('Error sharing to external platforms:', error);
      return false;
    }
  },

  /**
   * Get social feed posts
   */
  getFeedPosts: async (limit = 20, offset = 0): Promise<SocialPost[]> => {
    try {
      // Get posts with user and place information
      const { data, error } = await supabase
        .from('social_posts')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        console.error('Error fetching feed posts:', error);
        return [];
      }

      // Format the data
      return data.map(post => ({
        id: post.id,
        auth_id: post.auth_id,
        place_id: post.place_id,
        content: post.content,
        images: post.images,
        likes_count: post.likes_count,
        comments_count: post.comments_count,
        created_at: post.created_at,
        username: post.users?.username,
        user_avatar: post.users?.avatar_url,
        place_name: post.places?.name,
        place_city: post.places?.city
      }));
    } catch (error) {
      console.error('Error in getFeedPosts:', error);
      return [];
    }
  },

  /**
   * Get posts by a specific user
   */
  getUserPosts: async (userId: string, limit = 10): Promise<SocialPost[]> => {
    try {
      // Get posts with place information
      const { data, error } = await supabase
        .from('social_posts')
        .select(`
          *,
          places:place_id(name, city)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Error fetching user posts:', error);
        return [];
      }

      // Get user information
      const user = await userService.getUserById(userId);

      // Format the data
      return data.map(post => ({
        id: post.id,
        user_id: post.user_id,
        place_id: post.place_id,
        content: post.content,
        images: post.images,
        likes_count: post.likes_count,
        comments_count: post.comments_count,
        created_at: post.created_at,
        username: user?.username,
        user_avatar: user?.avatar,
        place_name: post.places?.name,
        place_city: post.places?.city
      }));
    } catch (error) {
      console.error('Error in getUserPosts:', error);
      return [];
    }
  },

  /**
   * Like a post
   */
  likePost: async (userId: string, postId: string): Promise<boolean> => {
    try {
      // Check if the user already liked the post
      const { count, error: checkError } = await supabase
        .from('post_likes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('post_id', postId);

      if (checkError) {
        console.error('Error checking if post is liked:', checkError);
        return false;
      }

      // If not already liked, add a like
      if (count === 0) {
        const { error: likeError } = await supabase
          .from('post_likes')
          .insert({
            user_id: userId,
            post_id: postId
          });

        if (likeError) {
          console.error('Error liking post:', likeError);
          return false;
        }

        // Increment the likes count on the post
        const { error: updateError } = await supabase
          .rpc('increment_post_likes', {
            p_post_id: postId
          });

        if (updateError) {
          console.error('Error incrementing likes count:', updateError);
          return false;
        }
      }

      return true;
    } catch (error) {
      console.error('Error in likePost:', error);
      return false;
    }
  },

  /**
   * Unlike a post
   */
  unlikePost: async (userId: string, postId: string): Promise<boolean> => {
    try {
      // Remove the like
      const { error: unlikeError } = await supabase
        .from('post_likes')
        .delete()
        .eq('user_id', userId)
        .eq('post_id', postId);

      if (unlikeError) {
        console.error('Error unliking post:', unlikeError);
        return false;
      }

      // Decrement the likes count on the post
      const { error: updateError } = await supabase
        .rpc('decrement_post_likes', {
          p_post_id: postId
        });

      if (updateError) {
        console.error('Error decrementing likes count:', updateError);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in unlikePost:', error);
      return false;
    }
  },

  /**
   * Check if a user has liked a post
   */
  hasUserLikedPost: async (userId: string, postId: string): Promise<boolean> => {
    try {
      const { count, error } = await supabase
        .from('post_likes')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('post_id', postId);

      if (error) {
        console.error('Error checking if post is liked:', error);
        return false;
      }

      return count > 0;
    } catch (error) {
      console.error('Error in hasUserLikedPost:', error);
      return false;
    }
  },

  /**
   * Add a comment to a post
   */
  addComment: async (userId: string, postId: string, content: string): Promise<Comment | null> => {
    try {
      // Add the comment
      const { data, error } = await supabase
        .from('post_comments')
        .insert({
          user_id: userId,
          post_id: postId,
          content
        })
        .select()
        .single();

      if (error) {
        console.error('Error adding comment:', error);
        return null;
      }

      // Increment the comments count on the post
      const { error: updateError } = await supabase
        .rpc('increment_post_comments', {
          p_post_id: postId
        });

      if (updateError) {
        console.error('Error incrementing comments count:', updateError);
      }

      // Get user info
      const user = await userService.getUserById(userId);

      return {
        ...data,
        username: user?.username,
        user_avatar: user?.avatar
      };
    } catch (error) {
      console.error('Error in addComment:', error);
      return null;
    }
  },

  /**
   * Get comments for a post
   */
  getPostComments: async (postId: string): Promise<Comment[]> => {
    try {
      // Get comments with user information
      const { data, error } = await supabase
        .from('post_comments')
        .select(`
          *,
          users:user_id(username, avatar)
        `)
        .eq('post_id', postId)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('Error fetching post comments:', error);
        return [];
      }

      // Format the data
      return data.map(comment => ({
        id: comment.id,
        post_id: comment.post_id,
        user_id: comment.user_id,
        content: comment.content,
        created_at: comment.created_at,
        username: comment.users?.username,
        user_avatar: comment.users?.avatar
      }));
    } catch (error) {
      console.error('Error in getPostComments:', error);
      return [];
    }
  },

  shareChallenge: async (challenge: import('@/types').Challenge): Promise<boolean> => {
    try {
      const message = `Bu harika göreve göz atın: "${challenge.title}"! 

${challenge.description}

#TravelPoints #${challenge.category || 'Keşfet'}`;
      const url = Platform.OS === 'ios' 
        ? `travelpoints://challenge/${challenge.id}` 
        : `https://travelpoints.app/challenge/${challenge.id}`; // Fallback URL for Android or web if deep links aren't fully set up

      await Share.share({
        message,
        url, // URL to the content
        title: `TravelPoints Görevi: ${challenge.title}` // Title of the content
      });
      return true;
    } catch (error) {
      console.error('Error sharing challenge:', error);
      // Alert.alert('Hata', 'Görev paylaşılırken bir sorun oluştu.'); // Optionally handle error in UI
      return false;
    }
  },
};
