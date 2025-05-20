import axios from 'axios';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { decode } from 'base64-arraybuffer';

// Google Maps API anahtarı
// NOT: Bu anahtarı kullanmadan önce Google Cloud Console'da doğru API'lerin
// (Maps, Places, Geocoding vb.) etkinleştirildiğinden ve uygulama paket adının
// kısıtlamalarda doğru yapılandırıldığından emin olun
export const GOOGLE_API_KEY = 'AIzaSyCXyczc8T58aJ7Mxn71zOzErkpGCHv2vD0';

// Type tanımlamaları
export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export interface NearbyPlace {
  id: string;
  place_id: string;
  name: string;
  vicinity: string;
  rating?: number;
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  geometry: {
    location: {
      lat: number;
      lng: number;
    }
  };
  types: string[];
}

export interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface GooglePlaceDetails {
  place_id: string;
  name: string;
  formatted_address: string;
  address_components: AddressComponent[];
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  rating?: number;
  photos?: Array<{
    photo_reference: string;
    height: number;
    width: number;
  }>;
  types: string[];
  vicinity?: string;
  editorial_summary?: {
    overview: string;
  };
}

export interface PlacePrediction {
  place_id: string;
  description: string;
}

// Search places using Google Places Autocomplete
export interface PlaceAutocompleteResult {
  place_id: string;
  description: string;
}

// Kullanıcının konumunu almak için
export async function getCurrentLocation(): Promise<LocationCoords | null> {
  try {
    // Konum erişim izni iste
    const { status } = await Location.requestForegroundPermissionsAsync();
    
    if (status !== 'granted') {
      console.error('Konum izni verilmedi');
      return null;
    }

    // Güncel konumu al (daha düşük hassasiyet için Balanced kullanıyoruz)
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Konum alınamadı:', error);
    return null;
  }
}

// Add this to your imports is already handled as axios is imported at the top
// ... (other functions like getCurrentLocation, searchNearbyPlaces, etc.)

