import React, { useState, useCallback, useRef, useLayoutEffect, useEffect } from 'react'; // Added useLayoutEffect
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  FlatList,
  RefreshControl,
  Dimensions,
  TextInput,
  Platform,
  LayoutAnimation,
  UIManager,
  Linking
} from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { FontAwesome5 } from '@expo/vector-icons';
import { THEME } from '@/constants/Theme';
import { router, useNavigation } from 'expo-router'; // Added useNavigation
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { searchNearbyPlaces , LocationCoords, NearbyPlace, GOOGLE_API_KEY } from '@/lib/googleMapsService'; // Renamed and added createPlaceFromGoogleData
import { useLocation } from '@/contexts/LocationContext'; // Added
import { Place } from '@/types';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps';
import { placesService } from '@/services/placesService';
import { userService } from '@/services/userService'; // Added userService
import { User } from '@/types'; // Added User type
import Animated, { 
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withSpring
} from 'react-native-reanimated';

// Platform specific layout animations
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const { width, height } = Dimensions.get('window');
const CARD_WIDTH = width * 0.92;
const CARD_HEIGHT = height * 0.35;

interface Category {
  id: string;
  name: string;
  icon: string;
  color?: string;
}

interface PlaceCardProps {
  place: NearbyPlace & { isFavorite?: boolean }; // Added isFavorite
  onPress: (id: string) => void;
  style?: any;
}

// Categories with icons and colors
const categories: Category[] = [
  { id: 'all', name: 'Tümü', icon: 'compass', color: THEME.COLORS.primary },
  { id: 'historic', name: 'Tarihi Yerler', icon: 'landmark', color: '#8B4513' },
  { id: 'nature', name: 'Doğa', icon: 'mountain', color: '#43A047' },
  { id: 'museum', name: 'Müzeler', icon: 'monument', color: '#D81B60' },
  { id: 'adventure', name: 'Macera', icon: 'hiking', color: '#FF5722' },
  { id: 'city', name: 'Şehir Keşfi', icon: 'city', color: '#1976D2' },
  { id: 'religious', name: 'Dini', icon: 'pray', color: '#7E57C2' },
  { id: 'art', name: 'Sanat', icon: 'palette', color: '#EC407A' }
];

