import axios from 'axios';
import * as Location from 'expo-location';
import { Platform } from 'react-native';

const GOOGLE_API_KEY = 'AIzaSyAaocxBIq3M7YdICTGeDXCbxkmn04E8AYc';

// Type tanımlamaları
export interface LocationCoords {
  latitude: number;
  longitude: number;
}

export interface NearbyPlace {
  id: string;
  name: string;
  vicinity: string;
  rating?: number;
  photos?: Array<{ photo_reference: string }>;
  geometry: {
    location: {
      lat: number;
      lng: number;
    }
  };
  types: string[];
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

    // Güncel konumu al
    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    };
  } catch (error) {
    console.error('Konum alınamadı:', error);
    return null;
  }
};

// Yakınlardaki yerleri arama
export async function searchNearbyPlaces(
  location: LocationCoords,
  radius: number = 1500,
  type: string = 'tourist_attraction',
  language: string = 'tr'
): Promise<NearbyPlace[]> {
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/nearbysearch/json',
      {
        params: {
          location: `${location.latitude},${location.longitude}`,
          radius,
          type,
          language,
          key: GOOGLE_API_KEY,
        },
      }
    );

    if (response.data.status === 'OK') {
      return response.data.results;
    } else {
      console.error('Google Places API hatası:', response.data.status);
      return [];
    }
  } catch (error) {
    console.error('Yakındaki yerler aranamadı:', error);
    return [];
  }
};

// Yer fotoğrafını alma
export const getPlacePhoto = (photoReference: string, maxWidth: number = 400): string => {
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxWidth}&photoreference=${photoReference}&key=${GOOGLE_API_KEY}`;
};

// Yer detaylarını alma
export const getPlaceDetails = async (placeId: string, language: string = 'tr'): Promise<any> => {
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/details/json',
      {
        params: {
          place_id: placeId,
          language,
          fields: 'name,rating,formatted_address,formatted_phone_number,website,opening_hours,reviews,photos,geometry',
          key: GOOGLE_API_KEY,
        },
      }
    );

    if (response.data.status === 'OK') {
      return response.data.result;
    } else {
      console.error('Google Place Details API hatası:', response.data.status);
      return null;
    }
  } catch (error) {
    console.error('Yer detayları alınamadı:', error);
    return null;
  }
};

// Otomatik tamamlama
export const searchPlaces = async (query: string, language: string = 'tr'): Promise<any[]> => {
  try {
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/place/autocomplete/json',
      {
        params: {
          input: query,
          language,
          key: GOOGLE_API_KEY,
        },
      }
    );

    if (response.data.status === 'OK') {
      return response.data.predictions;
    } else {
      console.error('Google Places Autocomplete API hatası:', response.data.status);
      return [];
    }
  } catch (error) {
    console.error('Yer araması yapılamadı:', error);
    return [];
  }
};