export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  if (!GOOGLE_API_KEY) {
    console.error('Google API Key is not configured.');
    return null;
  }
  const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_API_KEY}&language=tr`;
  try {
    const response = await axios.get(url);
    if (response.data.status === 'OK' && response.data.results.length > 0) {
      const results = response.data.results;
      // Look for 'locality' or 'administrative_area_level_1' for city
      for (const result of results) {
        for (const component of result.address_components) {
          if (component.types.includes('locality') || component.types.includes('administrative_area_level_1')) {
            return component.long_name;
          }
        }
      }
      // Fallback if specific components not found, try a broader one or return null
      if (results[0]?.address_components?.length > 0) {
        // Attempt to find a suitable component or default to a broader area
        const cityComponent = results[0].address_components.find(
          (c: any) => c.types.includes('administrative_area_level_2') || c.types.includes('postal_town')
        );
        if (cityComponent) return cityComponent.long_name;
      }
      console.warn('City not found in reverse geocode response for:', latitude, longitude);
      return null;
    } else {
      console.error('Reverse geocoding failed:', response.data.status, response.data.error_message);
      return null;
    }
  } catch (error) {
    console.error('Error during reverse geocoding request:', error);
    return null;
  }
}

// Belirli bir konumun çevresindeki yerleri arama
export async function searchNearbyPlaces(location: LocationCoords, radius = 5000, type?: string): Promise<NearbyPlace[]> {
  try {
    if (!location) {
      console.error('[searchNearbyPlaces] No valid location provided');
      return [];
    }

    // Önce veritabanında ara (yaklaşık metre -> derece dönüşümü için 111000 kullan)
    console.log(`[searchNearbyPlaces] Searching in database first for type: ${type || 'all'}`);
    const dbPlaces = await checkPlaceInDatabase(location.latitude, location.longitude, radius / 111000);
    if (dbPlaces.length > 0) {
      console.log(`[searchNearbyPlaces] Found ${dbPlaces.length} places in database`);
      return dbPlaces.map(place => ({
        id: place.id,
        name: place.name,
        vicinity: place.description,
        rating: place.rating || 0,
        photos: place.image_url ? [{
          photo_reference: place.image_url,
          height: 400, // Default height
          width: 400   // Default width
        }] : undefined,
        place_id: place.google_place_id || place.id,
        geometry: {
          location: {
            lat: place.latitude,
            lng: place.longitude
          }
        },
        types: [place.type]
      }));
    }

    // Veritabanında yer bulunamazsa Google API'yi kullan
    const endpoint = `https://maps.googleapis.com/maps/api/place/nearbysearch/json`;
    const params: any = {
      location: `${location.latitude},${location.longitude}`,
      radius,
      key: GOOGLE_API_KEY,
      language: 'tr',
    };
    
    // Eğer belirli bir tür belirtilmişse, onu kullan
    if (type) {
      params.type = type;
    } else {
      // Değilse, turistik yerleri bulmak için anahtar kelimeler kullan
      params.keyword = 'tourist attraction museum historical landmark art gallery park nightlife restaurant cafe shopping mall';
    }

    console.log(`[searchNearbyPlaces] Searching with radius: ${radius}m`);
    const response = await axios.get(endpoint, { params });

    if (response.data.status === 'REQUEST_DENIED') {
      console.error('Google Places API isteği reddedildi:', response.data.error_message);
      throw new Error(`API isteği reddedildi: ${response.data.error_message || 'Bilinmeyen hata'}`);
    }

    if (response.data.status === 'ZERO_RESULTS') {
      console.log(`[searchNearbyPlaces] No results found within ${radius}m radius`);
      return [];
    }

    if (response.data.status !== 'OK') {
      console.error('Google Places API hatası:', response.data.status);
      throw new Error(`API hatası: ${response.data.status}`);
    }

    const allPlaces: NearbyPlace[] = response.data.results || [];
    console.log(`[searchNearbyPlaces] Found ${allPlaces.length} places`);

    // Yerleri puana göre filtrele (3.8 ve üzeri ve fotoğrafı olan yerler)
    const filteredPlaces = allPlaces.filter((place: NearbyPlace) => 
      (place.rating ?? 0) >= 3.5 && (place.photos?.length ?? 0) > 0);

    // Filtrelenmiş yerleri tekrar puana göre sırala (en yüksek puanlılar önce)
    filteredPlaces.sort((a: NearbyPlace, b: NearbyPlace) => (b.rating ?? 0) - (a.rating ?? 0));

    // Google API'den gelen yerleri veritabanına kaydet
    try {
      // Kullanıcının konumundan şehir bilgisini al
      const city = await getCityFromCoordinates(location.latitude, location.longitude);
      console.log('[searchNearbyPlaces] Found city:', city);
      
      // Yerleri paralel olarak veritabanına kaydet
      await Promise.all(filteredPlaces.map(place => createPlaceFromGoogleData(place, city)));
      console.log('[searchNearbyPlaces] Successfully saved places to database');
    } catch (error) {
      console.error('[searchNearbyPlaces] Error saving places to database:', error);
      // Hata olsa bile devam et, en azından Google'dan gelen sonuçları gösterelim
    }

    return filteredPlaces;
  } catch (error) {
    console.error('Yakındaki yerler aranırken hata oluştu:', error);
    
    // Hata iletişimi geliştir
    if (axios.isAxiosError(error)) {
      console.error('API yanıt hatası:', error.response?.data);
    }
    
    return [];
  }
}

