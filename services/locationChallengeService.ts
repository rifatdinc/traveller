import { Challenge } from '@/types';
import { supabase } from '@/lib/supabase';
import { placesService } from './placesService';

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

const getRequirementText = (placeType: string) => {
  const type = placeType.toLowerCase();
  if (type.includes('müze') || type.includes('museum')) {
    return "müzeleri";
  } else if (type.includes('tarihi') || type.includes('historical')) {
    return "tarihi yerleri";
  } else if (type.includes('park')) {
    return "parkları";
  } else if (type.includes('doğa') || type.includes('nature')) {
    return "doğal güzellikleri";
  } else if (type.includes('restoran') || type.includes('restaurant')) {
    return "restoranları";
  } else if (type.includes('kafe') || type.includes('cafe')) {
    return "kafeleri";
  } else if (type.includes('spor') || type.includes('sport')) {
    return "spor tesislerini";
  } else if (type.includes('cami') || type.includes('mosque')) {
    return "camileri";
  } else if (type.includes('alışveriş') || type.includes('shopping')) {
    return "alışveriş yerlerini";
  }
  return "ilginç yerleri";
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

// Default types to use for location-based challenges when no specific places are found
const defaultPlaceTypes = [
  'müze', 'park', 'restoran', 'tarihi', 'kafe'
];

// Default place names for each type to create when no places exist
const defaultPlaceNames: Record<string, string[]> = {
  'müze': ['Şehir Müzesi', 'Arkeoloji Müzesi', 'Sanat Galerisi', 'Tarih Müzesi', 'Modern Sanat Müzesi'],
  'park': ['Merkez Parkı', 'Şehir Parkı', 'Botanik Bahçesi', 'Sahil Parkı', 'Doğa Parkı'],
  'restoran': ['Lezzet Durağı', 'Anadolu Mutfağı', 'Deniz Mahsülleri Restoranı', 'Kebapçı Mehmet', 'Geleneksel Lokanta'],
  'tarihi': ['Tarihi Kale', 'Eski Çarşı', 'Tarihi Cami', 'Antik Yapılar', 'Tarihi Köprü'],
  'kafe': ['Kahve Dünyası', 'Kitap & Kahve', 'Deniz Manzaralı Kafe', 'Tatlı Köşesi', 'Şehir Manzaralı Kafeterya']
};

// Helper function to create default places for a city - Updated to use real Google Places
const createDefaultPlacesForCity = async (city: string, type: string) => {
  try {
    console.log(`Creating places for ${type} in ${city}...`);
    const places = await placesService.createPlacesForCity(city, type);
    return places;
  } catch (error) {
    console.error(`Error in createDefaultPlacesForCity for ${city}:`, error);
    return [];
  }
};

// Create default location challenge with place-specific requirements
const createDefaultLocationChallenge = async (city: string) => {
  try {
    console.log(`Creating default challenges for ${city}...`);
    const challenges = [];
    
    // First, create default places for each type
    const createdPlacesByType: Record<string, any[]> = {};
    
    for (const type of defaultPlaceTypes) {
      console.log(`Creating default places for ${type} in ${city}...`);
      const places = await createDefaultPlacesForCity(city, type);
      if (places.length > 0) {
        createdPlacesByType[type] = places;
      }
    }
    
    // For each default type, create a challenge with place-specific requirements
    for (const type of defaultPlaceTypes) {
      const places = createdPlacesByType[type] || [];
      if (places.length === 0) {
        console.log(`No places created for ${type} in ${city}, skipping challenge`);
        continue;
      }
      
      const challengeTitle = getLocalizedChallengeTitle(type, city);
      const challengeDesc = getLocalizedChallengeDescription(type, city);
      
      // Create the challenge object with target place IDs
      const targetPlaces = places.slice(0, 3); // Use up to 3 places
      const targetPlaceIds = targetPlaces.map(place => place.id);
      
      const newChallenge: any = {
        title: challengeTitle,
        description: challengeDesc,
        points: Math.floor(Math.random() * 200) + 300, // 300-500 points
        image_url: getTypeImage(type),
        deadline: null, // Using null instead of 'Süresiz' for timestamp field
        is_daily: false,
        challenge_type: getChallengeTypeFromPlaceType(type),
        category: getCategoryFromPlaceType(type),
        difficulty: 'medium',
        target_count: Math.min(3, targetPlaces.length),
        target_place_ids: targetPlaceIds, // Store place IDs here
        valid_until: getValidUntilDate(),
        location: city
      };
      
      // Add to database
      const { data, error } = await supabase
        .from('challenges')
        .insert(newChallenge)
        .select()
        .single();
        
      if (error) {
        console.error(`Error creating default challenge for ${type} in ${city}:`, error);
      } else {
        console.log(`Created default ${type} challenge for ${city}`);
        challenges.push(data);
        
        // Add place-specific requirements for the challenge
        const placeRequirements = targetPlaces.map(place => ({
          challenge_id: data.id,
          description: `${place.name} mekanını ziyaret et`,
          type: 'visit_place',
          target_id: place.id,
          count: 1
        }));
        
        // Add a photo requirement
        placeRequirements.push({
          challenge_id: data.id,
          description: `${city}'deki ${getRequirementText(type)} fotoğrafla`,
          type: 'take_photo',
          target_id: null, // No specific target for this requirement
          count: 1
        });
        
        const { error: reqError } = await supabase
          .from('challenge_requirements')
          .insert(placeRequirements);
          
        if (reqError) {
          console.error(`Error creating requirements for challenge ${data.id}:`, reqError);
        } else {
          console.log(`Created ${placeRequirements.length} requirements for challenge ${data.id}`);
        }
        
        // Also create an entry in location_based_challenges table
        const locationChallenge = {
          title: challengeTitle,
          description: challengeDesc,
          image_url: getTypeImage(type),
          points: newChallenge.points,
          challenge_type: newChallenge.challenge_type,
          category: newChallenge.category,
          is_daily: false,
          deadline: null, // Using null instead of 'Süresiz'
          difficulty: 'medium',
          valid_until: new Date(getValidUntilDate())
        };
        
        const { error: locationError } = await supabase
          .from('location_based_challenges')
          .insert(locationChallenge);
          
        if (locationError) {
          console.error(`Error adding to location_based_challenges for ${city}:`, locationError);
        }
      }
    }
    
    // Create one special discovery challenge for the city with place-specific requirements
    // Get 3 random places from all created places
    const allCreatedPlaces = Object.values(createdPlacesByType).flat();
    if (allCreatedPlaces.length > 0) {
      const specialPlaces = allCreatedPlaces
        .sort(() => 0.5 - Math.random()) // Shuffle
        .slice(0, Math.min(3, allCreatedPlaces.length)); // Take up to 3
        
      const specialChallenge: any = {
        title: `${city} Kaşifi`,
        description: `${city}'i keşfet ve bu güzel şehrin tadını çıkar!`,
        points: 500,
        image_url: 'https://images.unsplash.com/photo-1569949381669-ecf31ae8e613',
        deadline: null, // Using null instead of 'Süresiz' for timestamp field
        is_daily: false,
        challenge_type: 'general',
        category: 'general',
        difficulty: 'medium',
        target_count: specialPlaces.length,
        target_place_ids: specialPlaces.map(p => p.id),
        valid_until: getValidUntilDate(),
        location: city
      };
      
      const { data: specialData, error: specialError } = await supabase
        .from('challenges')
        .insert(specialChallenge)
        .select()
        .single();
        
      if (specialError) {
        console.error(`Error creating special challenge for ${city}:`, specialError);
      } else {
        console.log(`Created special challenge for ${city}`);
        
        // Add place-specific requirements for the special challenge
        const specialRequirements = [];
        
        for (const place of specialPlaces) {
          specialRequirements.push({
            challenge_id: specialData.id,
            description: `${place.name} mekanını ziyaret et`,
            type: 'visit_place',
            target_id: place.id,
            count: 1
          });
          
          specialRequirements.push({
            challenge_id: specialData.id,
            description: `${place.name} mekanında bir fotoğraf çek ve paylaş`,
            type: 'take_photo',
            target_id: place.id,
            count: 1
          });
        }
        
        const { error: reqError } = await supabase
          .from('challenge_requirements')
          .insert(specialRequirements);
          
        if (reqError) {
          console.error(`Error creating requirements for special challenge ${specialData.id}:`, reqError);
        } else {
          console.log(`Created ${specialRequirements.length} requirements for special challenge ${specialData.id}`);
        }
        
        challenges.push(specialData);
        
        // Add to location_based_challenges table too
        const locationSpecialChallenge = {
          title: specialChallenge.title,
          description: specialChallenge.description,
          image_url: specialChallenge.image_url,
          points: specialChallenge.points,
          challenge_type: specialChallenge.challenge_type,
          category: specialChallenge.category,
          is_daily: false,
          deadline: null, // Using null instead of 'Süresiz'
          difficulty: 'medium',
          valid_until: new Date(getValidUntilDate())
        };
        
        await supabase.from('location_based_challenges').insert(locationSpecialChallenge);
      }
    }
    
    return challenges;
  } catch (error) {
    console.error(`Error in createDefaultLocationChallenge for ${city}:`, error);
    return [];
  }
};

// Location-based challenge service
export const locationChallengeService = {
  // Kullanıcının bulunduğu şehre göre görevleri getir
  getLocationBasedChallenges: async (city: string) => {
    try {
      console.log(`Fetching location-based challenges for ${city}...`);
      
      // Önce şehirdeki yerleri getir
      const { data: placesData, error: placesError } = await supabase
        .from('places')
        .select('id, name, type, city')
        .eq('city', city);
      
      if (placesError) {
        console.error(`Error fetching places in ${city}:`, placesError);
        return [];
      }

      // Eğer şehirde hiç yer yoksa, önce default yerleri oluştur, sonra görevleri
      if (!placesData || placesData.length === 0) {
        console.log(`No places found in ${city}, creating default places and challenges`);
        return await createDefaultLocationChallenge(city);
      }

      // Bu şehirdeki yerlerle ilgili mevcut görevleri getir
      const { data: existingChallenges, error: challengesError } = await supabase
        .from('challenges')
        .select('*')
        .eq('location', city)
        .order('created_at', { ascending: false });

      if (challengesError) {
        console.error(`Error fetching existing challenges for ${city}:`, challengesError);
        return [];
      }

      // Eğer bu şehir için görevler varsa onları döndür
      if (existingChallenges && existingChallenges.length > 0) {
        console.log(`Found ${existingChallenges.length} existing challenges for ${city}`);
        return existingChallenges as Challenge[];
      }

      // Şehirdeki yerlere göre yeni otomatik görevler oluştur
      console.log(`Creating new challenges based on ${placesData.length} places in ${city}`);
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
          
          // Maksimum 5 yer seç ve IDs'leri topla
          const targetPlaces = places.slice(0, 5);
          const targetPlaceIds = targetPlaces.map(p => p.id);
          
          const newChallenge: any = {
            title: challengeTitle,
            description: challengeDesc,
            points: Math.floor(Math.random() * 200) + 300, // 300-500 arası puan
            image_url: getTypeImage(type),
            deadline: null, // Using null instead of 'Süresiz' string
            is_daily: false,
            challenge_type: getChallengeTypeFromPlaceType(type),
            category: getCategoryFromPlaceType(type),
            difficulty: places.length > 5 ? 'hard' : (places.length > 3 ? 'medium' : 'easy'),
            target_count: Math.min(places.length, 5),
            target_place_ids: targetPlaceIds, // Storing place IDs array
            valid_until: getValidUntilDate(),
            location: city
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
            console.log(`Created challenge for ${type} in ${city}: ${data.title}`);
            
            // Görev gereksinimleri oluştur - her yer için özel bir gereksinim
            const requirements = targetPlaces.map(place => ({
              challenge_id: data.id,
              description: `${place.name} mekanını ziyaret et`,
              type: 'visit_place',
              target_id: place.id,
              count: 1
            }));
            
            // Fotoğraf çekme gereksinimleri ekle
            requirements.push({
              challenge_id: data.id,
              description: `${city}'deki ${getRequirementText(type)} fotoğrafla`,
              type: 'take_photo',
              target_id: null, // No specific target for this requirement
              count: 1
            });
            
            const { error: reqError } = await supabase
              .from('challenge_requirements')
              .insert(requirements);
              
            if (reqError) {
              console.error(`Error creating requirements for challenge ${data.id}:`, reqError);
            } else {
              console.log(`Created ${requirements.length} requirements for challenge ${data.id}`);
            }
            
            challenges.push(data);
          }
        }
      }
      
      // Şehir için en az bir özel görev oluştur
      if (placesData.length > 0) {
        // Rastgele 3 özel yer seç
        const specialPlaces = placesData.sort(() => 0.5 - Math.random()).slice(0, 3);
        const specialChallenge: any = {
          title: `${city} Kaşifi`,
          description: `${city}'in en özel yerlerini keşfet ve fotoğrafla!`,
          points: 500,
          image_url: 'https://images.unsplash.com/photo-1569949381669-ecf31ae8e613',
          deadline: null, // Using null instead of 'Süresiz' string
          is_daily: false,
          challenge_type: 'collection',
          category: 'culture',
          difficulty: 'medium',
          target_count: specialPlaces.length,
          target_place_ids: specialPlaces.map(p => p.id),
          valid_until: getValidUntilDate(),
          location: city
        };
        
        const { data, error } = await supabase
          .from('challenges')
          .insert(specialChallenge)
          .select()
          .single();
          
        if (error) {
          console.error(`Error creating special challenge for ${city}:`, error);
        } else {
          console.log(`Created special challenge for ${city}: ${data.title}`);
          
          // Görev gereksinimleri oluştur - her yer için ziyaret ve fotoğraf
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
          } else {
            console.log(`Created ${requirements.length} requirements for special challenge ${data.id}`);
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
