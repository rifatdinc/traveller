import React, { useEffect, useState, useCallback, useLayoutEffect } from 'react'; // Added useLayoutEffect
import { StyleSheet, ScrollView, View, TouchableOpacity, FlatList, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router, useNavigation } from 'expo-router'; // Added useNavigation
import { FontAwesome5 } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { THEME } from '@/constants/Theme';
// import { feedService } from '@/services/feedService'; // Removed
import { socialSharingService } from '@/services/socialSharingService'; // Added
import { challengesService } from '@/services/challengesService';
import { placesService } from '@/services/placesService';
import { userService } from '@/services/userService';
import { User, Place, Challenge, FeedPost } from '@/types';
import { locationChallengeService } from '@/services/locationChallengeService';
import { 
  getCurrentLocation,
  searchNearbyPlaces, 
  getPlacePhoto,
  NearbyPlace,
  // createPlaceFromGoogleData, // Commented out as it's not used directly in the new flow for challenges
  getPlacePhoto, // Keep if used for nearby places display
  searchNearbyPlaces as searchNearbyPlacesGoogle // Renaming to avoid conflict if we keep a local version
} from '@/lib/googleMapsService';
import { useLocation } from '@/contexts/LocationContext'; // Added

export default function HomeScreen() {
  const navigation = useNavigation(); // Added
  const [loading, setLoading] = useState<boolean>(true);
  const { city: userCity, latitude: userLatitude, longitude: userLongitude, loading: locationLoading, error: locationError, fetchLocation } = useLocation(); // Added
  const [user, setUser] = useState<User | null>(null);
  const [places, setPlaces] = useState<Place[]>([]); // General places
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]); // For "Yakınındaki Yerler" section
  const [loadingNearby, setLoadingNearby] = useState<boolean>(false); // Initialize to false or true based on when fetchNearbyPlacesForDisplay is called
  // const [location, setLocation] = useState<{latitude: number; longitude: number} | null>(null); // Removed
  const [dailyChallenge, setDailyChallenge] = useState<Challenge | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]); // General + Location-based challenges
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [mockChallengeUsed, setMockChallengeUsed] = useState<boolean>(false);

  // This function is now specifically for fetching nearby places for the "Yakınındaki Yerler" section
  // It no longer extracts city or fetches location-based challenges.
  const fetchNearbyPlacesForDisplay = async (currentLatitude: number, currentLongitude: number) => {
    if (!currentLatitude || !currentLongitude) {
      setLoadingNearby(false);
      return;
    }
    try {
      setLoadingNearby(true);
      const searchRadii = [1000, 5000, 10000, 20000, 50000];
      let nearbyResults: NearbyPlace[] | null = null;
      let usedRadius = 0;

      for (const radius of searchRadii) {
        console.log(`[fetchNearbyPlacesForDisplay] Searching within ${radius}m radius...`);
        // Assuming searchNearbyPlacesGoogle is the imported Google Maps service function
        const results = await searchNearbyPlacesGoogle({ latitude: currentLatitude, longitude: currentLongitude }, radius);
        if (results && results.length > 0) {
          console.log(`[fetchNearbyPlacesForDisplay] Found ${results.length} results at ${radius}m radius`);
          nearbyResults = results;
          usedRadius = radius;
          break;
        }
      }

      if (!nearbyResults || nearbyResults.length === 0) {
        console.log('[fetchNearbyPlacesForDisplay] No results found even at largest radius.');
        setNearbyPlaces([]);
      } else {
        console.log(`[fetchNearbyPlacesForDisplay] Found ${nearbyResults.length} results at ${usedRadius}m.`);
        setNearbyPlaces(nearbyResults.slice(0, 5));
        // City extraction and challenge fetching is removed from here.
        // Saving places to DB can still happen if desired, but will need userCity from context for the 'city' field.
        // For now, removing the createPlaceFromGoogleData loop to simplify. It can be added back if needed.
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('ZERO_RESULTS')) {
        console.warn('[fetchNearbyPlacesForDisplay] Google Places API returned ZERO_RESULTS.');
      } else {
        console.error('[fetchNearbyPlacesForDisplay] Error searching nearby places:', err);
      }
      setNearbyPlaces([]);
    } finally {
      setLoadingNearby(false);
    }
  };

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch user, general places, general challenges, general daily challenge, feed posts
      // Location-based challenges will be fetched in an effect hook based on userCity
      const [userData, generalPlacesData, generalChallengesData, generalDailyChallengeData, socialFeedPostsData] = await Promise.all([
        userService.getCurrentUser(),
        placesService.getAllPlaces(), // These are general places, or could be filtered later
        challengesService.getAllChallenges(), // General challenges
        challengesService.getDailyChallenge(), // General daily challenge
        socialSharingService.getFeedPosts() // Changed to socialSharingService
      ]);
      
      setUser(userData);
      setPlaces(generalPlacesData || []);
      setChallenges(generalChallengesData || []);
      
      if (generalDailyChallengeData) {
        setDailyChallenge(generalDailyChallengeData);
        setMockChallengeUsed(false);
      } else {
        console.log('No general daily challenge from API, using default data');
        const defaultChallenge = { // This might be overridden by a location-specific one later
          id: 'default-challenge-1',
          title: 'Şehir Kaşifi Ol',
          description: 'Bulunduğun şehirdeki en az 3 önemli noktayı ziyaret et ve deneyimlerini paylaş.',
          points: 500,
          image_url: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200', // Generic image
          deadline: '3 gün',
          challenge_type: 'general' as 'general',
          category: 'general' as 'general',
        };
        setDailyChallenge(defaultChallenge);
        setMockChallengeUsed(true);
      }
      
      if (socialFeedPostsData) {
        if (user && user.id) { // Check if user is available for fetching liked statuses
          const postsWithLikedStatus = await Promise.all(
            socialFeedPostsData.map(async (post) => {
              const isLiked = await socialSharingService.hasUserLikedPost(user.id, post.id);
              return {
                id: post.id,
                user: {
                  id: post.user_id,
                  username: post.username || 'Anonim',
                  avatar_url: post.user_avatar || 'https://randomuser.me/api/portraits/men/1.jpg',
                  level: '', 
                  total_points: 0,
                },
                location: post.place_name || post.place_city || undefined,
                created_at: post.created_at,
                image_url: post.images && post.images.length > 0 ? post.images[0] : undefined,
                content: post.content,
                likes_count: post.likes_count || 0,
                comments_count: post.comments_count || 0,
                place_id: post.place_id,
                isLiked: isLiked, // Set initial liked status
              };
            })
          );
          setFeedPosts(postsWithLikedStatus);
        } else {
          // If user is not logged in, set posts without liked status
          const transformedFeedPosts = socialFeedPostsData.map(post => ({
            id: post.id,
            user: {
              id: post.user_id,
              username: post.username || 'Anonim',
              avatar_url: post.user_avatar || 'https://randomuser.me/api/portraits/men/1.jpg',
              level: '',
              total_points: 0,
            },
            location: post.place_name || post.place_city || undefined,
            created_at: post.created_at,
            image_url: post.images && post.images.length > 0 ? post.images[0] : undefined,
            content: post.content,
            likes_count: post.likes_count || 0,
            comments_count: post.comments_count || 0,
            place_id: post.place_id,
            isLiked: false, // Default to false if no user
          }));
          setFeedPosts(transformedFeedPosts);
        }
      }

      // Fetch nearby places for the "Yakınındaki Yerler" section using context coordinates
      if (userLatitude && userLongitude) {
        fetchNearbyPlacesForDisplay(userLatitude, userLongitude);
      } else if (!locationLoading) { // If not loading and no coords, maybe set nearby loading to false
        setLoadingNearby(false);
      }

    } catch (err) {
      console.error('Initial data loading error:', err);
      setError('Veriler yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadInitialData();
  }, []);

  // Effect to fetch location-based challenges when city is available
  useEffect(() => {
    if (userCity) {
      console.log(`City detected: ${userCity}. Fetching location-based challenges.`);
      fetchLocationBasedChallenges(userCity);
    } else if (locationError) {
      console.warn('Could not fetch location-based challenges due to location error:', locationError);
      // If there's a location error, and we have a mock challenge, we might want to ensure
      // that a general (non-mock) daily challenge is loaded if not already, or the mock persists.
      // loadInitialData already sets a mock or general challenge, so this might be okay.
    }
    // Also, re-fetch nearby places if user coordinates become available after initial load
    if (userLatitude && userLongitude && nearbyPlaces.length === 0 && !loadingNearby && !locationLoading) {
      console.log('User coordinates available, fetching nearby places for display.');
      fetchNearbyPlacesForDisplay(userLatitude, userLongitude);
    }

  }, [userCity, userLatitude, userLongitude, locationError, locationLoading]);


  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchLocation(); // Refresh location from context
    await loadInitialData(); // Reload other data
    // Location-based challenges will be re-fetched by the useEffect watching userCity
    setRefreshing(false);
  }, []);

  // Set header title
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Ana Sayfa',
    });
  }, [navigation]);

  const newHandleLikePress = async (postId: string) => {
    if (!user || !user.id) {
      Alert.alert("Giriş Yapın", "Beğeni yapmak için giriş yapmalısınız.");
      return;
    }
    const userId = user.id;

    // 1. Check current liked status (or use the isLiked from state)
    const postIndex = feedPosts.findIndex(p => p.id === postId);
    if (postIndex === -1) return;
    
    const currentlyLiked = feedPosts[postIndex].isLiked || false;
    
    // Optimistic UI update
    const originalFeedPosts = JSON.parse(JSON.stringify(feedPosts)); // Deep copy
    setFeedPosts(prevPosts =>
      prevPosts.map(p => {
        if (p.id === postId) {
          return {
            ...p,
            likes_count: currentlyLiked ? Math.max(0, p.likes_count - 1) : p.likes_count + 1,
            isLiked: !currentlyLiked, // Toggle liked status
          };
        }
        return p;
      })
    );
  
    // 2. Perform action
    try {
      const success = currentlyLiked 
        ? await socialSharingService.unlikePost(userId, postId)
        : await socialSharingService.likePost(userId, postId);
  
      if (!success) {
        setFeedPosts(originalFeedPosts); // Revert
        Alert.alert("Hata", "İşlem başarısız oldu.");
      } 
      // No need to do anything else on success as UI is already updated optimistically
    } catch (error) {
      console.error("Error during like/unlike:", error);
      setFeedPosts(originalFeedPosts); // Revert
      Alert.alert("Hata", "Bir sorun oluştu.");
    }
  };

  // Konum bazlı görevleri getir
  const fetchLocationBasedChallenges = async (city: string) => {
    try {
      console.log(`[fetchLocationBasedChallenges] Fetching challenges for ${city}`);
      const locationChallenges = await locationChallengeService.getLocationBasedChallenges(city);
      
      if (locationChallenges && locationChallenges.length > 0) { // City specific challenges found
        console.log(`[fetchLocationBasedChallenges] Found ${locationChallenges.length} challenges for ${city}`);
        
        // Prioritize location-based challenge as daily challenge
        // If no daily challenge yet, or if current one is a mock, or if we always prefer location one.
        // Also check if the current daily challenge is already for this city.
        const currentDailyChallengeIsForThisCity = dailyChallenge && dailyChallenge.location === city && !mockChallengeUsed;

        if (!dailyChallenge || mockChallengeUsed || !currentDailyChallengeIsForThisCity) {
          setDailyChallenge(locationChallenges[0]);
          setMockChallengeUsed(false); // It's a real, location-based challenge now
          console.log(`[fetchLocationBasedChallenges] Set daily challenge to "${locationChallenges[0].title}" from ${city}`);
        }
        
        // Update the main challenges list, avoiding duplicates
        setChallenges(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const newChallenges = locationChallenges.filter(c => !existingIds.has(c.id));
          return [...prev, ...newChallenges];
        });
      } else {
        console.log(`[fetchLocationBasedChallenges] No specific challenges found for ${city}. Current daily challenge: ${dailyChallenge?.title}`);
        // If no location-specific challenges are found, and the current dailyChallenge was a mock one,
        // loadInitialData would have set a general or new mock one.
        // If a general non-mock daily challenge exists, it will persist.
      }
    } catch (error) {
      console.error(`[fetchLocationBasedChallenges] Error fetching challenges for ${city}:`, error);
    }
  };

  if (loading || (locationLoading && !userCity && !locationError)) { // Show loading if initial data or location is still loading
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]} edges={['right', 'left']}>
        <ActivityIndicator size="large" color={THEME.COLORS.primary} />
        <ThemedText style={styles.loadingText}>Veriler yükleniyor...</ThemedText>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, styles.errorContainer]} edges={['right', 'left']}>
        <FontAwesome5 name="exclamation-circle" size={50} color={THEME.COLORS.error} />
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => {
            setError(null);
            fetchLocation(); // Attempt to refetch location
            loadInitialData(); // Reload other data
          }}
        >
          <ThemedText style={styles.retryButtonText}>Tekrar Dene</ThemedText>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['right', 'left']}>
      <StatusBar style="auto" />
      {/* Header */}
      <View style={styles.header}>
        <View>
          <ThemedText style={styles.greeting}>Merhaba, {user?.username || 'Gezgin'} {userCity ? `(${userCity})` : ''}</ThemedText>
          <View style={styles.pointsContainer}>
            <ThemedText style={{ color: THEME.COLORS.accent }}>
              <FontAwesome5 name="star" size={16} />
            </ThemedText>
            <ThemedText style={styles.pointsText}>{user?.total_points || 0} Puan</ThemedText>
          </View>
        </View>
        <TouchableOpacity 
          style={styles.profileIcon} 
          onPress={() => router.push('/(tabs)/profile')}
        >
          <Image 
            source={{ uri: user?.avatar_url || 'https://randomuser.me/api/portraits/men/1.jpg' }} 
            style={styles.avatar} 
          />
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={styles.scrollContainer} 
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Featured Challenge */}
        {dailyChallenge && (
          <ThemedView style={styles.featuredCard}>
            <Image 
              source={{ uri: dailyChallenge.image_url || dailyChallenge.image || 'https://images.unsplash.com/photo-1501785888041-af3ef285b470' }} 
              style={styles.featuredImage}
              contentFit="cover"
            />
            <View style={styles.featuredOverlay}>
              <View style={styles.featuredContent}>
                <ThemedText style={styles.featuredTag}>
                  {mockChallengeUsed ? 'Önerilen Görev' : 'Günün Görevi'}
                </ThemedText>
                <ThemedText style={styles.featuredTitle}>{dailyChallenge.title}</ThemedText>
                <ThemedText style={styles.featuredDescription}>{dailyChallenge.description}</ThemedText>
                <View style={styles.featuredFooter}>
                  <View style={styles.featuredPoints}>
                    <ThemedText style={{ color: THEME.COLORS.accent }}>
                      <FontAwesome5 name="star" size={16} />
                    </ThemedText>
                    <ThemedText style={styles.featuredPointsText}>{dailyChallenge.points} Puan</ThemedText>
                  </View>
                  <TouchableOpacity 
                    style={styles.featuredButton}
                    onPress={() => {
                      if (mockChallengeUsed) {
                        Alert.alert('Katılım Başarılı', 'Bu göreve katıldınız! Tamamlandığında puanları kazanacaksınız.');
                      } else {
                        router.push(`/challenge/${dailyChallenge.id}`);
                      }
                    }}
                  >
                    <ThemedText style={styles.featuredButtonText}>Katıl</ThemedText>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </ThemedView>
        )}

        {/* Nearby Places */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Yakınındaki Yerler</ThemedText>
            <TouchableOpacity onPress={() => router.push('/(tabs)/explore')}>
              <ThemedText style={styles.seeAllText}>Tümünü Gör</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Yakındaki yerler API'den yükleniyor */}
          {loadingNearby ? (
            <ThemedView style={styles.loadingNearbyContainer}>
              <ActivityIndicator size="small" color={THEME.COLORS.primary} />
              <ThemedText style={styles.loadingNearbyText}>Yakınındaki yerler aranıyor...</ThemedText>
            </ThemedView>
          ) : nearbyPlaces.length > 0 ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={nearbyPlaces}
              keyExtractor={(item, index) => item.id || `nearby-${index}`}
              contentContainerStyle={styles.flatListContent}
              renderItem={({ item }) => {
                const photoUrl = item.photos && item.photos.length > 0
                  ? getPlacePhoto(item.photos[0].photo_reference)
                  : 'https://via.placeholder.com/400x200?text=No+Image';
                
                return (
                  <TouchableOpacity 
                    style={styles.placeCard}
                    activeOpacity={0.8}
                    onPress={() => {
                      Alert.alert(
                        item.name,
                        `${item.vicinity}${item.rating ? `\nPuan: ${item.rating}/5` : ''}`,
                        [
                          { text: 'Kapat', style: 'cancel' },
                          { 
                            text: 'Keşfet', 
                            onPress: () => router.push('/(tabs)/explore')
                          }
                        ]
                      );
                    }}
                  >
                    <ThemedView style={styles.cardContainer}>
                      <LinearGradient
                        colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
                        style={styles.gradientOverlay}
                      />
                      <Image 
                        source={{ uri: photoUrl }}
                        style={styles.placeImage}
                        contentFit="cover"
                      />
                      <View style={styles.placeInfo}>
                        <ThemedText style={styles.placeName} numberOfLines={2}>
                          {item.name}
                        </ThemedText>
                        <View style={styles.placeDetails}>
                          <View style={styles.placeType}>
                            <FontAwesome5 
                              name={
                                item.types.includes('museum') ? 'university' :
                                item.types.includes('park') ? 'tree' :
                                item.types.includes('restaurant') ? 'utensils' :
                                'landmark'
                              } 
                              size={12} 
                              color={THEME.COLORS.light}
                            />
                            <ThemedText style={styles.placeTypeText}>
                              {item.types[0].replace(/_/g, ' ')}
                            </ThemedText>
                          </View>
                          {item.rating && (
                            <View style={styles.placeRating}>
                              <FontAwesome5 name="star" size={12} color={THEME.COLORS.accent} />
                              <ThemedText style={styles.placeRatingText}>
                                {item.rating.toFixed(1)}
                              </ThemedText>
                            </View>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity style={styles.favoriteButton}>
                        <ThemedText style={{ color: THEME.COLORS.accent }}>
                          <FontAwesome5 name="heart" size={16} />
                        </ThemedText>
                      </TouchableOpacity>
                    </ThemedView>
                  </TouchableOpacity>
                );
              }}
            />
          ) : places.length > 0 ? (
            // Yedek olarak Supabase'den yerler gösteriliyor
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={places.slice(0, 4)}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.flatListContent}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.placeCard}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/(tabs)/explore`)}
                >
                  <ThemedView style={styles.cardContainer}>
                    <LinearGradient
                      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
                      style={styles.gradientOverlay}
                    />
                    <Image 
                      source={{ uri: item.image_url || item.image }} 
                      style={styles.placeImage}
                      contentFit="cover"
                      transition={300}
                    />
                    <View style={styles.placeInfo}>
                      <ThemedText style={styles.placeName} numberOfLines={2}>
                        {item.name}
                      </ThemedText>
                      <View style={styles.placeDetails}>
                        <View style={styles.placeType}>
                          <FontAwesome5 
                            name={item.type === 'Tarihi Yer' ? 'landmark' : 
                                  item.type === 'Doğa Rotası' ? 'mountain' : 'store'} 
                            size={12} 
                            color={THEME.COLORS.light} 
                          />
                          <ThemedText style={styles.placeTypeText}>{item.type}</ThemedText>
                        </View>
                        <View style={styles.placeRating}>
                          <FontAwesome5 name="star" size={12} color={THEME.COLORS.accent} />
                          <ThemedText style={styles.placeRatingText}>{item.points}</ThemedText>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.favoriteButton}>
                      <ThemedText style={{ color: THEME.COLORS.accent }}>
                        <FontAwesome5 name="heart" size={16} />
                      </ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                </TouchableOpacity>
              )}
            />
          ) : (
            <ThemedView style={styles.emptyStateContainer}>
              <FontAwesome5 name="map-marker-alt" size={24} color={THEME.COLORS.primary} />
              <ThemedText style={styles.emptyStateText}>Henüz yakınınızda yer bulunamadı</ThemedText>
            </ThemedView>
          )}
        </View>

        {/* Popular Challenges */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Popüler Görevler</ThemedText>
            <TouchableOpacity onPress={() => router.push('/(tabs)/challenges')}>
              <ThemedText style={styles.seeAllText}>Tümünü Gör</ThemedText>
            </TouchableOpacity>
          </View>

          {challenges.length > 0 ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={challenges}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.flatListContent}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.placeCard}
                  activeOpacity={0.8}
                  onPress={() => router.push(`/challenge/${item.id}`)}
                >
                  <ThemedView style={styles.cardContainer}>
                    <LinearGradient
                      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']}
                      style={styles.gradientOverlay}
                    />
                    <Image 
                      source={{ uri: item.image_url || item.image || 'https://images.unsplash.com/photo-1501785888041-af3ef285b470' }} 
                      style={styles.placeImage}
                      contentFit="cover"
                    />
                    <View style={styles.placeInfo}>
                      <ThemedText style={styles.placeName} numberOfLines={2}>
                        {item.title}
                      </ThemedText>
                      <View style={styles.placeDetails}>
                        <View style={styles.placeType}>
                          <FontAwesome5 
                            name={item.challenge_type === 'visit' ? 'map-marker-alt' : 
                                  item.challenge_type === 'photo' ? 'camera' : 
                                  item.challenge_type === 'social' ? 'users' : 
                                  item.challenge_type === 'gastronomy' ? 'utensils' :
                                  'tasks'} 
                            size={12} 
                            color={THEME.COLORS.light} 
                          />
                          <ThemedText style={styles.placeTypeText}>
                            {item.category || item.challenge_type || 'Genel'}
                          </ThemedText>
                        </View>
                        <View style={styles.placeRating}>
                          <FontAwesome5 name="star" size={12} color={THEME.COLORS.accent} />
                          <ThemedText style={styles.placeRatingText}>{item.points}</ThemedText>
                        </View>
                      </View>
                    </View>
                    <TouchableOpacity style={styles.favoriteButton}>
                      <ThemedText style={{ color: THEME.COLORS.accent }}>
                        <FontAwesome5 name="bookmark" size={16} />
                      </ThemedText>
                    </TouchableOpacity>
                  </ThemedView>
                </TouchableOpacity>
              )}
            />
          ) : (
            <ThemedView style={styles.emptyStateContainer}>
              <FontAwesome5 name="tasks" size={24} color={THEME.COLORS.primary} />
              <ThemedText style={styles.emptyStateText}>Henüz görev bulunamadı</ThemedText>
            </ThemedView>
          )}
        </View>

        {/* My Routes Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Rotalarım</ThemedText>
            <TouchableOpacity onPress={() => router.push(`/route` as any)}>
              <ThemedText style={styles.seeAllText}>Yeni Rota Oluştur</ThemedText>
            </TouchableOpacity>
          </View>

          <ThemedView style={styles.routesContainer}>
            <TouchableOpacity 
              style={styles.createRouteCard}
              activeOpacity={0.8}
              onPress={() => router.push(`/route` as any)}
            >
              <LinearGradient
                colors={[THEME.COLORS.primary, THEME.COLORS.secondary]}
                style={styles.routeGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <FontAwesome5 name="route" size={24} color="white" />
                <ThemedText style={styles.createRouteText}>Yeni Rota Oluştur</ThemedText>
                <ThemedText style={styles.createRouteSubtext}>
                  Başlangıç ve varış noktalarını belirle, rota üzerindeki yerleri keşfet
                </ThemedText>
              </LinearGradient>
            </TouchableOpacity>
          </ThemedView>
        </View>

        {/* Feed Posts / Gezgin Hikayeleri */}
        <View style={[styles.sectionContainer, styles.lastSection]}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Gezgin Hikayeleri</ThemedText>
            <TouchableOpacity>
              <ThemedText style={styles.seeAllText}>Tümünü Gör</ThemedText>
            </TouchableOpacity>
          </View>

          {feedPosts.length > 0 ? (
            feedPosts.map((post) => (
              <ThemedView key={post.id} style={styles.storyCard}>
                <View style={styles.storyHeader}>
                  <Image
                    source={{ uri: post.user?.avatar_url || 'https://randomuser.me/api/portraits/men/1.jpg' }}
                    style={styles.storyAvatar}
                  />
                  <View>
                    <ThemedText style={styles.storyUsername}>{post.user?.username || 'Gezgin'}</ThemedText>
                    {post.location && (
                      <View style={styles.storyPlace}>
                        <FontAwesome5 name="map-marker-alt" size={12} color={THEME.COLORS.primary} />
                        <ThemedText style={styles.storyPlaceText}>{post.location}</ThemedText>
                      </View>
                    )}
                  </View>
                  <ThemedText style={styles.storyTime}>
                    {new Date(post.created_at).toLocaleDateString('tr-TR', {
                      day: 'numeric',
                      month: 'short'
                    })}
                  </ThemedText>
                </View>

                {post.image_url && (
                  <Image
                    source={{ uri: post.image_url }}
                    style={styles.storyImage}
                    resizeMode="cover"
                  />
                )}

                <ThemedText style={styles.storyDescription}>{post.content}</ThemedText>

                <View style={styles.storyActions}>
                  <TouchableOpacity style={styles.storyAction} onPress={() => newHandleLikePress(post.id)}>
                    <FontAwesome5 
                      name="heart" 
                      size={16} 
                      color={post.isLiked ? THEME.COLORS.accent : THEME.COLORS.gray} 
                      solid={post.isLiked} // Use solid heart icon if liked
                    />
                    <ThemedText style={styles.storyActionText}>{post.likes_count || 0}</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.storyAction}>
                    <FontAwesome5 name="comment" size={16} color={THEME.COLORS.gray} />
                    <ThemedText style={styles.storyActionText}>{post.comments_count || 0}</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.storyAction}>
                    <FontAwesome5 name="share" size={16} color={THEME.COLORS.gray} />
                  </TouchableOpacity>
                </View>
              </ThemedView>
            ))
          ) : (
            <ThemedView style={styles.emptyStateContainer}>
              <FontAwesome5 name="book-open" size={24} color={THEME.COLORS.primary} />
              <ThemedText style={styles.emptyStateText}>Henüz hikaye paylaşılmamış</ThemedText>
            </ThemedView>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.COLORS.background,
  },
  loadingNearbyContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingNearbyText: {
    marginLeft: 8,
    fontSize: THEME.SIZES.medium,
    color: THEME.COLORS.gray,
  },
  flatListContent: {
    paddingRight: 16,
  },
  scrollContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
  },
  greeting: {
    fontSize: THEME.SIZES.large,
    fontWeight: 'bold',
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  pointsText: {
    marginLeft: 5,
    fontSize: THEME.SIZES.medium,
    color: THEME.COLORS.accent,
    fontWeight: 'bold',
  },
  profileIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: THEME.COLORS.primary,
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  featuredCard: {
    margin: 20,
    marginTop: 5,
    borderRadius: 15,
    overflow: 'hidden',
    height: 200,
  },
  featuredImage: {
    width: '100%',
    height: '100%',
  },
  featuredOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
  featuredContent: {
    padding: 15,
  },
  featuredTag: {
    color: THEME.COLORS.light,
    fontSize: THEME.SIZES.small,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    backgroundColor: THEME.COLORS.accent,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 8,
  },
  featuredTitle: {
    color: THEME.COLORS.light,
    fontSize: THEME.SIZES.xlarge,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  featuredDescription: {
    color: THEME.COLORS.light,
    fontSize: THEME.SIZES.medium,
    marginBottom: 10,
  },
  featuredFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  featuredPoints: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  featuredPointsText: {
    color: THEME.COLORS.light,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  featuredButton: {
    backgroundColor: THEME.COLORS.primary,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  featuredButtonText: {
    color: THEME.COLORS.light,
    fontWeight: 'bold',
  },
  sectionContainer: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  lastSection: {
    marginBottom: 40, // Add extra space at the bottom for the last section
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: THEME.SIZES.large,
    fontWeight: 'bold',
  },
  seeAllText: {
    color: THEME.COLORS.primary,
    fontWeight: 'bold',
  },
  placeCard: {
    width: 280,
    height: 200,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: THEME.COLORS.card,
    shadowColor: THEME.COLORS.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  cardContainer: {
    flex: 1,
    position: 'relative',
  },
  gradientOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: '70%',
    zIndex: 1,
  },
  placeImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
  },
  placeInfo: {
    position: 'absolute',
    bottom: 16,
    left: 16,
    right: 16,
    zIndex: 2,
  },
  placeName: {
    fontSize: THEME.SIZES.large,
    fontWeight: 'bold',
    color: THEME.COLORS.light,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.5,
    shadowRadius: 2,
  },
  placeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  placeType: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  placeTypeText: {
    fontSize: THEME.SIZES.small,
    color: THEME.COLORS.light,
    marginLeft: 6,
    textTransform: 'capitalize',
    fontWeight: '600',
  },
  placeRating: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  placeRatingText: {
    fontSize: THEME.SIZES.small,
    color: THEME.COLORS.light,
    marginLeft: 6,
    fontWeight: '600',
  },
  favoriteButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 30,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  routesContainer: {
    marginVertical: 8,
  },
  createRouteCard: {
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  routeGradient: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  createRouteText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 12,
    marginBottom: 8,
  },
  createRouteSubtext: {
    fontSize: 13,
    color: '#fff',
    opacity: 0.8,
    textAlign: 'center',
    maxWidth: '90%',
  },
  storyCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: THEME.COLORS.card,
    shadowColor: THEME.COLORS.shadowColor,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 2,
  },
  storyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
  },
  storyAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  storyUsername: {
    fontWeight: 'bold',
    fontSize: THEME.SIZES.medium,
  },
  storyPlace: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  storyPlaceText: {
    fontSize: 12,
    marginLeft: 5,
    color: THEME.COLORS.gray,
  },
  storyTime: {
    fontSize: 12,
    color: THEME.COLORS.gray,
    marginLeft: 'auto',
  },
  storyImage: {
    width: '100%',
    height: 200,
  },
  storyDescription: {
    padding: 15,
    fontSize: THEME.SIZES.medium,
  },
  storyActions: {
    flexDirection: 'row',
    paddingHorizontal: 15,
    paddingBottom: 15,
  },
  storyAction: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 20,
  },
  storyActionText: {
    marginLeft: 5,
    fontSize: THEME.SIZES.small,
    color: THEME.COLORS.gray,
  },
  // Yükleme durumu için stiller
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: THEME.SIZES.medium,
    color: THEME.COLORS.primary,
  },
  // Hata durumu için stiller
  errorContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    marginTop: 15,
    fontSize: THEME.SIZES.medium,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 40,
  },
  retryButton: {
    backgroundColor: THEME.COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: {
    color: THEME.COLORS.light,
    fontWeight: 'bold',
  },
  // Boş durum için stiller
  emptyStateContainer: {
    marginHorizontal: 20,
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: THEME.COLORS.card,
    shadowColor: THEME.COLORS.shadowColor,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 2,
  },
  emptyStateText: {
    marginTop: 10,
    textAlign: 'center',
    color: THEME.COLORS.gray,
    fontSize: THEME.SIZES.medium,
  },
});
