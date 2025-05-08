import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, FlatList, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { THEME } from '@/constants/Theme';
import { feedService } from '@/services/feedService';
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
  createPlaceFromGoogleData
} from '@/lib/googleMapsService';

export default function HomeScreen() {
  const [loading, setLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [loadingNearby, setLoadingNearby] = useState<boolean>(true);
  const [location, setLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [dailyChallenge, setDailyChallenge] = useState<Challenge | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [mockChallengeUsed, setMockChallengeUsed] = useState<boolean>(false);

  // Kullanıcının konumunu al
  const getUserLocation = async () => {
    try {
      const currentLocation = await getCurrentLocation();
      if (currentLocation) {
        setLocation(currentLocation);
        // Konumu aldıktan sonra yakındaki yerleri ara
        fetchNearbyPlaces(currentLocation);
      }
    } catch (err) {
      console.error('Konum alırken hata:', err);
      // Konum alınamazsa, yedek olarak Supabase'den yerler gösterilecek
    }
  };

  // Yakındaki yerleri Google Places API ile ara
  const fetchNearbyPlaces = async (userLocation: { latitude: number; longitude: number }) => {
    try {
      setLoadingNearby(true);
      
      // Progressive search with expanding radius
      const searchRadii = [1000, 5000, 10000, 20000, 50000]; // Meters
      let nearbyResults = null;
      let usedRadius = 0;
      
      // Try with progressively larger radius until we find something
      for (const radius of searchRadii) {
        console.log(`[fetchNearbyPlaces] Searching within ${radius}m radius...`);
        nearbyResults = await searchNearbyPlaces(userLocation, radius);
        
        if (nearbyResults && nearbyResults.length > 0) {
          console.log(`[fetchNearbyPlaces] Found ${nearbyResults.length} results at ${radius}m radius`);
          usedRadius = radius;
          break;
        }
      }
      
      if (!nearbyResults || nearbyResults.length === 0) {
        console.log('[fetchNearbyPlaces] No results found even at largest radius.');
        setNearbyPlaces([]); // No results found
      } else {
        console.log(`[fetchNearbyPlaces] Found ${nearbyResults.length} results at ${usedRadius}m.`);
        setNearbyPlaces(nearbyResults.slice(0, 5)); // Sadece ilk 5 sonucu göster
        
        // Yakındaki ilk yerden şehir bilgisini çıkarıp buna göre challenge getir
        if (nearbyResults.length > 0 && nearbyResults[0].vicinity) {
          const city = extractCityFromVicinity(nearbyResults[0].vicinity);
          if (city) {
            // Veritabanında kullanmak için yerleri ekle
            const placesToAdd = nearbyResults.slice(0, 5); // İlk 5 yeri ekle
            for (const place of placesToAdd) {
              try {
                // Using the outer savePlaceToDatabase function
                await createPlaceFromGoogleData(place, city);
              } catch (err) {
                console.error(`Error saving place ${place.name} to database:`, err);
              }
            }
            
            // Konum bazlı görevleri getir
            fetchLocationBasedChallenges(city);
          }
        }
      }
    } catch (err) {
      // Log the specific error, check if it's ZERO_RESULTS
      if (err instanceof Error && err.message.includes('ZERO_RESULTS')) {
        console.warn('[fetchNearbyPlaces] Google Places API returned ZERO_RESULTS. Falling back to Supabase data if available.');
      } else {
        console.error('[fetchNearbyPlaces] Error searching nearby places:', err);
      }
      setNearbyPlaces([]); // Hata durumunda da boşalt
    } finally {
      setLoadingNearby(false);
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Tüm verileri paralel olarak yükle
      const [userData, placesData, challengesData, dailyChallengeData, feedPostsData] = await Promise.all([
        userService.getCurrentUser(),
        placesService.getAllPlaces(),
        challengesService.getAllChallenges(),
        challengesService.getDailyChallenge(),
        feedService.getAllPosts()
      ]);
      
      setUser(userData);
      setPlaces(placesData || []);
      setChallenges(challengesData || []);
      
      // Günün görevi için veri yoksa default veri kullan
      if (dailyChallengeData) {
        setDailyChallenge(dailyChallengeData);
        setMockChallengeUsed(false);
      } else {
        console.log('No daily challenge from API, using default data');
        // API'den veri yoksa varsayılan bir challenge oluştur
        const defaultChallenge = {
          id: 'default-challenge-1',
          title: 'İstanbul Keşif Rotası',
          description: 'İstanbul\'un en popüler 3 turistik noktasını ziyaret edin ve fotoğraf paylaşın.',
          points: 500,
          image_url: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200',
          deadline: '3 gün',
          challenge_type: 'general' as 'general',
          category: 'general' as 'general',
        };
        
        setDailyChallenge(defaultChallenge);
        setMockChallengeUsed(true);
      }
      
      // FeedPost tipi uyumsuzluğunu çözmek için tip dönüşümü
      if (feedPostsData) {
        setFeedPosts(feedPostsData as any);
      }
      
      // Konum ve yakın yerleri yükle
      getUserLocation();
    } catch (err) {
      console.error('Veri yükleme hatası:', err);
      setError('Veriler yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadData();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  // Adres bilgisinden şehir adını çıkarmak için yardımcı fonksiyon
  const extractCityFromVicinity = (vicinity: string): string | null => {
    if (!vicinity) return null;
    
    // Turkish cities list to help with identification
    const turkishCities = [
      'İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Adana', 'Gaziantep', 'Konya', 
      'Antalya', 'Kayseri', 'Mersin', 'Eskişehir', 'Diyarbakır', 'Şanlıurfa',
      'Samsun', 'Malatya', 'Gebze', 'Denizli', 'Sivas', 'Erzurum', 'Tokat',
      'Hatay', 'Manisa', 'Batman', 'Kahramanmaraş', 'Van', 'Elazığ', 'Tekirdağ',
      'Adapazarı', 'Kocaeli', 'İzmit'  // Adding İzmit explicitly for the current case
    ];
    
    // First, check if any city name is directly in the vicinity string
    for (const city of turkishCities) {
      if (vicinity.includes(city)) {
        return city;
      }
    }
    
    // Örnek: "Beyoğlu, İstanbul" -> "İstanbul"
    // Örnek: "Taksim Meydanı, İstanbul" -> "İstanbul"
    const parts = vicinity.split(',');
    if (parts.length > 1) {
      // Take the last part, which is often the city
      const lastPart = parts[parts.length - 1].trim();
      return lastPart;
    }
    
    // If we couldn't identify a city, return the whole string or a default
    return vicinity.trim();
  };

  // Konum bazlı görevleri getir
  const fetchLocationBasedChallenges = async (city: string) => {
    try {
      console.log(`[fetchLocationBasedChallenges] Fetching challenges for ${city}`);
      const locationChallenges = await locationChallengeService.getLocationBasedChallenges(city);
      
      if (locationChallenges && locationChallenges.length > 0) {
        console.log(`[fetchLocationBasedChallenges] Found ${locationChallenges.length} challenges for ${city}`);
        
        // Eğer günün görevi yoksa, ilk lokasyon challenge'ını günün görevi olarak ayarla
        if (!dailyChallenge || mockChallengeUsed) {
          setDailyChallenge(locationChallenges[0]);
          setMockChallengeUsed(false);
          console.log(`[fetchLocationBasedChallenges] Set daily challenge to "${locationChallenges[0].title}"`);
        }
        
        // Genel görevleri güncelle
        setChallenges(prev => {
          // Yeni görevleri ekleyip tekrarları önle (id'ye göre)
          const existingIds = new Set(prev.map(c => c.id));
          const newChallenges = locationChallenges.filter(c => !existingIds.has(c.id));
          return [...prev, ...newChallenges];
        });
      } else {
        console.log(`[fetchLocationBasedChallenges] No challenges found for ${city}, but default challenges should have been created`);
      }
    } catch (error) {
      console.error(`[fetchLocationBasedChallenges] Error fetching challenges for ${city}:`, error);
    }
  };

  if (loading) {
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
            loadData();
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
          <ThemedText style={styles.greeting}>Merhaba, {user?.username || 'Gezgin'}</ThemedText>
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
                  <TouchableOpacity style={styles.storyAction}>
                    <FontAwesome5 name="heart" size={16} color={THEME.COLORS.gray} />
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
