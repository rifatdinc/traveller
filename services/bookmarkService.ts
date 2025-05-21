import { supabase } from '@/lib/supabase';
import { Challenge } from '@/types'; // Assuming Challenge type is defined

export const addBookmarkedChallenge = async (userId: string, challengeId: string): Promise<boolean> => {
  if (!userId || !challengeId) {
    console.error('User ID and Challenge ID are required to add a bookmark.');
    return false;
  }
  try {
    const { error } = await supabase
      .from('user_bookmarked_challenges')
      .insert([{ user_id: userId, challenge_id: challengeId }]);

    if (error) {
      console.error('Error bookmarking challenge:', error.message);
      if (error.code === '23505') { // Unique violation
        console.warn('Challenge already bookmarked.');
        return true; // Or false, depending on desired behavior for duplicates
      }
      return false;
    }
    return true;
  } catch (err) {
    console.error('Unexpected error in addBookmarkedChallenge:', err);
    return false;
  }
};

export const removeBookmarkedChallenge = async (userId: string, challengeId: string): Promise<boolean> => {
  if (!userId || !challengeId) {
    console.error('User ID and Challenge ID are required to remove a bookmark.');
    return false;
  }
  try {
    const { error } = await supabase
      .from('user_bookmarked_challenges')
      .delete()
      .eq('user_id', userId)
      .eq('challenge_id', challengeId);

    if (error) {
      console.error('Error removing bookmark:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Unexpected error in removeBookmarkedChallenge:', err);
    return false;
  }
};

export const getBookmarkStatus = async (userId: string, challengeId: string): Promise<boolean> => {
  if (!userId || !challengeId) {
    // console.warn('User ID and Challenge ID are required to get bookmark status.');
    return false;
  }
  try {
    const { data, error } = await supabase
      .from('user_bookmarked_challenges')
      .select('id')
      .eq('user_id', userId)
      .eq('challenge_id', challengeId)
      .maybeSingle();

    if (error) {
      console.error('Error fetching bookmark status:', error.message);
      return false;
    }
    return !!data; // True if a record exists
  } catch (err) {
    console.error('Unexpected error in getBookmarkStatus:', err);
    return false;
  }
};

export const getUserBookmarkedChallengeIds = async (userId: string): Promise<string[]> => {
  if (!userId) {
    // console.warn('User ID is required to get bookmarked challenge IDs.');
    return [];
  }
  try {
    const { data, error } = await supabase
      .from('user_bookmarked_challenges')
      .select('challenge_id')
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user bookmarked challenge IDs:', error.message);
      return [];
    }
    return data?.map(bookmark => bookmark.challenge_id) || [];
  } catch (err) {
    console.error('Unexpected error in getUserBookmarkedChallengeIds:', err);
    return [];
  }
};

// Optional: If you need to fetch full bookmarked challenges
export const getUserBookmarkedChallenges = async (userId: string): Promise<Challenge[]> => {
    if (!userId) {
        console.error('User ID is required to get bookmarked challenges.');
        return [];
    }
    try {
        const { data, error } = await supabase
            .from('user_bookmarked_challenges')
            .select(`
                challenge_id,
                challenges (
                    id,
                    title,
                    description,
                    points,
                    image_url,
                    deadline,
                    challenge_type,
                    category,
                    location_lat,
                    location_lng,
                    location_name,
                    created_at,
                    user_id
                    // any other fields from challenges table
                )
            `)
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching user bookmarked challenges:', error.message);
            return [];
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return data?.map((bm: any) => bm.challenges as Challenge).filter(challenge => challenge !== null) || [];
    } catch (err) {
        console.error('Unexpected error in getUserBookmarkedChallenges:', err);
        return [];
    }
};
