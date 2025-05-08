import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Dimensions, ActivityIndicator } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { FontAwesome5 } from '@expo/vector-icons';
import { THEME } from '@/constants/Theme';
import { ThemedText } from './ThemedText';
import * as Location from 'expo-location';
import { Place } from '@/types';

const { width, height } = Dimensions.get('window');

interface MapComponentProps {
  places?: Place[];
  routePoints?: Array<{latitude: number, longitude: number}>;
  placesOfInterest?: Place[];
  initialRegion?: {
    latitude: number;
    longitude: number;
    latitudeDelta: number;
    longitudeDelta: number;
  };
  showUserLocation?: boolean;
  onMarkerPress?: (place: Place) => void;
  style?: any;
}

export default function MapComponent(props: MapComponentProps) {
  const {
    places,
    routePoints,
    placesOfInterest,
    initialRegion,
    showUserLocation = true,
    onMarkerPress,
    style
  } = props;
  
  const mapRef = useRef<MapView>(null);
  const [region, setRegion] = useState(initialRegion || {
    latitude: 41.0082,  // Default to Istanbul
    longitude: 28.9784,
    latitudeDelta: 0.0922,
    longitudeDelta: 0.0421,
  });
  const [userLocation, setUserLocation] = useState<{latitude: number, longitude: number} | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // Get user's current location
  useEffect(() => {
    if (showUserLocation) {
      getUserLocation();
    }
  }, [showUserLocation]);

  const getUserLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        setLocationError('Konum izni verilmedi');
        return;
      }

      setLocationError(null); // Clear any previous errors
      
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      if (!location || !location.coords) {
        setLocationError('Konum bilgisi alınamadı');
        return;
      }

      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      });

      // Only set region if no initialRegion and no routePoints
      if (!initialRegion && (!routePoints || routePoints.length === 0)) {
        setRegion(newRegion);
      }

      // If map is ready, animate to the new region
      if (mapRef.current && mapReady && !initialRegion && (!routePoints || routePoints.length === 0)) {
        try {
          const map = mapRef.current;
          if (map && typeof map.animateToRegion === 'function') {
            setTimeout(() => {
              map.animateToRegion(newRegion, 1000);
            }, 500);
          } 
        } catch (mapError) {
          console.warn('Error animating map:', mapError);
        }
      }

    } catch (error) {
      console.error('Error getting location:', error);
      setLocationError('Konum alınamadı. Lütfen konum servislerinizi kontrol edin.');
    }
  };

  const handleMapReady = () => {
    try {
      setMapReady(true);
      
      // If we have route points, fit to show the route
      if (routePoints && routePoints.length > 1 && mapRef.current) {
        setTimeout(() => {
          try {
            mapRef.current?.fitToCoordinates(routePoints, {
              edgePadding: { top: 50, right: 50, bottom: 50, left: 50 },
              animated: true
            });
          } catch (error) {
            console.warn('Failed to fit to coordinates:', error);
          }
        }, 1000);
      } 
      // If we have initialRegion, use that
      else if (initialRegion && mapRef.current) {
        setTimeout(() => {
          try {
            mapRef.current?.animateToRegion(initialRegion, 1000);
          } catch (error) {
            console.warn('Failed to animate to initialRegion:', error);
          }
        }, 1000);
      }
      // If we have user location, use that
      else if (userLocation && mapRef.current) {
        const newRegion = {
          latitude: userLocation.latitude,
          longitude: userLocation.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        
        setTimeout(() => {
          try {
            mapRef.current?.animateToRegion(newRegion, 1000);
          } catch (error) {
            console.warn('Failed to animate to user location:', error);
          }
        }, 1000);
      }
    } catch (error) {
      console.error('Error in handleMapReady:', error);
    }
  };

  const renderMarkers = () => {
    // Check if places is a valid array
    if (!places || !Array.isArray(places)) {
      return null;
    }
    
    if (places.length === 0) {
      return null;
    }
    
    return places.map((place, index) => {
      // Check if place exists and has valid properties
      if (!place || typeof place !== 'object') {
        return null;
      }
      
      // Make sure location exists and has valid latitude and longitude
      if (
        !place.location ||
        typeof place.location.latitude !== 'number' || 
        typeof place.location.longitude !== 'number' ||
        isNaN(place.location.latitude) || 
        isNaN(place.location.longitude)
      ) {
        return null;
      }
      
      // Safe default values for title and id
      const placeId = place.id || `place-${index}`;
      const placeName = place.name || 'Unnamed Place';
      
      return (
        <Marker
          key={`marker-${placeId}-${index}`}
          identifier={`marker-${placeId}`}
          coordinate={{
            latitude: place.location.latitude,
            longitude: place.location.longitude,
          }}
          title={placeName}
          description={`${place.points || 0} puan`}
          onPress={() => onMarkerPress && onMarkerPress(place)}
          pinColor={THEME.COLORS.primary}
        >
          <View style={[styles.markerContainer, { backgroundColor: getMarkerColorForType(place.type || 'default') }]}>
            <FontAwesome5
              name={getIconForType(place.type || 'default')}
              size={16}
              color="#fff"
            />
          </View>
          {place.rating && place.rating > 0 && (
            <View style={styles.ratingContainer}>
              <ThemedText style={styles.ratingText}>{place.rating}</ThemedText>
              <FontAwesome5 name="star" size={8} color="#FFD700" />
            </View>
          )}
        </Marker>
      );
    }).filter(Boolean);
  };

  const getIconForType = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'historical':
      case 'tarihi':
        return 'monument';
      case 'restaurant':
      case 'restoran':
        return 'utensils';
      case 'nature':
      case 'doga':
        return 'tree';
      case 'beach':
      case 'plaj':
        return 'umbrella-beach';
      case 'museum':
      case 'müze':
        return 'landmark';
      default:
        return 'map-marker-alt';
    }
  };
  
  const getMarkerColorForType = (type: string): string => {
    switch (type.toLowerCase()) {
      case 'historical':
      case 'tarihi':
        return '#8D6E63'; // Brown
      case 'restaurant':
      case 'restoran':
        return '#F44336'; // Red
      case 'nature':
      case 'doga':
        return '#4CAF50'; // Green
      case 'beach':
      case 'plaj':
        return '#03A9F4'; // Blue
      case 'museum':
      case 'müze':
        return '#9C27B0'; // Purple
      default:
        return THEME.COLORS.primary;
    }
  };

  // If there's a location error, show error message
  if (locationError && showUserLocation) {
    return (
      <View style={[styles.container, style, styles.errorContainer]}>
        <FontAwesome5 name="map-marked-alt" size={32} color={THEME.COLORS.textLight} />
        <ThemedText style={styles.errorText}>{locationError}</ThemedText>
        <TouchableOpacity style={styles.retryButton} onPress={getUserLocation}>
          <ThemedText style={styles.retryButtonText}>Tekrar Dene</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }

  try {
    return (
      <View style={[styles.container, style]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={region}
          showsUserLocation={showUserLocation}
          showsMyLocationButton={showUserLocation}
          showsCompass={true}
          onMapReady={handleMapReady}
          onRegionChangeComplete={(newRegion) => {
            if (newRegion) setRegion(newRegion);
          }}
        >
          {renderMarkers()}
          
          {/* Render route line if route points are provided */}
          {routePoints && routePoints.length > 1 && (
            <Polyline
              coordinates={routePoints}
              strokeWidth={4}
              strokeColor={THEME.COLORS.primary}
              lineDashPattern={[0]}
            />
          )}
          
          {/* Render special markers for start and end points of route */}
          {routePoints && routePoints.length > 1 && (
            <>
              <Marker
                coordinate={routePoints[0]}
                title="Başlangıç Noktası"
                pinColor="green"
              >
                <View style={[styles.markerContainer, { backgroundColor: 'green' }]}>
                  <FontAwesome5 name="flag" size={16} color="#fff" />
                </View>
              </Marker>
              <Marker
                coordinate={routePoints[routePoints.length - 1]}
                title="Varış Noktası"
                pinColor="red"
              >
                <View style={[styles.markerContainer, { backgroundColor: 'red' }]}>
                  <FontAwesome5 name="flag-checkered" size={16} color="#fff" />
                </View>
              </Marker>
            </>
          )}
          
          {/* Render places of interest along route */}
          {placesOfInterest && placesOfInterest.map((place, index) => {
            if (!place.location) return null;
            
            return (
              <Marker
                key={`poi-${place.id}-${index}`}
                identifier={`poi-${place.id}`}
                coordinate={{
                  latitude: place.location.latitude,
                  longitude: place.location.longitude,
                }}
                title={place.name}
                description={place.aiReason || place.description}
                onPress={() => onMarkerPress && onMarkerPress(place)}
              >
                <View style={[styles.markerContainer, { backgroundColor: '#FF9800' }]}>
                  <FontAwesome5
                    name={getIconForType(place.type || 'default')}
                    size={16}
                    color="#fff"
                  />
                </View>
                {place.rating && place.rating > 0 && (
                  <View style={styles.ratingContainer}>
                    <ThemedText style={styles.ratingText}>{place.rating}</ThemedText>
                    <FontAwesome5 name="star" size={8} color="#FFD700" />
                  </View>
                )}
              </Marker>
            );
          })}
        </MapView>
        
        {!mapReady && (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={THEME.COLORS.primary} />
            <ThemedText style={styles.loadingText}>Harita yükleniyor...</ThemedText>
          </View>
        )}
        
        {showUserLocation && mapReady && (
          <TouchableOpacity
            style={styles.recenterButton}
            onPress={getUserLocation}
          >
            <FontAwesome5 name="location-arrow" size={16} color={THEME.COLORS.primary} />
          </TouchableOpacity>
        )}
      </View>
    );
  } catch (error) {
    console.error('MapView rendering error:', error);
    return (
      <View style={[styles.container, style, styles.errorContainer]}>
        <FontAwesome5 name="exclamation-triangle" size={32} color={THEME.COLORS.textLight} />
        <ThemedText style={styles.errorText}>Harita yüklenirken bir sorun oluştu.</ThemedText>
        <TouchableOpacity style={styles.retryButton} onPress={() => setMapReady(false)}>
          <ThemedText style={styles.retryButtonText}>Tekrar Dene</ThemedText>
        </TouchableOpacity>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    height: 300,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  markerContainer: {
    backgroundColor: THEME.COLORS.primary,
    padding: 8,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    padding: 4,
    borderRadius: 10,
    position: 'absolute',
    bottom: -12,
    left: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  ratingText: {
    fontSize: 10,
    marginRight: 2,
    fontWeight: 'bold',
  },
  recenterButton: {
    position: 'absolute',
    bottom: 20,
    right: 16,
    backgroundColor: '#fff',
    padding: 12,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 5,
  },
  loadingContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  loadingText: {
    marginTop: 10,
  },
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  errorText: {
    marginTop: 12,
    marginBottom: 16,
    textAlign: 'center',
    color: THEME.COLORS.textLight,
  },
  retryButton: {
    backgroundColor: THEME.COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryButtonText: {
    color: THEME.COLORS.white,
  },
});
