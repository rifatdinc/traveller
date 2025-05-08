import { supabase } from '@/lib/supabase';
import axios from 'axios';
import { GOOGLE_API_KEY, findPlaceFromTextQuery } from '@/lib/googleMapsService';

// Yarıçapı metreyi dereceye çevirmek için yardımcı fonksiyon
const metersToDecimalDegrees = (meters: number, latitude: number) => {
  // Dünya'nın yarıçapı (metre cinsinden)
  const earthRadius = 6378137;
  
  // Enlem için yaklaşık derece hesabı
  const latDegrees = (meters / earthRadius) * (180 / Math.PI);
  
  // Boylam için yaklaşık derece hesabı (enlem etkisi ile)
  const lngDegrees = latDegrees / Math.cos(latitude * Math.PI / 180);
  
  return { latDegrees, lngDegrees };
};

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
    const { data, error } = await supabase        .from('places')
        .select('*')
        .eq('city', city)
        .gte('rating', 3.8)  // Sadece 3.8 ve üzeri puanlı yerleri getir
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
  },

  // Belirli bir konumun çevresindeki yerleri getir
  getNearbyPlaces: async (latitude: number, longitude: number, radiusInMeters: number) => {
    // Metreyi dereceye çevir
    const { latDegrees, lngDegrees } = metersToDecimalDegrees(radiusInMeters, latitude);
    
    try {
      const { data, error } = await supabase
        .from('places')
        .select('*')
        .gte('latitude', latitude - latDegrees)
        .lte('latitude', latitude + latDegrees)
        .gte('longitude', longitude - lngDegrees)
        .lte('longitude', longitude + lngDegrees)
        .order('rating', { ascending: false });

      if (error) {
        console.error('Error fetching nearby places:', error);
        return [];
      }

      // Tam mesafe hesaplaması için Haversine formülü
      const nearbyPlaces = data.filter(place => {
        const distance = getDistanceFromLatLonInMeters(
          latitude,
          longitude,
          place.latitude,
          place.longitude
        );
        return distance <= radiusInMeters;
      });

      return nearbyPlaces;
    } catch (error) {
      console.error('Error in getNearbyPlaces:', error);
      return [];
    }
  },

  // Google Places API'den yer ara
  findPlaceWithGoogle: async (placeName: string, city: string) => {
    try {
      const result = await findPlaceFromTextQuery(`${placeName} ${city}`);
      if (!result) {
        console.log(`No Google Place found for: ${placeName} in ${city}`);
        return null;
      }
      return result;
    } catch (error) {
      console.error('Error finding place with Google:', error);
      return null;
    }
  },

  // Varsayılan yerleri oluştur (Antalya/Muratpaşa'daki gerçek yerler)
  createDefaultPlaces: async (city: string, district: string) => {
    const defaultPlaces = {
      müze: [
        'Antalya Müzesi',
        'Suna İnan Kıraç Kaleiçi Müzesi',
        'Oyuncak Müzesi',
        'Atatürk Evi Müzesi',
        'Antalya Etnografya Müzesi'
      ],
      park: [
        'Karaalioglu Parkı',
        'Atatürk Kültür Parkı',
        'Botanik Parkı',
        'Karaalioğlu Parkı',
        'Yakın Çevre Parkı'
      ],
      restoran: [
        '7 Mehmet',
        'Club Arma',
        'Vanilla Restaurant',
        'Big Chef Restaurant Muratpaşa',
        'Çakırlar Köy Sofrası'
      ],
      tarihi: [
        'Hadrian Kapısı',
        'Kesik Minare Cami',
        'Hıdırlık Kulesi',
        'Yivli Minare',
        'Kaleiçi'
      ],
      kafe: [
        'Starbucks Muratpaşa',
        'Express Cafe',
        'Kahve Dünyası Muratpaşa',
        'Çınaraltı Cafe',
        'Shakespeare Coffee & Bistro'
      ]
    };

    for (const [type, places] of Object.entries(defaultPlaces)) {
      console.log(`Creating default places for ${type} in ${district}...`);
      
      for (const placeName of places) {
        try {
          // Önce Google'dan yeri bul
          const googlePlace = await placesService.findPlaceWithGoogle(placeName, `${district}, ${city}`);
          
          if (!googlePlace) {
            console.log(`No Google Place found for: ${placeName}`);
            continue;
          }

          // Yeni yer oluştur
          const newPlace = {
            name: googlePlace.name,
            type: type,
            google_place_id: googlePlace.place_id,
            points: 100,
            latitude: googlePlace.geometry.location.lat,
            longitude: googlePlace.geometry.location.lng,
            city: district,
            description: googlePlace.vicinity || googlePlace.formatted_address || `${placeName} - ${district}, ${city}`,
            image_url: googlePlace.photos?.[0]?.photo_reference 
              ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${googlePlace.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`
              : 'https://via.placeholder.com/800x600',
            rating: googlePlace.rating || 4.0,
            location: `POINT(${googlePlace.geometry.location.lng} ${googlePlace.geometry.location.lat})`
          };

          const { data, error } = await supabase
            .from('places')
            .insert([newPlace])
            .select()
            .single();

          if (error) {
            if (error.code === '23505') { // Unique violation
              console.log(`Place already exists: ${placeName}`);
            } else {
              console.error(`Error creating default place ${placeName}:`, error);
            }
          } else {
            console.log(`Successfully created place: ${placeName}`);
          }
        } catch (error) {
          console.error(`Error creating default place ${placeName}:`, error);
        }
      }
    }
  },

  // Bir şehirdeki popüler yerleri Google Places API'den al ve veritabanına ekle
  createPlacesForCity: async (city: string, district: string) => {
    const placeTypes = {
      'museum|art_gallery': 'müze',
      'park': 'park',
      'restaurant': 'restoran',
      'tourist_attraction|historic_site': 'tarihi',
      'cafe': 'kafe'
    };

    console.log(`Creating places for ${district}, ${city}...`);
    const addedPlaces = [];

    // Her tip için Google Places API'den yer ara
    for (const [googleTypes, type] of Object.entries(placeTypes)) {
      console.log(`Searching for ${type} places in ${district}...`);
      
      try {
        // Google'dan yerleri getir - her tip için en iyi 5 sonucu al
        const query = `${googleTypes.split('|')[0]} in ${district}, ${city}`;
        const response = await axios.get(
          'https://maps.googleapis.com/maps/api/place/textsearch/json',
          {
            params: {
              query,
              type: googleTypes.split('|')[0],
              key: GOOGLE_API_KEY,
              language: 'tr',
              radius: 5000 // 5km yarıçap
            }
          }
        );

        if (response.data.status === 'OK' && response.data.results) {
          // 3.8 ve üzeri puana sahip en iyi 5 sonucu al
          const places = response.data.results
            .filter(place => place.rating >= 3.8)
            .slice(0, 5);
          
          for (const place of places) {
            try {
              // Yeni yer oluştur
              const newPlace = {
                name: place.name,
                type: type,
                google_place_id: place.place_id,
                points: Math.floor((place.rating || 4.0) * 100), // Rating'e göre puan
                latitude: place.geometry.location.lat,
                longitude: place.geometry.location.lng,
                city: district,
                description: place.formatted_address || `${place.name} - ${district}, ${city}`,
                image_url: place.photos?.[0]?.photo_reference 
                  ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`
                  : 'https://via.placeholder.com/800x600',
                rating: place.rating || 4.0,
                location: `POINT(${place.geometry.location.lng} ${place.geometry.location.lat})`
              };

              // Veritabanına ekle
              const { data, error } = await supabase
                .from('places')
                .insert([newPlace])
                .select()
                .single();

              if (error) {
                if (error.code === '23505') { // Unique violation
                  console.log(`Place already exists: ${place.name}`);
                } else {
                  console.error(`Error creating place ${place.name}:`, error);
                }
              } else {
                console.log(`Successfully created place: ${place.name}`);
                addedPlaces.push(data);
              }
            } catch (error) {
              console.error(`Error creating place ${place.name}:`, error);
            }
          }
        } else {
          console.log(`No ${type} places found in ${district}`);
        }
      } catch (error) {
        console.error(`Error searching for ${type} places:`, error);
      }
    }

    return addedPlaces;
  },

};

// İki nokta arasındaki mesafeyi metre cinsinden hesapla (Haversine formülü)
function getDistanceFromLatLonInMeters(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371e3; // Dünya'nın yarıçapı (metre)
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
          Math.cos(φ1) * Math.cos(φ2) *
          Math.sin(Δλ/2) * Math.sin(Δλ/2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const d = R * c;

  return d; // metre cinsinden mesafe
}