export default function ExploreScreen() {
  const navigation = useNavigation(); // Added
  const [loading, setLoading] = useState(true); // Start with loading true
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const {
    city: userCity,
    latitude: userLatitude,
    longitude: userLongitude,
    loading: locationLoading,
    error: locationError,
    fetchLocation
  } = useLocation();
  const [places, setPlaces] = useState<NearbyPlace[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [showMap, setShowMap] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null); // Added user state

  const mapRef = useRef<MapView>(null);
  const scrollY = useSharedValue(0);
  const lastContentOffset = useSharedValue(0);
  const isScrolling = useSharedValue(false);

  // Set header title dynamically
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: userCity ? `Keşfet: ${userCity}` : 'Keşfet',
    });
  }, [navigation, userCity]);

  // Effect to fetch current user
  useEffect(() => {
    const fetchCurrentUser = async () => {
      const currentUserData = await userService.getCurrentUser();
      setUser(currentUserData);
    };
    fetchCurrentUser();
  }, []);

  // Load data when screen is focused or location changes
  useFocusEffect(
    useCallback(() => {
      if (userLatitude && userLongitude) {
        loadInitialData(userLatitude, userLongitude);
        if (!searchQuery && userCity) { // Optional: Pre-fill search query with userCity
          // setSearchQuery(userCity); // Decided against pre-filling to keep search explicit
        }
      } else if (locationError) {
        setError(`Konum bilgisi alınamadı: ${locationError}. Lütfen konum servislerinizi kontrol edin veya daha sonra tekrar deneyin.`);
        setLoading(false); // Stop loading if location error
      } else if (locationLoading) {
        setLoading(true); // Ensure loading is true while location is being fetched
      }
      return () => {
        // Cleanup if needed
      };
    }, [userLatitude, userLongitude, locationError, userCity, locationLoading])
  );

  // Animated header style
  const headerStyle = useAnimatedStyle(() => {
    return {
      transform: [
        {
          translateY: withSpring(
            scrollY.value > 50 ? -50 : 0,
            { damping: 20, stiffness: 90 }
          ),
        },
      ],
      opacity: withSpring(
        scrollY.value > 50 ? 0.95 : 1,
        { damping: 20, stiffness: 90 }
      ),
    };
  });

  // Scroll handler for animations
  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      const currentOffset = event.contentOffset.y;
      isScrolling.value = true;
      scrollY.value = currentOffset;
      lastContentOffset.value = currentOffset;
    },
    onBeginDrag: () => {
      isScrolling.value = true;
    },
    onEndDrag: () => {
      isScrolling.value = false;
    },
  });

  const loadInitialData = async (lat: number, lng: number) => {
    if (!lat || !lng) {
      setError('Geçerli konum bilgisi bulunamadı.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await fetchNearbyPlaces({ latitude: lat, longitude: lng });
    } catch (err) {
      console.error('Error loading initial data in ExploreScreen:', err);
      setError(err instanceof Error ? `Veri yükleme hatası: ${err.message}` : 'Veriler yüklenirken bilinmeyen bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  const fetchNearbyPlaces = async (location: LocationCoords) => {
    try {
      setLoading(true);
      console.log('[searchNearbyPlaces] Searching in database first...');
      
      // İlk önce veritabanında ara
      const dbPlacesResult = await placesService.getNearbyPlaces(
        location.latitude,
        location.longitude,
        2000 // Başlangıç yarıçapı
      );

      if (dbPlacesResult && dbPlacesResult.length >= 5) {
        console.log(`[searchNearbyPlaces] Found ${dbPlacesResult.length} places in database`);
        let mappedDbPlaces = dbPlacesResult.map(place => ({
          id: place.id, // This is our internal place_id, not google_place_id
          name: place.name,
          vicinity: place.description || '',
          rating: place.rating,
          // Ensure photo_reference is correctly structured for PlaceCard
          photos: [{ photo_reference: place.image_url || 'https://images.unsplash.com/photo-1518982217067-65d51c4f4fdf?q=80&w=400' }],
          geometry: {
            location: {
              lat: place.latitude,
              lng: place.longitude
            }
          },
          types: [place.type],
          // google_place_id: place.google_place_id, // Keep this if dbPlaces store it and it's needed for isPlaceFavorite
        }));

        if (user && user.id) {
          const placesWithFavStatus = await Promise.all(
            mappedDbPlaces.map(async (p) => ({
              ...p,
              // Assuming p.id from db is what we use for place_id in user_favorite_places
              // If Google Place ID is stored and preferred, use p.google_place_id
              isFavorite: await placesService.isPlaceFavorite(user.id, p.id, undefined),
            }))
          );
          setPlaces(placesWithFavStatus);
        } else {
          setPlaces(mappedDbPlaces.map(p => ({ ...p, isFavorite: false })));
        }
        return;
      }

      // Veritabanında yeterli yer yoksa Google'dan ara
      console.log('[searchNearbyPlaces] Not enough places in database, searching in Google Places...');
      
      // Kademeli olarak artan yarıçap ile ara
      const searchRadii = [2000, 5000, 10000, 20000, 30000, 50000];
      let allFoundPlaces: Set<string> = new Set(); // Tekrar eden yerleri önlemek için
      let foundPlaces: NearbyPlace[] = [];
      
      for (const radius of searchRadii) {
        console.log(`[searchNearbyPlaces] Trying with radius: ${radius}m`);
        const places = await searchNearbyPlaces(location, radius);
        
        // Yeni bulunan yerleri ekle (tekrar etmeyenleri)
        const newPlaces = places.filter(place => !allFoundPlaces.has(place.id));
        newPlaces.forEach(place => {
          allFoundPlaces.add(place.id);
          foundPlaces.push(place);
        });
        
        console.log(`[searchNearbyPlaces] Total unique places: ${foundPlaces.length} (added ${newPlaces.length} from ${radius}m radius)`);
        
        // Eğer yeterli yer bulunduysa döngüden çık
        if (foundPlaces.length >= 20) {
          console.log('[searchNearbyPlaces] Found enough places, stopping search');
          break;
        }
      }

      if (foundPlaces.length === 0) {
        console.log('[searchNearbyPlaces] No places found in any radius');
        setError('Yakında keşfedilecek yer bulunamadı');
        return;
      }

      // Process foundPlaces from Google
      if (user && user.id && foundPlaces.length > 0) {
        const placesWithFavStatus = await Promise.all(
          foundPlaces.map(async (p) => ({
            ...p,
            isFavorite: await placesService.isPlaceFavorite(user.id, undefined, p.id), // p.id is google_place_id here
          }))
        );
        setPlaces(placesWithFavStatus);
      } else if (foundPlaces.length > 0) {
        setPlaces(foundPlaces.map(p => ({ ...p, isFavorite: false })));
      } else {
        setPlaces([]); // Handles case where no places are found
      }

    } catch (error) {
      console.error('[searchNearbyPlaces] Error:', error);
      setError('Yakındaki yerler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadInitialData();
    setRefreshing(false);
  }, []);

  const filterPlaces = useCallback(() => {
    if (selectedCategory === 'all') return places;
    return places.filter(place => 
      place.types.some(type => type.includes(selectedCategory))
    );
  }, [places, selectedCategory]);

  const searchPlaces = useCallback((places: NearbyPlace[]) => {
    if (!searchQuery) return places;
    return places.filter(place => 
      place.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (place.vicinity ? place.vicinity.toLowerCase().includes(searchQuery.toLowerCase()) : false)
    );
  }, [searchQuery]);

  const navigateToPlace = useCallback((placeId: string) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    router.push(`/place/${placeId}`);
  }, []);

  const openDirections = useCallback((place: NearbyPlace) => {
    const { lat, lng } = place.geometry.location;
    const destination = `${lat},${lng}`;
    const url = Platform.select({
      ios: `maps:?q=${place.name}&ll=${destination}&dirflg=d`,
      android: `google.navigation:q=${destination}&mode=d`,
    });

    if (url) {
      Linking.canOpenURL(url).then((supported) => {
        if (supported) {
          Linking.openURL(url);
        } else {
          // Fallback for web or if native maps app is not available
          const webUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=driving`;
          Linking.openURL(webUrl);
        }
      });
    }
  }, []);

  const filteredAndSearchedPlaces = searchPlaces(filterPlaces());

  const PlaceCard = useCallback(({ place, onPress, style }: PlaceCardProps) => {
    const cardAnimatedStyle = useAnimatedStyle(() => ({
      transform: [{ scale: withSpring(1) }],
      opacity: withSpring(1),
    }));

    return (
      <Animated.View style={[cardAnimatedStyle, style]}>
        <TouchableOpacity
          style={styles.placeCard}
          onPress={() => onPress(place.id)}
          activeOpacity={0.95}
        >
          <ExpoImage
            source={{ 
              uri: place.photos?.[0]?.photo_reference 
                ? place.photos[0].photo_reference.startsWith('http') 
                  ? place.photos[0].photo_reference
                  : `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`
                : 'https://images.unsplash.com/photo-1518982217067-65d51c4f4fdf?q=80&w=1200'
            }}
            style={styles.placeImage}
            contentFit="cover"
            transition={300}
            cachePolicy="memory-disk"
          />
          <LinearGradient
            colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.8)']}
            style={styles.gradient}
          />
          <View style={styles.placeInfo}>
            {/* Top Section */}
            <View style={styles.topSection}>
              <View style={styles.titleContainer}>
                <ThemedText type="subtitle" style={styles.placeName} numberOfLines={1}>
                  {place.name}
                </ThemedText>
              </View>
              <TouchableOpacity 
                style={styles.favoriteButton}
                onPress={async () => {
                  if (!user || !user.id) {
                    // Alert.alert("Giriş Yapın", "Favorilere eklemek için giriş yapmalısınız.");
                    // For now, let's assume this action is disabled or handled elsewhere if no user
                    // Or, if PlaceCard is only rendered when user is known, this check might be redundant here
                    // but good for safety.
                    router.push('/login'); // Redirect to login
                    return;
                  }
                  const currentItem = place; // place already has isFavorite through props
                  const isCurrentlyFavorite = currentItem.isFavorite;

                  // Optimistic update in ExploreScreen's places state
                  setPlaces(currentPlaces =>
                    currentPlaces.map(p =>
                      p.id === currentItem.id ? { ...p, isFavorite: !isCurrentlyFavorite } : p
                    )
                  );

                  try {
                    if (isCurrentlyFavorite) {
                      // If place.id is a google_place_id, use undefined for our internal place_id
                      // If place.id is our internal ID (from db fetch), use that for place_id
                      // Assuming places from Google have their google_place_id as place.id
                      // And places from DB also use their specific ID (which might be a UUID or google_place_id)
                      // For simplicity here, assuming place.id from NearbyPlace is always treated as google_place_id by the service if place_id is undefined.
                      // The service logic in previous steps was: isPlaceFavorite(userId, p.id, undefined) for DB, isPlaceFavorite(userId, undefined, p.id) for Google
                      // So, removeFavoritePlace should mirror this.
                      // If place.id is from our DB (and not a google_place_id), then it should be (user.id, place.id, undefined)
                      // If place.id is from Google, then it should be (user.id, undefined, place.id)
                      // Let's assume `place.isFromDB` flag or check `place.id` format if needed, or rely on service to handle.
                      // For now, let's assume all `place.id` here are Google Place IDs or are handled by service.
                      await placesService.removeFavoritePlace(user.id, undefined, currentItem.id);
                    } else {
                      const cityForFavorite = userCity || 'Unknown City';
                      const imageUrl = currentItem.photos?.[0]?.photo_reference
                        ? currentItem.photos[0].photo_reference.startsWith('http')
                          ? currentItem.photos[0].photo_reference
                          : `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=${currentItem.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`
                        : undefined;

                      await placesService.addFavoritePlace(user.id, {
                        google_place_id: currentItem.id,
                        name: currentItem.name,
                        image_url: imageUrl,
                        type: currentItem.types?.[0],
                        city: cityForFavorite,
                      });
                    }
                  } catch (err) {
                    console.error("Error updating favorite status in PlaceCard:", err);
                    // Revert optimistic update
                    setPlaces(currentPlaces =>
                      currentPlaces.map(p =>
                        p.id === currentItem.id ? { ...p, isFavorite: isCurrentlyFavorite } : p
                      )
                    );
                    // Alert.alert("Hata", "Favori durumu güncellenirken bir sorun oluştu.");
                  }
                }}
              >
                <FontAwesome5
                  name="heart"
                  size={22}
                  solid={place.isFavorite}
                  color={place.isFavorite ? THEME.COLORS.warning : THEME.COLORS.white}
                />
              </TouchableOpacity>
            </View>
            
            {/* Bottom Section */}
            <View style={styles.bottomSection}>
              <View style={styles.infoRow}>
                {place.types[0] && (
                  <View style={[styles.placeType, { 
                    backgroundColor: categories.find(c => c.id === place.types[0])?.color + '40' || THEME.COLORS.primary + '40' 
                  }]}>
                    <ThemedText style={styles.placeTypeText}>
                      {categories.find(c => c.id === place.types[0])?.name || place.types[0].toUpperCase()}
                    </ThemedText>
                  </View>
                )}
                {place.rating && (
                  <View style={styles.ratingContainer}>
                    <FontAwesome5 name="star" size={14} color={THEME.COLORS.warning} />
                    <ThemedText style={styles.rating}>{place.rating.toFixed(1)}</ThemedText>
                  </View>
                )}
              </View>
              
              <View style={styles.placeActions}>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => openDirections(place)}
                >
                  <FontAwesome5 name="directions" size={16} color={THEME.COLORS.white} />
                  <ThemedText style={styles.actionButtonText}>Yol Tarifi</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity style={styles.actionButton}>
                  <FontAwesome5 name="share-alt" size={16} color={THEME.COLORS.white} />
                  <ThemedText style={styles.actionButtonText}>Paylaş</ThemedText>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={styles.actionButton}
                  onPress={() => onPress(place.id)}
                >
                  <FontAwesome5 name="info-circle" size={16} color={THEME.COLORS.white} />
                  <ThemedText style={styles.actionButtonText}>Detaylar</ThemedText>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </TouchableOpacity>
      </Animated.View>
    );
  }, []);

  const renderPlaceCard = useCallback(({ item: place }: { item: NearbyPlace }) => (
    <PlaceCard place={place} onPress={navigateToPlace} />
  ), [PlaceCard, navigateToPlace]);

  const renderCategoryItem = useCallback(({ item: category }: { item: Category }) => (
    <TouchableOpacity
      style={[
        styles.categoryButton,
        selectedCategory === category.id && styles.selectedCategory
      ]}
      onPress={() => setSelectedCategory(category.id)}
    >
      <FontAwesome5 
        name={category.icon} 
        size={16} 
        color={selectedCategory === category.id ? THEME.COLORS.primary : THEME.COLORS.text}
      />
      <ThemedText style={[
        styles.categoryText,
        selectedCategory === category.id && styles.selectedCategoryText
      ]}>
        {category.name}
      </ThemedText>
    </TouchableOpacity>
  ), [selectedCategory]);

  const convertToMapPlace = (place: NearbyPlace): Place => ({
    id: place.id,
    name: place.name,
    description: place.vicinity || place.name,
    image_url: place.photos?.[0]?.photo_reference 
      ? `https://maps.googleapis.com/maps/api/place/photo?maxwidth=1200&photoreference=${place.photos[0].photo_reference}&key=${GOOGLE_API_KEY}`
      : 'https://via.placeholder.com/400x300',
    latitude: place.geometry.location.lat,
    longitude: place.geometry.location.lng,
    rating: place.rating || 0,
    type: place.types[0] || 'other',
    city: '',
    points: 100
  });

  return (
    <ThemedView style={styles.container}>
      <Animated.View style={[styles.header, headerStyle]}>
        <ThemedText style={styles.pageTitle}>Keşfet</ThemedText>
        <View style={styles.searchContainer}>
          <FontAwesome5 name="search" size={16} color={THEME.COLORS.text} />
          <TextInput
            style={styles.searchInput}
            placeholder="Şehir, yer veya deneyim ara..."
            placeholderTextColor={THEME.COLORS.text}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <FontAwesome5 name="times" size={16} color={THEME.COLORS.text} />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity 
              style={styles.locationButton} 
              onPress={() => {
                setSearchQuery('');
                loadInitialData();
              }}
            >
              <FontAwesome5 name="location-arrow" size={16} color={THEME.COLORS.primary} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      <View style={styles.categoryList}>
        <FlatList
          data={categories}
          renderItem={renderCategoryItem}
          keyExtractor={(item, index) => `category-${item.id}-${index}`}
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoryFlatList}
          removeClippedSubviews={true}
          initialNumToRender={5}
          maxToRenderPerBatch={10}
        />
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={THEME.COLORS.primary} />
      ) : error ? (
        <View style={styles.errorContainer}>
          <FontAwesome5 name="exclamation-circle" size={50} color={THEME.COLORS.error} />
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={loadInitialData}>
            <ThemedText style={styles.retryText}>Tekrar Dene</ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.FlatList
          data={filteredAndSearchedPlaces}
          renderItem={renderPlaceCard}
          keyExtractor={(item, index) => `place-${item.id}-${index}`}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.placesList}
          onScroll={scrollHandler}
          scrollEventThrottle={16}
          removeClippedSubviews={true}
          initialNumToRender={5}
          maxToRenderPerBatch={10}
          windowSize={5}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={THEME.COLORS.primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <FontAwesome5 name="map-marked-alt" size={50} color={THEME.COLORS.primary} />
              <ThemedText style={styles.emptyText}>
                {searchQuery 
                  ? 'Arama sonucu bulunamadı'
                  : 'Yakında keşfedilecek yer yok'}
              </ThemedText>
            </View>
          }
        />
      )}

      <TouchableOpacity
        style={styles.mapButton}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          setShowMap(!showMap);
        }}
      >
        <FontAwesome5 
          name={showMap ? "list" : "map"} 
          size={20} 
          color={THEME.COLORS.white}
        />
      </TouchableOpacity>

      {showMap && currentLocation && (
        <View style={styles.mapContainer}>
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.0922,
              longitudeDelta: 0.0421,
            }}
          >
            {filteredAndSearchedPlaces.map((place) => (
              <Marker
                key={place.id}
                coordinate={{
                  latitude: place.geometry.location.lat,
                  longitude: place.geometry.location.lng
                }}
                title={place.name}
                onPress={() => navigateToPlace(place.id)}
                tracksViewChanges={false}
              >
                <View style={styles.markerContainer}>
                  <FontAwesome5 
                    name="map-marker-alt" 
                    size={30} 
                    color={THEME.COLORS.primary} 
                  />
                </View>
              </Marker>
            ))}
          </MapView>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: THEME.COLORS.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.COLORS.border,
    zIndex: 10,
  },
  pageTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    marginBottom: 20,
    color: THEME.COLORS.text,
    letterSpacing: 0.5,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.COLORS.card,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 50,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    color: THEME.COLORS.text,
    fontSize: 16,
    fontWeight: '500',
  },
  locationButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.COLORS.primary + '15',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  categoryList: {
    paddingVertical: 15,
    backgroundColor: THEME.COLORS.background,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: THEME.COLORS.border,
  },
  categoryFlatList: {
    paddingHorizontal: 15,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
    marginHorizontal: 6,
    borderRadius: 25,
    backgroundColor: THEME.COLORS.card,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  selectedCategory: {
    backgroundColor: THEME.COLORS.primary + '15',
    borderWidth: 1.5,
    borderColor: THEME.COLORS.primary,
  },
  categoryText: {
    marginLeft: 10,
    fontSize: 15,
    fontWeight: '600',
  },
  selectedCategoryText: {
    color: THEME.COLORS.primary,
    fontWeight: '700',
  },
  placesList: {
    padding: 15,
  },
  placeCard: {
    width: CARD_WIDTH,
    height: CARD_HEIGHT,
    marginBottom: 20,
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: THEME.COLORS.card,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  placeImage: {
    width: '100%',
    height: '100%',
    backgroundColor: '#f0f0f0',
  },
  gradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '100%',
    borderRadius: 20,
  },
  placeInfo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 20,
    justifyContent: 'space-between',
  },
  topSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  titleContainer: {
    flex: 1,
    marginRight: 12,
  },
  bottomSection: {
    gap: 16,
  },
  placeName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: THEME.COLORS.white,
    textShadowColor: 'rgba(0, 0, 0, 0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  favoriteButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  placeType: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  placeTypeText: {
    color: THEME.COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
    textTransform: 'uppercase',
  },
  placeContent: {
    flex: 1,
    marginBottom: 15,
  },
  placeActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255, 255, 255, 0.2)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 8,
  },
  actionButtonText: {
    color: THEME.COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 15,
    gap: 6,
  },
  rating: {
    color: THEME.COLORS.white,
    fontSize: 14,
    fontWeight: '600',
  },
  mapButton: {
    position: 'absolute',
    right: 20,
    bottom: Platform.OS === 'ios' ? 90 : 70, // Tab bar'ın üstünde
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: THEME.COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 100,
  },
  mapContainer: {
    ...StyleSheet.absoluteFillObject,
    height,
    width,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
    color: THEME.COLORS.gray,
  },
  retryButton: {
    marginTop: 25,
    paddingHorizontal: 25,
    paddingVertical: 12,
    backgroundColor: THEME.COLORS.primary,
    borderRadius: 12,
  },
  retryText: {
    color: THEME.COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 30,
  },
  emptyText: {
    marginTop: 15,
    textAlign: 'center',
    fontSize: 17,
    opacity: 0.8,
    lineHeight: 24,
  },
  imagePlaceholder: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: THEME.COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  markerContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 40,
    height: 40,
  },
});
