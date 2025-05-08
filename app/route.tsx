import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, Dimensions, Image, Animated } from 'react-native';
import MapComponent from '../components/MapComponent';
import CitySelectionModal from '../components/CitySelectionModal';
import { Place } from '../types';
import { placesService } from '../services/placesService';
import * as googleMapsService from '../lib/googleMapsService';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ThemedText } from '../components/ThemedText';
import { ThemedView } from '../components/ThemedView';
import { THEME } from '../constants/Theme';
import { router } from 'expo-router';

const { width, height } = Dimensions.get('window');

export default function RouteScreen() {
  const [startLocation, setStartLocation] = useState('');
  const [endLocation, setEndLocation] = useState('');
  const [routePoints, setRoutePoints] = useState<any[]>([]);
  const [placesAlongRoute, setPlacesAlongRoute] = useState<Place[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [mapVisible, setMapVisible] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [allPlaces, setAllPlaces] = useState<Place[]>([]);
  
  // State for city selection modals
  const [startCityModalVisible, setStartCityModalVisible] = useState(false);
  const [endCityModalVisible, setEndCityModalVisible] = useState(false);
  
  // Animasyon için state'ler
  const [inputsCollapsed, setInputsCollapsed] = useState(false);
  const animatedHeight = useRef(new Animated.Value(1)).current;
  const animatedOpacity = useRef(new Animated.Value(1)).current;

  // Fetch all places when component mounts
  useEffect(() => {
    const fetchPlaces = async () => {
      try {
        const places = await placesService.getAllPlaces();
        setAllPlaces(places);
      } catch (error) {
        console.error('Error fetching places:', error);
      }
    };
    
    fetchPlaces();
  }, []);

  const findRoute = async () => {
    if (!startLocation || !endLocation) {
      setErrorMessage('Lütfen başlangıç ve bitiş noktalarını girin');
      return;
    }

    setErrorMessage('');
    setIsLoading(true);
    setMapVisible(false);
    setPlacesAlongRoute([]);

    try {
      // 1. Get route directions using Google Maps service
      const routeData = await googleMapsService.getDirections(startLocation, endLocation);
      
      if (!routeData || !routeData.routes || routeData.routes.length === 0) {
        throw new Error('Rota bulunamadı');
      }
      
      // Extract route points and waypoints
      const route = routeData.routes[0];
      const points = googleMapsService.decodePolyline(route.overview_polyline.points);
      setRoutePoints(points);
      
      // 2. Doğrudan Google'dan rota üzerindeki yerleri al
      const googlePlaces = await googleMapsService.searchPlacesAlongRoute(points);
      
      // 3. Google yerlerini uygulama formatına dönüştür
      const routePlaces = googlePlaces.map(place => {
        return {
          id: place.id,
          name: place.name,
          type: determineType(place.types),
          rating: place.rating || 4.0,
          image_url: place.photos && place.photos.length > 0
            ? googleMapsService.getPlacePhoto(place.photos[0].photo_reference, 800)
            : 'https://images.unsplash.com/photo-1518982217067-65d51c4f4fdf?q=80&w=800',
          location: {
            latitude: place.geometry.location.lat,
            longitude: place.geometry.location.lng
          },
          aiReason: generatePlaceDescription({
            type: determineType(place.types),
            name: place.name
          } as Place, startLocation, endLocation)
        } as Place;
      });
      
      setPlacesAlongRoute(routePlaces);
      setMapVisible(true);
      // Otomatik olarak yukarı çekilecek (useEffect ile yapılıyor)
    } catch (error) {
      console.error('Route finding error:', error);
      setErrorMessage(`Rota oluşturulurken bir hata oluştu: ${error instanceof Error ? error.message : 'Bilinmeyen hata'}`);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Yer türünü belirle
  const determineType = (types: string[]): string => {
    if (types.includes('museum')) return 'müze';
    if (types.includes('park')) return 'park';
    if (types.includes('restaurant')) return 'restoran';
    if (types.includes('cafe')) return 'kafe';
    if (types.includes('historic')) return 'tarihi';
    if (types.includes('shopping_mall')) return 'alışveriş';
    if (types.includes('art_gallery')) return 'sanat';
    if (types.includes('mosque') || types.includes('church')) return 'dini';
    if (types.includes('beach')) return 'plaj';
    if (types.includes('bar') || types.includes('night_club')) return 'gece hayatı';
    return 'genel';
  };

  const renderPlaceItem = ({ item }: { item: Place }) => (
    <TouchableOpacity 
      style={styles.placeCard}
      onPress={() => router.push(`/place/${item.id}` as any)}
    >
      <View style={styles.placeImageContainer}>
        {item.image_url ? (
          <Image source={{ uri: item.image_url }} style={styles.placeImage} />
        ) : (
          <View style={[styles.placeImage, styles.placeholderImage]}>
            <Ionicons name="image-outline" size={24} color="#ccc" />
          </View>
        )}
      </View>
      <View style={styles.placeInfo}>
        <Text style={styles.placeName} numberOfLines={1}>{item.name}</Text>
        <Text style={styles.placeType} numberOfLines={1}>{item.type}</Text>
        <View style={styles.ratingContainer}>
          <Ionicons name="star" size={14} color="#FFD700" />
          <Text style={styles.placeRating}>{item.rating || '-'}</Text>
        </View>
        {item.aiReason && (
          <Text style={styles.placeReason} numberOfLines={2}>{item.aiReason}</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  // Handle city selection
  const handleSelectStartCity = (city: string) => {
    setStartLocation(city);
    setStartCityModalVisible(false);
  };

  const handleSelectEndCity = (city: string) => {
    setEndLocation(city);
    setEndCityModalVisible(false);
  };

  // Calculate distance between two points using the Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2); 
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
    const distance = R * c; // Distance in km
    return distance;
  };

  // Find places along the route based on proximity
  const findPlacesAlongRoute = (places: Place[], routePoints: {latitude: number, longitude: number}[]): Place[] => {
    // Filter places that have valid location data
    const placesWithLocation = places.filter(place => 
      place.location && 
      typeof place.location.latitude === 'number' && 
      typeof place.location.longitude === 'number'
    );

    // Maximum distance in kilometers to consider a place "near" the route
    const MAX_DISTANCE_KM = 30;
    
    // Find places that are close to the route
    const placesNearRoute = placesWithLocation.filter(place => {
      if (!place.location) return false;
      
      // Check if this place is close to any point on the route
      return routePoints.some(point => {
        const distance = calculateDistance(
          place.location!.latitude,
          place.location!.longitude,
          point.latitude,
          point.longitude
        );
        return distance <= MAX_DISTANCE_KM;
      });
    });
    
    // Sort places by rating (highest first) and limit results
    const sortedPlaces = placesNearRoute
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))
      .slice(0, 10);
    
    // Add a reason description to each place
    return sortedPlaces.map(place => ({
      ...place,
      aiReason: generatePlaceDescription(place, startLocation, endLocation)
    }));
  };
  
  // Generate a description for a place
  const generatePlaceDescription = (place: Place, from: string, to: string): string => {
    const placeTypes: Record<string, string[]> = {
      'müze': [
        'Rota üzerindeki önemli bir kültürel nokta',
        'Tarihi eserleri görmek için mükemmel bir durak',
        'Bölgenin tarihini keşfetmek için ideal bir mola yeri'
      ],
      'park': [
        'Yolculuk sırasında dinlenmek için harika bir mola noktası',
        'Doğa ile iç içe bir mola vermek için ideal',
        'Temiz hava almak ve dinlenmek için mükemmel'
      ],
      'restoran': [
        'Yöresel lezzetleri tatmak için mükemmel',
        'Yol üzerinde en iyi yemek duraklarından biri',
        'Yorgunluğunuzu atıp lezzetli yemekler yiyebileceğiniz yer'
      ],
      'tarihi': [
        `${from}-${to} rotası üzerindeki önemli tarihi yapılardan biri`,
        'Bölgenin zengin tarihine tanıklık etmek için ideal',
        'Fotoğraf çekmek için muhteşem manzaralar sunar'
      ],
      'plaj': [
        'Yolculuk sırasında serinlemek için mükemmel bir mola',
        'Rotanız üzerindeki en güzel deniz manzaralarından biri',
        'Kısa bir plaj molası için ideal'
      ]
    };
    
    const defaultDescriptions = [
      `${from}-${to} rotası üzerinde görülmesi gereken bir yer`,
      'Yolculuğunuzu zenginleştirecek özel bir nokta',
      'Rota üzerindeki popüler duraklardan biri'
    ];
    
    const descriptions = placeTypes[place.type?.toLowerCase() || ''] || defaultDescriptions;
    return descriptions[Math.floor(Math.random() * descriptions.length)];
  };

  // Animasyon fonksiyonları
  const collapseInputs = () => {
    Animated.parallel([
      Animated.timing(animatedHeight, {
        toValue: 0.4,
        duration: 300,
        useNativeDriver: false
      }),
      Animated.timing(animatedOpacity, {
        toValue: 0.8,
        duration: 300,
        useNativeDriver: false
      })
    ]).start(() => {
      setInputsCollapsed(true);
    });
  };
  
  const expandInputs = () => {
    Animated.parallel([
      Animated.timing(animatedHeight, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false
      }),
      Animated.timing(animatedOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false
      })
    ]).start(() => {
      setInputsCollapsed(false);
    });
  };
  
  // Rotayı bulduktan sonra inputları yukarı çek
  useEffect(() => {
    if (mapVisible && routePoints.length > 0) {
      collapseInputs();
    }
  }, [mapVisible, routePoints]);

  return (
    <SafeAreaView style={styles.container}>
      <ThemedView style={styles.subheader}>
        <ThemedText style={styles.subtitle}>
          Başlangıç ve bitiş noktalarını girerek aradaki rota üzerindeki ilgi çekici yerleri bulun
        </ThemedText>
      </ThemedView>

      <TouchableOpacity 
        activeOpacity={0.9}
        onPress={inputsCollapsed ? expandInputs : undefined}
        style={inputsCollapsed ? styles.collapsedContainer : undefined}
      >
        <Animated.View 
          style={[
            styles.inputContainer, 
            {
              transform: [{ scale: animatedHeight }],
              opacity: animatedOpacity
            }
          ]}
        >
          <TouchableOpacity 
            style={styles.inputWrapper}
            onPress={() => setStartCityModalVisible(true)}
          >
            <Ionicons name="location" size={20} color={THEME.COLORS.primary} />
            <TextInput
              style={styles.input}
              placeholder="Başlangıç noktası (ör. İzmir)"
              value={startLocation}
              onChangeText={setStartLocation}
              editable={false} // Make it act as a button
            />
            <Ionicons name="chevron-down" size={20} color={THEME.COLORS.gray} />
          </TouchableOpacity>

          <View style={styles.inputDivider}>
            <Ionicons name="ellipsis-vertical" size={20} color="#ccc" />
          </View>

          <TouchableOpacity 
            style={styles.inputWrapper}
            onPress={() => setEndCityModalVisible(true)}
          >
            <Ionicons name="navigate" size={20} color={THEME.COLORS.primary} />
            <TextInput
              style={styles.input}
              placeholder="Varış noktası (ör. İstanbul)"
              value={endLocation}
              onChangeText={setEndLocation}
              editable={false} // Make it act as a button
            />
            <Ionicons name="chevron-down" size={20} color={THEME.COLORS.gray} />
          </TouchableOpacity>

          {!inputsCollapsed && (
            <TouchableOpacity 
              style={[
                styles.findButton, 
                (!startLocation || !endLocation) && styles.disabledButton
              ]}
              onPress={findRoute}
              disabled={!startLocation || !endLocation || isLoading}
            >
              {isLoading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="search" size={20} color="#fff" style={styles.buttonIcon} />
                  <Text style={styles.buttonText}>Rota Bul</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </Animated.View>
      </TouchableOpacity>

      {errorMessage ? (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={20} color="red" />
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}

      {mapVisible && routePoints.length > 0 && (
        <View style={styles.mapContainer}>
          <MapComponent 
            style={styles.map}
            routePoints={routePoints}
            placesOfInterest={placesAlongRoute}
            initialRegion={{
              latitude: routePoints[0].latitude,
              longitude: routePoints[0].longitude,
              latitudeDelta: 0.5,
              longitudeDelta: 0.5,
            }}
          />
        </View>
      )}

      <View style={styles.placesContainer}>
        <ThemedText style={styles.placesTitle}>
          {placesAlongRoute.length > 0 
            ? `Rota Üzerindeki Yerler (${placesAlongRoute.length})` 
            : isLoading 
              ? 'Yerler aranıyor...' 
              : 'Rota oluşturun ve keşfedin'}
        </ThemedText>
        
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={THEME.COLORS.primary} />
            <ThemedText style={styles.loadingText}>Rota üzerindeki yerler bulunuyor...</ThemedText>
          </View>
        ) : placesAlongRoute.length > 0 ? (
          <FlatList
            data={placesAlongRoute}
            keyExtractor={(item) => item.id.toString()}
            renderItem={renderPlaceItem}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.placesList}
          />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="map-outline" size={50} color="#ccc" />
            <ThemedText style={styles.emptyText}>
              Rotanızı oluşturun ve yol üzerindeki harika keşifleri görün
            </ThemedText>
          </View>
        )}
      </View>

      {/* City Selection Modals */}
      <CitySelectionModal 
        visible={startCityModalVisible}
        onClose={() => setStartCityModalVisible(false)}
        onSelectCity={handleSelectStartCity}
        placeholder="Başlangıç şehri ara..."
      />
      
      <CitySelectionModal 
        visible={endCityModalVisible}
        onClose={() => setEndCityModalVisible(false)}
        onSelectCity={handleSelectEndCity}
        placeholder="Varış şehri ara..."
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingTop: 5,
    paddingBottom: 15,
    marginTop: -10,
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subheader: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    paddingTop: 0,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    color: THEME.COLORS.primary,
    textShadowColor: 'rgba(0, 0, 0, 0.1)',
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 1,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  inputContainer: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
    color: '#333',
  },
  inputDivider: {
    alignItems: 'center',
    marginBottom: 12,
  },
  findButton: {
    backgroundColor: THEME.COLORS.primary,
    borderRadius: 8,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  buttonIcon: {
    marginRight: 8,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 12,
    backgroundColor: '#ffebee',
    borderRadius: 8,
  },
  errorText: {
    marginLeft: 8,
    color: 'red',
  },
  mapContainer: {
    height: height * 0.3,
    marginHorizontal: 16,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 16,
    marginTop: 50, // Animasyonlu input için boşluk ekle
  },
  map: {
    flex: 1,
  },
  placesContainer: {
    flex: 1,
    marginHorizontal: 16,
  },
  placesTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  placesList: {
    paddingRight: 16,
  },
  placeCard: {
    width: 180,
    backgroundColor: '#fff',
    borderRadius: 12,
    marginRight: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  placeImageContainer: {
    height: 100,
    width: '100%',
  },
  placeImage: {
    height: '100%',
    width: '100%',
    resizeMode: 'cover',
  },
  placeholderImage: {
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeInfo: {
    padding: 12,
  },
  placeName: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#333',
  },
  placeType: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  placeRating: {
    marginLeft: 4,
    fontSize: 12,
    color: '#666',
  },
  placeReason: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 16,
    color: '#666',
  },
  collapsedContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
  }
});
