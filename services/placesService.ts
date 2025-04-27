import { supabase } from '@/lib/supabase';

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
