import React, { createContext, useState, useEffect, useContext, ReactNode } from 'react';
import { getCurrentLocation, reverseGeocode } from '@/lib/googleMapsService'; // reverseGeocode will be added

interface LocationData {
  latitude: number | null;
  longitude: number | null;
  city: string | null;
  error: string | null;
  loading: boolean;
}

interface LocationContextType extends LocationData {
  fetchLocation: () => Promise<void>;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const LocationProvider = ({ children }: { children: ReactNode }) => {
  const [locationData, setLocationData] = useState<LocationData>({
    latitude: null,
    longitude: null,
    city: null,
    error: null,
    loading: true,
  });

  const fetchLocationAndCity = async () => {
    setLocationData(prev => ({ ...prev, loading: true, error: null }));
    try {
      const coords = await getCurrentLocation();
      if (coords) {
        const cityInfo = await reverseGeocode(coords.latitude, coords.longitude);
        setLocationData({
          latitude: coords.latitude,
          longitude: coords.longitude,
          city: cityInfo,
          error: null,
          loading: false,
        });
      } else {
        throw new Error('Could not get current location.');
      }
    } catch (err) {
      console.error('Error fetching location or city:', err);
      setLocationData({
        latitude: null,
        longitude: null,
        city: null,
        error: err instanceof Error ? err.message : 'Failed to fetch location',
        loading: false,
      });
    }
  };

  useEffect(() => {
    fetchLocationAndCity();
  }, []);

  return (
    <LocationContext.Provider value={{ ...locationData, fetchLocation: fetchLocationAndCity }}>
      {children}
    </LocationContext.Provider>
  );
};

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (context === undefined) {
    throw new Error('useLocation must be used within a LocationProvider');
  }
  return context;
};