// Google Maps API'dan gelen verileri kullanarak veritabanına yer eklemek için
export async function createPlaceFromGoogleData(place: NearbyPlace, city: string) {
  try {
    // Fetch Place Details to get more info like editorial_summary
    const detailsUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${place.place_id}&fields=name,geometry,vicinity,type,rating,photo,editorial_summary,formatted_address&key=${GOOGLE_API_KEY}&language=tr`; // Added language=tr
    let placeDetails: GooglePlaceDetails = {
      place_id: place.place_id,
      name: place.name,
      formatted_address: place.vicinity || '',
      address_components: [],
      geometry: place.geometry,
      rating: place.rating,
      photos: place.photos,
      types: place.types,
      vicinity: place.vicinity
    };
    try {
      const detailsResponse = await axios.get(detailsUrl);
      if (detailsResponse.data.result) {
        // Merge details with nearby data, ensuring geometry and photos are handled correctly
        placeDetails = {
           ...place, // Keep original nearby data
           ...detailsResponse.data.result, // Overwrite with details
           geometry: detailsResponse.data.result.geometry || place.geometry, // Ensure geometry exists
           photos: detailsResponse.data.result.photos || place.photos, // Ensure photos exist
        };
      }
    } catch (detailsError) {
      console.warn(`[createPlaceFromGoogleData] Could not fetch details for ${place.place_id}:`, detailsError);
      // Continue with nearby search data if details fetch fails
    }

    console.log('[createPlaceFromGoogleData] Creating new place:', placeDetails.name);
    // Önce bu yer veritabanında var mı kontrol et
    const { data: existingPlaces } = await supabase
      .from('places')
      .select('id') // Select only id for checking existence
      .eq('google_place_id', placeDetails.place_id)
      .maybeSingle(); // Use maybeSingle to handle null case gracefully

    if (existingPlaces) {
      console.log('[createPlaceFromGoogleData] Place already exists in database');
      // Fetch the full existing place data to return it
       const { data: fullExistingPlace } = await supabase
         .from('places')
         .select('*')
         .eq('id', existingPlaces.id)
         .single();
      return fullExistingPlace;
    }

    // Yer türlerini analiz et (placeDetails üzerinden)
    let placeType = 'genel';
    if (placeDetails.types.includes('museum')) placeType = 'müze';
    else if (placeDetails.types.includes('park')) placeType = 'park';
    else if (placeDetails.types.includes('restaurant')) placeType = 'restoran';
    else if (placeDetails.types.includes('cafe')) placeType = 'kafe';
    // Use 'historic_site' or 'historical_landmark' if available from details
    else if (placeDetails.types.includes('historic_site') || placeDetails.types.includes('historical_landmark')) placeType = 'tarihi';
    else if (placeDetails.types.includes('shopping_mall')) placeType = 'alışveriş';
    else if (placeDetails.types.includes('art_gallery')) placeType = 'sanat';
    else if (placeDetails.types.includes('mosque') || placeDetails.types.includes('church') || placeDetails.types.includes('place_of_worship')) placeType = 'dini';

    // Fotoğrafı belirle ve Supabase Storage'a kaydet (placeDetails üzerinden)
    let photoUrl = 'https://images.unsplash.com/photo-1518982217067-65d51c4f4fdf?q=80&w=800'; // Default image

    if (placeDetails.photos && placeDetails.photos.length > 0) {
      const googlePhotoUrl = `https://maps.googleapis.com/maps/api/place/photo?maxwidth=800&photoreference=${placeDetails.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`;
      try {
        // Use placeDetails.place_id for unique naming
        const uploadedUrl = await uploadPhotoToStorage(googlePhotoUrl, `place_${placeDetails.place_id}_${Date.now()}.jpg`);
        if (uploadedUrl) {
          photoUrl = uploadedUrl;
        }
      } catch (error) {
        console.error('[createPlaceFromGoogleData] Error uploading photo:', error);
        // Hata durumunda varsayılan fotoğrafı kullanmaya devam et
      }
    }

    // Yeni yer nesnesi oluştur (placeDetails üzerinden)
    const newPlaceData = {
      name: placeDetails.name,
      type: placeType,
      points: 100, // Varsayılan puan
      latitude: placeDetails.geometry.location.lat,
      longitude: placeDetails.geometry.location.lng,
      city: city,
      // Use editorial summary if available, otherwise fallback to vicinity or default text
      description: placeDetails.editorial_summary?.overview || placeDetails.vicinity || `${placeDetails.name} hakkında bilgi bulunamadı.`,
      image_url: photoUrl,
      rating: placeDetails.rating || 4.0,
      // Ensure location is correctly formatted for PostGIS
      location: `POINT(${placeDetails.geometry.location.lng} ${placeDetails.geometry.location.lat})`,
      google_place_id: placeDetails.place_id,
      address: placeDetails.formatted_address, // Add formatted address if available
      // Add other fields to match your 'places' table schema if needed
      // visited_by: 0, // Example: initialize visit count
    };

    // Veritabanına ekle
    const { data: insertedData, error: insertError } = await supabase
      .from('places')
      .insert(newPlaceData)
      .select() // Select the inserted row
      .single();

    if (insertError) {
      console.error('Yeni yer eklenirken hata oluştu:', insertError);
      // Handle potential duplicate google_place_id error more gracefully
      if (insertError.code === '23505' && insertError.message.includes('google_place_id')) { // Unique violation on google_place_id
        console.warn(`Place with google_place_id ${newPlaceData.google_place_id} likely already exists.`);
        // Fetch and return the existing place again
        const { data: existingData } = await supabase
          .from('places')
          .select('*')
          .eq('google_place_id', newPlaceData.google_place_id)
          .single();
        return existingData || null;
      }
      return null;
    }

    console.log(`Yeni yer başarıyla eklendi: ${insertedData.name} (${city})`);
    return insertedData; // Return the newly inserted place data
  } catch (error) {
    console.error('Yer oluşturulurken hata:', error);
    return null;
  }
}

