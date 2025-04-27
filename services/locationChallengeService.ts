import { supabase } from '@/lib/supabase';
import { Challenge } from '@/types';

// Helper functions for location-based challenges
const getLocalizedChallengeTitle = (placeType: string, city: string) => {
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
};

const getLocalizedChallengeDescription = (placeType: string, city: string) => {
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
};

const getTypeImage = (placeType: string) => {
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
};

const getChallengeTypeFromPlaceType = (placeType: string) => {
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
};

const getCategoryFromPlaceType = (placeType: string) => {
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
};

const getValidUntilDate = () => {
  const date = new Date();
  date.setMonth(date.getMonth() + 3);
  return date.toISOString();
};

// Location-based challenge service
export const locationChallengeService = {
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
          const challengeTitle = getLocalizedChallengeTitle(type, city);
          const challengeDesc = getLocalizedChallengeDescription(type, city);
          
          const newChallenge: any = {
            title: challengeTitle,
            description: challengeDesc,
            points: Math.floor(Math.random() * 200) + 300, // 300-500 arası puan
            image_url: getTypeImage(type),
            deadline: 'Süresiz',
            is_daily: false,
            challenge_type: getChallengeTypeFromPlaceType(type),
            category: getCategoryFromPlaceType(type),
            difficulty: places.length > 5 ? 'hard' : (places.length > 3 ? 'medium' : 'easy'),
            target_count: Math.min(places.length, 5),
            target_place_ids: places.slice(0, 5).map(p => p.id), // En fazla 5 yer
            valid_until: getValidUntilDate(),
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

  // Belirli bir placeId ile ilgili görevlerin tümünü getir
  getChallengesForPlace: async (placeId: string) => {
    try {
      const { data, error } = await supabase
        .from('challenges')
        .select('*')
        .filter('target_place_ids', 'cs', `{${placeId}}`)
        .order('created_at', { ascending: false });

      if (error) {
        console.error(`Error fetching challenges for place ${placeId}:`, error);
        return [];
      }

      return data as Challenge[] || [];
    } catch (error) {
      console.error(`Error in getChallengesForPlace:`, error);
      return [];
    }
  }
};
