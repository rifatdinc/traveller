import { supabase } from '@/lib/supabase';
import { Place } from '@/types'; // Assuming Place type is defined

export const addFavoritePlace = async (userId: string, placeId: string): Promise<boolean> => {
  if (!userId || !placeId) {
    console.error('User ID and Place ID are required to add a favorite.');
    return false;
  }
  try {
    const { data, error } = await supabase
      .from('user_favorite_places')
      .insert([{ user_id: userId, place_id: placeId }]);

    if (error) {
      console.error('Error adding favorite place:', error.message);
      // Handle potential duplicate entry error (e.g., user already favorited) gracefully
      if (error.code === '23505') { // Unique violation
        console.warn('Place already favorited.');
        return true; // Or false, depending on desired behavior for duplicates
      }
      return false;
    }
    return true;
  } catch (err) {
    console.error('Unexpected error in addFavoritePlace:', err);
    return false;
  }
};

export const removeFavoritePlace = async (userId: string, placeId: string): Promise<boolean> => {
  if (!userId || !placeId) {
    console.error('User ID and Place ID are required to remove a favorite.');
    return false;
  }
  try {
    const { error } = await supabase
      .from('user_favorite_places')
      .delete()
      .eq('user_id', userId)
      .eq('place_id', placeId);

    if (error) {
      console.error('Error removing favorite place:', error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Unexpected error in removeFavoritePlace:', err);
    return false;
  }
};

export const getFavoriteStatus = async (userId: string, placeId: string): Promise<boolean> => {
  if (!userId || !placeId) {
    // console.error('User ID and Place ID are required to get favorite status.');
    return false;
  }
  try {
    const { data, error } = await supabase
      .from('user_favorite_places')
      .select('id')
      .eq('user_id', userId)
      .eq('place_id', placeId)
      .maybeSingle(); // Returns one row or null

    if (error) {
      console.error('Error fetching favorite status:', error.message);
      return false;
    }
    return !!data; // True if a record exists, false otherwise
  } catch (err) {
    console.error('Unexpected error in getFavoriteStatus:', err);
    return false;
  }
};

export const getUserFavoritePlaces = async (userId: string): Promise<Place[]> => {
  if (!userId) {
    console.error('User ID is required to get favorite places.');
    return [];
  }
  try {
    const { data, error } = await supabase
      .from('user_favorite_places')
      .select(`
        place_id,
        places (
          id,
          google_place_id,
          name,
          address,
          latitude,
          longitude,
          photo_url,
          icon,
          rating,
          created_at,
          category,
          description,
          is_step_free_access,
          is_braille_available,
          is_audio_guide_available,
          is_visual_guide_available,
          is_accessible_restroom_available,
          is_wheelchair_accessible_elevator_available,
          has_accessible_parking,
          has_hearing_loop,
          user_id 
        )
      `)
      .eq('user_id', userId);

    if (error) {
      console.error('Error fetching user favorite places:', error.message);
      return [];
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return data?.map((fav: any) => fav.places as Place).filter(place => place !== null) || [];
  } catch (err) {
    console.error('Unexpected error in getUserFavoritePlaces:', err);
    return [];
  }
};

// Function to get just the IDs of favorite places for quicker checks
export const getUserFavoritePlaceIds = async (userId: string): Promise<string[]> => {
    if (!userId) {
        // console.warn('User ID is required to get favorite place IDs. Returning empty array.');
        return [];
    }
    try {
        const { data, error } = await supabase
            .from('user_favorite_places')
            .select('place_id')
            .eq('user_id', userId);

        if (error) {
            console.error('Error fetching user favorite place IDs:', error.message);
            return [];
        }
        return data?.map(fav => fav.place_id) || [];
    } catch (err) {
        console.error('Unexpected error in getUserFavoritePlaceIds:', err);
        return [];
    }
};