// Yer fotoğrafı almak için
export function getPlacePhoto(photoReference: string, maxWidth = 400): string {
  if (!photoReference) {
    return 'https://images.unsplash.com/photo-1518982217067-65d51c4f4fdf?q=80&w=400'; // Varsayılan fotoğraf
  }
  
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${GOOGLE_API_KEY}`;
}

// Google Maps API'sinden iki nokta arasındaki rotayı alma
export async function getDirections(origin: string, destination: string) {
  try {
    const endpoint = 'https://maps.googleapis.com/maps/api/directions/json';
    const params = {
      origin,
      destination,
      key: GOOGLE_API_KEY,
      language: 'tr',
      alternatives: true, // Alternatif rotaları da getir
      mode: 'driving' // Sürüş modu (walking, bicycling, transit da olabilir)
    };
    
    console.log(`[getDirections] Fetching directions from ${origin} to ${destination}`);
    const response = await axios.get(endpoint, { params });
    
    if (response.data.status !== 'OK') {
      console.error('Google Directions API hatası:', response.data.status);
      throw new Error(`Rota API hatası: ${response.data.status}`);
    }
    
    return response.data;
  } catch (error) {
    console.error('Rota alınırken hata oluştu:', error);
    
    if (axios.isAxiosError(error)) {
      console.error('API yanıt hatası:', error.response?.data);
    }
    
    throw error;
  }
}

// Google Maps'in kodlanmış poliline'ını çözerek koordinat dizisine dönüştürme
export function decodePolyline(encoded: string): Array<{latitude: number, longitude: number}> {
  const points = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let b, shift = 0, result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5
    });
  }
  return points;
}

// Rota üzerindeki yerleri Google'dan doğrudan arama
export async function searchPlacesAlongRoute(routePoints: Array<{latitude: number, longitude: number}>, radius = 5000): Promise<NearbyPlace[]> {
  try {
    // Rotadaki her ikinci noktadan itibaren yerler ara (arama sayısını azaltmak için)
    const searchPoints = routePoints.filter((_, index) => index % 20 === 0);
    let allPlaces: NearbyPlace[] = [];
    
    // Her nokta için bağımsız arama yapıp sonuçları birleştir
    console.log(`[searchPlacesAlongRoute] Searching places along ${searchPoints.length} points on the route`);
    
    for (const point of searchPoints) {
      const location = {
        latitude: point.latitude,
        longitude: point.longitude
      };
      
      const pointPlaces = await searchNearbyPlaces(location, radius);
      
      // Tekrarlanan yerleri engelle (id'ye göre)
      pointPlaces.forEach(place => {
        if (!allPlaces.some(p => p.id === place.id)) {
          allPlaces.push(place);
        }
      });
    }
    
    // En iyi yerleri puanına göre sırala ve ilk 15'i al
    allPlaces.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    return allPlaces.slice(0, 15);
    
  } catch (error) {
    console.error('Rota üzerindeki yerler aranırken hata oluştu:', error);
    return [];
  }
}

// Veritabanında yer kontrolü - Daha hassas arama için PostGIS kullan
async function checkPlaceInDatabase(latitude: number, longitude: number, radius: number = 0.01): Promise<any[]> {
  try {
    const { data, error } = await supabase
      .from('places')
      .select('*')
      .or(`and(latitude.gte.${latitude - radius},latitude.lte.${latitude + radius},longitude.gte.${longitude - radius},longitude.lte.${longitude + radius})`)
      .order('rating', { ascending: false });

    if (error) {
      console.error('[checkPlaceInDatabase] Database query error:', error);
      return [];
    }

    console.log(`[checkPlaceInDatabase] Found ${data?.length || 0} places in database`);
    return data || [];
  } catch (error) {
    console.error('[checkPlaceInDatabase] Error:', error);
    return [];
  }
}

// Fotoğrafı Supabase Storage'a kaydet
async function uploadPhotoToStorage(photoUrl: string, placeId: string): Promise<string | null> {
  try {
    console.log('[uploadPhotoToStorage] Processing photo for place:', placeId);

    // İlk olarak bucket'ta bu yer için klasör var mı kontrol et
    const { data: existingFiles } = await supabase.storage
      .from('place-photos')
      .list(placeId);

    if (existingFiles && existingFiles.length > 0) {
      const existingFile = existingFiles[0];
      const { data: existingUrl } = supabase.storage
        .from('place-photos')
        .getPublicUrl(`${placeId}/${existingFile.name}`);
      
      console.log('[uploadPhotoToStorage] Using existing photo');
      return existingUrl.publicUrl;
    }

    // Google Photos'dan fotoğrafı indir
    console.log('[uploadPhotoToStorage] Downloading photo from Google Places API...');
    const response = await axios.get(photoUrl, { 
      responseType: 'arraybuffer',
      headers: {
        'Accept': 'image/jpeg, image/png, image/webp'
      }
    });

    // Dosya adını oluştur
    const timestamp = new Date().getTime();
    const fileName = `${placeId}/${timestamp}.jpg`;

    // ArrayBuffer'ı base64'e çevir ve yükle
    const base64String = arrayBufferToBase64(response.data);
    
    console.log('[uploadPhotoToStorage] Uploading photo to Supabase Storage...');
    const { data, error } = await supabase.storage
      .from('place-photos')
      .upload(fileName, decode(base64String), {
        contentType: 'image/jpeg',
        cacheControl: '3600',
        upsert: true
      });

    if (error) {
      console.error('[uploadPhotoToStorage] Upload error:', error);
      return null;
    }

    if (error) {
      console.error('[uploadPhotoToStorage] Upload error:', error);
      throw error;
    }

    // Public URL'i al
    const { data: publicUrl } = supabase.storage
      .from('place-photos')
      .getPublicUrl(fileName);

    console.log('[uploadPhotoToStorage] Successfully uploaded photo:', publicUrl.publicUrl);
    return publicUrl.publicUrl;
  } catch (error) {
    console.error('[uploadPhotoToStorage] Error:', error);
    return null;
  }
}

// ArrayBuffer'ı base64'e çeviren yardımcı fonksiyon
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// Koordinatlardan şehir bilgisini al
export async function getCityFromCoordinates(latitude: number, longitude: number): Promise<string> {
  try {
    console.log('[getCityFromCoordinates] Getting city info for:', latitude, longitude);
    const endpoint = 'https://maps.googleapis.com/maps/api/geocode/json';
    const response = await axios.get(endpoint, {
      params: {
        latlng: `${latitude},${longitude}`,
        key: GOOGLE_API_KEY,
        language: 'tr',
        result_type: 'locality|administrative_area_level_1' // Şehir veya il düzeyinde sonuç iste
      }
    });

    if (response.data.status !== 'OK') {
      console.error('[getCityFromCoordinates] Geocoding API error:', response.data.status);
      return 'unknown';
    }

    const results = response.data.results;
    if (!results || results.length === 0) {
      console.log('[getCityFromCoordinates] No results found');
      return 'unknown';
    }

    // Şehir adını bul
    for (const result of results) {
      for (const component of result.address_components) {
        if (component.types.includes('locality') || 
            component.types.includes('administrative_area_level_1')) {
          console.log('[getCityFromCoordinates] Found city:', component.long_name);
          return component.long_name;
        }
      }
    }

    return 'unknown';
  } catch (error) {
    console.error('[getCityFromCoordinates] Error:', error);
    return 'unknown';
  }
}

// Metin araması ile belirli bir yeri arama
export async function findPlaceFromTextQuery(query: string): Promise<NearbyPlace | null> {
  try {
    console.log('[findPlaceFromTextQuery] Searching for:', query);
    const endpoint = 'https://maps.googleapis.com/maps/api/place/findplacefromtext/json';
    const response = await axios.get(endpoint, {
      params: {
        input: query,
        inputtype: 'textquery',
        fields: 'place_id,name,formatted_address,geometry,rating,photos',
        key: GOOGLE_API_KEY,
        language: 'tr'
      }
    });

    if (response.data.status === 'ZERO_RESULTS') {
      console.log('[findPlaceFromTextQuery] No results found for:', query);
      return null;
    }

    if (response.data.status !== 'OK') {
      console.error('[findPlaceFromTextQuery] API error:', response.data.status);
      throw new Error(`API error: ${response.data.status}`);
    }

    if (!response.data.candidates || response.data.candidates.length === 0) {
      console.log('[findPlaceFromTextQuery] No candidates found for:', query);
      return null;
    }

    const place = response.data.candidates[0];
    return {
      id: place.place_id,
      name: place.name,
      vicinity: place.formatted_address,
      rating: place.rating,
      photos: place.photos,
      geometry: place.geometry,
      types: ['point_of_interest'], // Default type
      place_id: place.place_id
    };
  } catch (error) {
    console.error('[findPlaceFromTextQuery] Error:', error);
    if (axios.isAxiosError(error)) {
      console.error('API response error:', error.response?.data);
    }
    return null;
  }
}

// Get place details using Google Places Details API
export async function getPlaceDetails(placeId: string): Promise<GooglePlaceDetails | null> {
  if (!placeId) return null;
  
  try {
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=name,formatted_address,address_components,geometry,rating,photos,types,vicinity,editorial_summary&key=${GOOGLE_API_KEY}&language=tr`
    );

    if (response.data.result) {
      return response.data.result as GooglePlaceDetails;
    }
    
    return null;
  } catch (error) {
    console.error('Error getting place details:', error);
    return null;
  }
}

// Search places using Google Places Autocomplete
export async function searchPlaces(query: string): Promise<PlaceAutocompleteResult[]> {
  if (!query) return [];
  
  try {
    const response = await axios.get(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${GOOGLE_API_KEY}&types=(cities)&language=tr`
    );

    if (response.data.predictions) {
      return response.data.predictions.map((prediction: any) => ({
        place_id: prediction.place_id,
        description: prediction.description
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Error searching places:', error);
    return [];
  }
}
