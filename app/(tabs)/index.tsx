import React, { useEffect, useState, useCallback } from 'react';
import { StyleSheet, ScrollView, View, TouchableOpacity, FlatList, ActivityIndicator, Alert, RefreshControl, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import Toast from 'react-native-toast-message';

import { ThemedText, ThemedTextProps } from '@/components/ThemedText';
import { ThemedView, ThemedViewProps } from '@/components/ThemedView';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { THEME } from '@/constants/Theme'; // For static colors like error, success
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
  createPlaceFromGoogleData,
  // Ensure Place type from googleMapsService is compatible or use a specific SupabasePlace type
} from '@/lib/googleMapsService';
import { 
  addFavoritePlace, 
  removeFavoritePlace, 
  getUserFavoritePlaceIds 
} from '@/services/favoritesService'; 
import {
  addBookmarkedChallenge,
  removeBookmarkedChallenge,
  getUserBookmarkedChallengeIds,
} from '@/services/bookmarkService'; // Import bookmark services
// import Toast from 'react-native-toast-message'; // Optional: for user feedback

export default function HomeScreen() {
  const theme = useColorScheme() ?? 'light';
  const [loading, setLoading] = useState<boolean>(true);
  const [user, setUser] = useState<User | null>(null);
  const [places, setPlaces] = useState<Place[]>([]); // Fallback places from Supabase
  const [nearbyPlaces, setNearbyPlaces] = useState<Place[]>([]); // Unified to use Place type from Supabase
  const [loadingNearby, setLoadingNearby] = useState<boolean>(true);
  const [location, setLocation] = useState<{latitude: number; longitude: number} | null>(null);
  const [dailyChallenge, setDailyChallenge] = useState<Challenge | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [feedPosts, setFeedPosts] = useState<FeedPost[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [mockChallengeUsed, setMockChallengeUsed] = useState<boolean>(false);
  const [favoritePlaceIds, setFavoritePlaceIds] = useState<string[]>([]);
  const [favoriteLoading, setFavoriteLoading] = useState<Record<string, boolean>>({});
  const [bookmarkedChallengeIds, setBookmarkedChallengeIds] = useState<string[]>([]);
  const [bookmarkLoading, setBookmarkLoading] = useState<Record<string, boolean>>({});


  // Kullanıcının konumunu al
  const getUserLocation = async () => {
    try {
      const currentLocation = await getCurrentLocation();
      if (currentLocation) {
        setLocation(currentLocation);
        fetchNearbyPlaces(currentLocation);
      }
    } catch (err) {
      console.error('Konum alırken hata:', err);
    }
  };

  // Yakındaki yerleri Google Places API ile ara ve Supabase'e kaydet
  const fetchNearbyPlaces = async (userLocation: { latitude: number; longitude: number }) => {
    try {
      setLoadingNearby(true);
      const searchRadii = [1000, 5000, 10000, 20000, 50000];
      let googleNearbyResults: NearbyPlace[] = []; // Type from googleMapsService
      let usedRadius = 0;

      for (const radius of searchRadii) {
        console.log(`[fetchNearbyPlaces] Searching within ${radius}m radius...`);
        const results = await searchNearbyPlaces(userLocation, radius); // This now returns Google's NearbyPlace[]
        if (results && results.length > 0) {
          googleNearbyResults = results;
          usedRadius = radius;
          break;
        }
      }

      if (!googleNearbyResults || googleNearbyResults.length === 0) {
        console.log('[fetchNearbyPlaces] No results found even at largest radius.');
        setNearbyPlaces([]);
      } else {
        console.log(`[fetchNearbyPlaces] Found ${googleNearbyResults.length} Google results at ${usedRadius}m.`);
        
        const city = googleNearbyResults.length > 0 && googleNearbyResults[0].vicinity 
          ? extractCityFromVicinity(googleNearbyResults[0].vicinity) 
          : await userService.getCityFromCoordinates(userLocation.latitude, userLocation.longitude) || 'unknown';

        const supabasePlacesPromises = googleNearbyResults.slice(0, 10).map(googlePlace => 
          createPlaceFromGoogleData(googlePlace, city)
        );
        
        const resolvedSupabasePlaces = await Promise.all(supabasePlacesPromises);
        const validSupabasePlaces = resolvedSupabasePlaces.filter(p => p !== null) as Place[];
        
        setNearbyPlaces(validSupabasePlaces.slice(0,5)); // Show top 5

        if (city && validSupabasePlaces.length > 0) {
          fetchLocationBasedChallenges(city);
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('ZERO_RESULTS')) {
        console.warn('[fetchNearbyPlaces] Google Places API returned ZERO_RESULTS.');
      } else {
        console.error('[fetchNearbyPlaces] Error searching nearby places:', err);
      }
      setNearbyPlaces([]);
    } finally {
      setLoadingNearby(false);
    }
  };
  
  const loadUserData = async () => {
    const userData = await userService.getCurrentUser();
    setUser(userData);
    if (userData) {
      try {
        const [favIds, bookmarkedIds] = await Promise.all([
          getUserFavoritePlaceIds(userData.id),
          getUserBookmarkedChallengeIds(userData.id)
        ]);
        setFavoritePlaceIds(favIds);
        setBookmarkedChallengeIds(bookmarkedIds);
      } catch (e) {
        console.error("Failed to load user favorites or bookmarks:", e);
        // Set to empty arrays in case of partial failure
        setFavoritePlaceIds(prev => prev || []); // Ensure it's an array
        setBookmarkedChallengeIds(prev => prev || []); // Ensure it's an array
      }
    }
  };

  const loadAppData = async () => {
    try {
      setLoading(true);
      await loadUserData(); // Load user data first

      const [placesData, challengesData, dailyChallengeData, feedPostsData] = await Promise.all([
        placesService.getAllPlaces(),
        challengesService.getAllChallenges(),
        challengesService.getDailyChallenge(),
        feedService.getAllPosts()
      ]);

      setPlaces(placesData || []);
      setChallenges(challengesData || []);

      if (dailyChallengeData) {
        setDailyChallenge(dailyChallengeData);
        setMockChallengeUsed(false);
      } else {
        const defaultChallenge = {
          id: 'default-challenge-1', title: 'İstanbul Keşif Rotası',
          description: 'İstanbul\'un en popüler 3 turistik noktasını ziyaret edin ve fotoğraf paylaşın.',
          points: 500, image_url: 'https://images.unsplash.com/photo-1524231757912-21f4fe3a7200',
          deadline: '3 gün', challenge_type: 'general' as 'general', category: 'general' as 'general',
        };
        setDailyChallenge(defaultChallenge);
        setMockChallengeUsed(true);
      }

      if (feedPostsData) {
        setFeedPosts(feedPostsData as any);
      }
      
      // If user is available, try to get location and nearby places
      if (user) {
         getUserLocation(); // This will call fetchNearbyPlaces
      } else {
        // If no user, perhaps load some default nearby places or handle appropriately
        setLoadingNearby(false); // Stop loading nearby if no user/location
      }

    } catch (err) {
      console.error('Veri yükleme hatası:', err);
      setError('Veriler yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    loadAppData();
  }, []);
  
  // Reload favorites and bookmarks when user changes
  useEffect(() => {
    if (user?.id) {
      Promise.all([
        getUserFavoritePlaceIds(user.id).catch(e => {
          console.error("Failed to refresh user favorites:", e);
          return favoritePlaceIds; // return current state on error
        }),
        getUserBookmarkedChallengeIds(user.id).catch(e => {
          console.error("Failed to refresh user bookmarks:", e);
          return bookmarkedChallengeIds; // return current state on error
        })
      ]).then(([favIds, bookmarkedIds]) => {
        setFavoritePlaceIds(favIds);
        setBookmarkedChallengeIds(bookmarkedIds);
      });
    }
  }, [user?.id]);


  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadAppData(); // Use loadAppData for refresh
    setRefreshing(false);
  }, []);

  const handleToggleFavorite = async (placeId: string) => {
    if (!user) {
      Alert.alert("Giriş Yapın", "Favorilere eklemek için giriş yapmanız gerekmektedir.");
      return;
    }
    if (!placeId) {
        Alert.alert("Hata", "Yer ID'si bulunamadı.");
        return;
    }

    setFavoriteLoading(prev => ({ ...prev, [placeId]: true }));
    const isCurrentlyFavorite = favoritePlaceIds.includes(placeId);

    try {
      let success = false;
      if (isCurrentlyFavorite) {
        success = await removeFavoritePlace(user.id, placeId);
        if (success) {
          setFavoritePlaceIds(prev => prev.filter(id => id !== placeId));
          // Toast.show({ type: 'success', text1: 'Favorilerden Kaldırıldı' });
          if (Platform.OS === 'web') alert('Favorilerden Kaldırıldı'); else Alert.alert('Favorilerden Kaldırıldı');
        }
      } else {
        success = await addFavoritePlace(user.id, placeId);
        if (success) {
          setFavoritePlaceIds(prev => [...prev, placeId]);
           // Toast.show({ type: 'success', text1: 'Favorilere Eklendi' });
          if (Platform.OS === 'web') alert('Favorilere Eklendi'); else Alert.alert('Favorilere Eklendi');
        }
      }
      if (!success) {
        // Toast.show({ type: 'error', text1: 'İşlem Başarısız' });
         if (Platform.OS === 'web') alert('İşlem Başarısız'); else Alert.alert('İşlem Başarısız', 'Favori işlemi sırasında bir hata oluştu.');
      }
    } catch (error) {
      console.error("Error toggling favorite:", error);
      // Toast.show({ type: 'error', text1: 'Bir hata oluştu' });
      if (Platform.OS === 'web') alert('Bir hata oluştu'); else Alert.alert('Bir hata oluştu', 'Favori işlemi sırasında bir hata oluştu.');
    } finally {
      setFavoriteLoading(prev => ({ ...prev, [placeId]: false }));
    }
  };

  const handleToggleBookmark = async (challengeId: string) => {
    if (!user) {
      Alert.alert("Giriş Yapın", "Yer işaretlerine eklemek için giriş yapmanız gerekmektedir.");
      return;
    }
    if (!challengeId) {
      Alert.alert("Hata", "Görev ID'si bulunamadı.");
      return;
    }

    setBookmarkLoading(prev => ({ ...prev, [challengeId]: true }));
    const isCurrentlyBookmarked = bookmarkedChallengeIds.includes(challengeId);

    try {
      let success = false;
      if (isCurrentlyBookmarked) {
        success = await removeBookmarkedChallenge(user.id, challengeId);
        if (success) {
          setBookmarkedChallengeIds(prev => prev.filter(id => id !== challengeId));
          if (Platform.OS === 'web') alert('Yer işaretlerinden kaldırıldı'); else Alert.alert('Yer işaretlerinden kaldırıldı');
        }
      } else {
        success = await addBookmarkedChallenge(user.id, challengeId);
        if (success) {
          setBookmarkedChallengeIds(prev => [...prev, challengeId]);
          if (Platform.OS === 'web') alert('Yer işaretlerine eklendi'); else Alert.alert('Yer işaretlerine eklendi');
        }
      }
      if (!success) {
        if (Platform.OS === 'web') alert('İşlem Başarısız'); else Alert.alert('İşlem Başarısız', 'Yer işareti işlemi sırasında bir hata oluştu.');
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error);
      if (Platform.OS === 'web') alert('Bir hata oluştu'); else Alert.alert('Bir hata oluştu', 'Yer işareti işlemi sırasında bir hata oluştu.');
    } finally {
      setBookmarkLoading(prev => ({ ...prev, [challengeId]: false }));
    }
  };
  
  const extractCityFromVicinity = (vicinity: string): string | null => {
    if (!vicinity) return null;
    const turkishCities = [
      'İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Adana', 'Gaziantep', 'Konya', 
      'Antalya', 'Kayseri', 'Mersin', 'Eskişehir', 'Diyarbakır', 'Şanlıurfa',
      'Samsun', 'Malatya', 'Gebze', 'Denizli', 'Sivas', 'Erzurum', 'Tokat',
      'Hatay', 'Manisa', 'Batman', 'Kahramanmaraş', 'Van', 'Elazığ', 'Tekirdağ',
      'Adapazarı', 'Kocaeli', 'İzmit'
    ];
    for (const city of turkishCities) {
      if (vicinity.includes(city)) return city;
    }
    const parts = vicinity.split(',');
    if (parts.length > 1) return parts[parts.length - 1].trim();
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
      <SafeAreaView style={[{ flex: 1, backgroundColor: Colors[theme].background }, styles.loadingContainer]} edges={['right', 'left']}>
        <ActivityIndicator size="large" color={Colors[theme].primary} />
        <ThemedText style={[styles.loadingText, { color: Colors[theme].primary }]}>Veriler yükleniyor...</ThemedText>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[{ flex: 1, backgroundColor: Colors[theme].background }, styles.errorContainer]} edges={['right', 'left']}>
        <FontAwesome5 name="exclamation-circle" size={50} color={THEME.COLORS.error} />
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <TouchableOpacity
          style={[styles.retryButton, { backgroundColor: Colors[theme].primary }]}
          onPress={() => {
            setError(null);
            loadAppData(); // Changed from loadData
          }}
        >
          <ThemedText style={[styles.retryButtonText, { color: Colors.dark.text /* Assuming white/light text on primary */ }]}>Tekrar Dene</ThemedText>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors[theme].background }]} edges={['right', 'left']}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      {/* Header */}
      <View style={[styles.header, { backgroundColor: Colors[theme].background }]}>
        <View>
          <ThemedText style={styles.greeting}>Merhaba, {user?.username || 'Gezgin'}</ThemedText>
          <View style={styles.pointsContainer}>
            <FontAwesome5 name="star" size={16} color={Colors[theme].accent} />
            <ThemedText style={[styles.pointsText, { color: Colors[theme].accent }]}>{user?.total_points || 0} Puan</ThemedText>
          </View>
        </View>
        <TouchableOpacity 
          style={[styles.profileIcon, { borderColor: Colors[theme].primary }]} 
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
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            tintColor={Colors[theme].primary} // For iOS
            colors={[Colors[theme].primary]} // For Android
          />
        }
      >
        {/* Featured Challenge */}
        {dailyChallenge && (
          <ThemedView 
            lightColor={Colors.light.card} 
            darkColor={Colors.dark.card} 
            style={[styles.featuredCard, { shadowColor: Colors[theme].shadowColor }]}
          >
            <Image 
              source={{ uri: dailyChallenge.image_url || dailyChallenge.image || 'https://images.unsplash.com/photo-1501785888041-af3ef285b470' }} 
              style={styles.featuredImage}
              contentFit="cover"
            />
            <View style={styles.featuredOverlay}>
              <View style={styles.featuredContent}>
                <ThemedText style={[styles.featuredTag, { backgroundColor: Colors[theme].accent, color: Colors.dark.text /* Static light text for high contrast on accent */}]}>
                  {mockChallengeUsed ? 'Önerilen Görev' : 'Günün Görevi'}
                </ThemedText>
                <ThemedText style={[styles.featuredTitle, {color: Colors.dark.text /* Static light text for high contrast on overlay */}]}>{dailyChallenge.title}</ThemedText>
                <ThemedText style={[styles.featuredDescription, {color: Colors.dark.text /* Static light text for high contrast on overlay */}]}>{dailyChallenge.description}</ThemedText>
                <View style={styles.featuredFooter}>
                  <View style={styles.featuredPoints}>
                    <FontAwesome5 name="star" size={16} color={Colors[theme].accent} />
                    <ThemedText style={[styles.featuredPointsText, {color: Colors.dark.text /* Static light text for high contrast on overlay */}]}>{dailyChallenge.points} Puan</ThemedText>
                  </View>
                  <TouchableOpacity 
                    style={[styles.featuredButton, { backgroundColor: Colors[theme].primary }]}
                    onPress={() => {
                      if (mockChallengeUsed) {
                        Alert.alert('Katılım Başarılı', 'Bu göreve katıldınız! Tamamlandığında puanları kazanacaksınız.');
                      } else {
                        router.push(`/challenge/${dailyChallenge.id}`);
                      }
                    }}
                  >
                    <ThemedText style={[styles.featuredButtonText, { color: Colors.dark.text /* Static light text for high contrast on primary */ }]}>Katıl</ThemedText>
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
              <ThemedText style={[styles.seeAllText, { color: Colors[theme].primary }]}>Tümünü Gör</ThemedText>
            </TouchableOpacity>
          </View>

          {/* Yakındaki yerler API'den yükleniyor */}
          {loadingNearby ? (
             <ThemedView lightColor={Colors[theme].background} darkColor={Colors[theme].background} style={styles.loadingNearbyContainer}>
              <ActivityIndicator size="small" color={Colors[theme].primary} />
              <ThemedText style={[styles.loadingNearbyText, { color: Colors[theme].textLight }]}>Yakınındaki yerler aranıyor...</ThemedText>
            </ThemedView>
          ) : nearbyPlaces.length > 0 ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={nearbyPlaces} 
              keyExtractor={(item) => item.id} 
              contentContainerStyle={styles.flatListContent}
              renderItem={({ item }) => {
                if (!item || typeof item !== 'object') return null;
                
                const isFavorite = favoritePlaceIds.includes(item.id);
                const isLoadingFavorite = favoriteLoading[item.id];
                const photoUrl = item.photo_url || item.image_url || (item.photos && item.photos.length > 0 ? getPlacePhoto(item.photos[0].photo_reference) : 'https://via.placeholder.com/400x200?text=No+Image');

                return (
                  <TouchableOpacity 
                    style={[styles.placeCard, { backgroundColor: Colors[theme].card, shadowColor: Colors[theme].shadowColor }]}
                    activeOpacity={0.8}
                    onPress={() => {
                      const message = [
                        item.address || item.description || '',
                        item.rating ? `Puan: ${item.rating}/5` : ''
                      ].filter(Boolean).join('\n');
                      
                      Alert.alert(
                        item.name || 'Mekan',
                        message,
                        [
                          { text: 'Kapat', style: 'cancel' },
                          { text: 'Keşfet', onPress: () => router.push({pathname: '/(tabs)/explore', params: { placeId: item.id }}) }
                        ]
                      );
                    }}
                  >
                    <ThemedView lightColor={Colors.light.card} darkColor={Colors.dark.card} style={styles.cardContainer}>
                      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']} style={styles.gradientOverlay} />
                      <Image source={{ uri: photoUrl }} style={styles.placeImage} contentFit="cover" />
                      <View style={styles.placeInfo}>
                        <ThemedText style={styles.placeName} numberOfLines={2}>{item.name}</ThemedText>
                        <View style={styles.placeDetails}>
                          <View style={styles.placeType}>
<FontAwesome5 
                              name={
                                item.category === 'museum' || item.type === 'müze' ? 'university' :
                                item.category === 'park' || item.type === 'park' ? 'tree' :
                                item.category === 'restaurant' || item.type === 'restoran' ? 'utensils' :
                                'landmark'
                              } 
                              size={12} 
                              color={Colors.dark.text}
                            />
                            <ThemedText style={[styles.placeTypeText, {color: Colors.dark.text}]}>{item.type || item.category?.replace(/_/g, ' ')}</ThemedText>
                          </View>
                          {item.rating && (
                            <View style={styles.placeRating}>
                              <FontAwesome5 name="star" size={12} color={Colors[theme].accent} />
                              <ThemedText style={[styles.placeRatingText, {color: Colors.dark.text}]}>{item.rating.toFixed(1)}</ThemedText>
                            </View>
                          )}
                        </View>
                      </View>
                      <TouchableOpacity 
                        style={[styles.favoriteButton, { backgroundColor: theme === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(50,50,50,0.8)' }]}
                        onPress={() => handleToggleFavorite(item.id)}
                        disabled={isLoadingFavorite}
                      >
                        {isLoadingFavorite ? (
                          <ActivityIndicator size="small" color={Colors[theme].accent} />
                        ) : (
                          <FontAwesome5 
                            name="heart" 
                            size={18} 
                            color={isFavorite ? Colors[theme].accent : Colors[theme].textLight} 
                            solid={isFavorite}
                          />
                        )}
                      </TouchableOpacity>
                    </ThemedView>
                  </TouchableOpacity>
                );
              }}
            />
          ) : places.length > 0 ? ( 
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={places.slice(0, 5)} 
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.flatListContent}
              renderItem={({ item }) => {
                const isFavorite = favoritePlaceIds.includes(item.id);
                const isLoadingFavorite = favoriteLoading[item.id];
                return (
                  <TouchableOpacity 
                    style={[styles.placeCard, { backgroundColor: Colors[theme].card, shadowColor: Colors[theme].shadowColor }]}
                    activeOpacity={0.8}
                    onPress={() => router.push({pathname: '/(tabs)/explore', params: { placeId: item.id }})}
                  >
                    <ThemedView lightColor={Colors.light.card} darkColor={Colors.dark.card} style={styles.cardContainer}>
                      <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.7)']} style={styles.gradientOverlay} />
                      <Image source={{ uri: item.image_url || item.image }} style={styles.placeImage} contentFit="cover" transition={300} />
                      <View style={styles.placeInfo}>
                        <ThemedText style={styles.placeName} numberOfLines={2}>{item.name}</ThemedText>
                        <View style={styles.placeDetails}>
                          <View style={styles.placeType}>
<FontAwesome5 
                              name={
                                item.type === 'Tarihi Yer' ? 'landmark' : 
                                item.type === 'Doğa Rotası' ? 'mountain' : 'store'
                              } 
                              size={12} 
                              color={Colors.dark.text}
                            />
                            <ThemedText style={[styles.placeTypeText, {color: Colors.dark.text}]}>{item.type}</ThemedText>
                          </View>
                          <View style={styles.placeRating}>
                            <FontAwesome5 name="star" size={12} color={Colors[theme].accent} />
                            <ThemedText style={[styles.placeRatingText, {color: Colors.dark.text}]}>{item.points || item.rating?.toFixed(1) || 'N/A'}</ThemedText>
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity 
                        style={[styles.favoriteButton, { backgroundColor: theme === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(50,50,50,0.8)'}]}
                        onPress={() => handleToggleFavorite(item.id)}
                        disabled={isLoadingFavorite}
                      >
                         {isLoadingFavorite ? (
                          <ActivityIndicator size="small" color={Colors[theme].accent} />
                        ) : (
                          <FontAwesome5 
                            name="heart" 
                            size={18} 
                            color={isFavorite ? Colors[theme].accent : Colors[theme].textLight}
                            solid={isFavorite} 
                          />
                        )}
                      </TouchableOpacity>
                    </ThemedView>
                  </TouchableOpacity>
                );
              }}
            />
          ) : (
            <ThemedView 
              lightColor={Colors.light.card} 
              darkColor={Colors.dark.card} 
              style={[styles.emptyStateContainer, {shadowColor: Colors[theme].shadowColor}]}
            >
              <FontAwesome5 name="map-marker-alt" size={24} color={Colors[theme].primary} />
              <ThemedText style={[styles.emptyStateText, {color: Colors[theme].textLight}]}>Henüz yakınınızda keşfedilecek yer bulunamadı.</ThemedText>
              {!location ? <ThemedText style={[styles.emptyStateText, {color: Colors[theme].textLight}]}>Konum izni vererek yakındaki yerleri görebilirsiniz.</ThemedText> : null}
            </ThemedView>
          )}
        </View>
        {/* Toast Message Component (optional, requires setup) */}
        <Toast />
        {/* Popular Challenges */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Popüler Görevler</ThemedText>
            <TouchableOpacity onPress={() => router.push('/(tabs)/challenges')}>
              <ThemedText style={[styles.seeAllText, { color: Colors[theme].primary }]}>Tümünü Gör</ThemedText>
            </TouchableOpacity>
          </View>

          {challenges.length > 0 ? (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={challenges}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.flatListContent}
              renderItem={({ item }) => {
                if (!item || typeof item !== 'object') return null;
                
                const isBookmarked = bookmarkedChallengeIds.includes(item.id);
                const isLoadingBookmark = bookmarkLoading[item.id];
                
                return (
                  <TouchableOpacity 
                    style={[styles.placeCard, { backgroundColor: Colors[theme].card, shadowColor: Colors[theme].shadowColor }]}
                    activeOpacity={0.8}
                    onPress={() => router.push(`/challenge/${item.id}`)}
                  >
                    <View style={styles.cardContainer}>
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
                              color={Colors.dark.text} // Text on overlay should be light
                            />
                            <ThemedText style={[styles.placeTypeText, { color: Colors.dark.text }]}>
                              {item.category || item.challenge_type || 'Genel'}
                            </ThemedText>
                          </View>
                          <View style={styles.placeRating}> {/* Assuming points can be displayed like rating */}
                            <FontAwesome5 name="star" size={12} color={Colors[theme].accent} />
                            <ThemedText style={[styles.placeRatingText, { color: Colors.dark.text }]}>{String(item.points || 0)}</ThemedText>
                          </View>
                        </View>
                      </View>
                      <TouchableOpacity 
                        style={[styles.favoriteButton, { backgroundColor: theme === 'light' ? 'rgba(255,255,255,0.9)' : 'rgba(50,50,50,0.8)' }]}
                        onPress={() => handleToggleBookmark(item.id)}
                        disabled={isLoadingBookmark}
                      >
                        {isLoadingBookmark ? (
                          <ActivityIndicator size="small" color={Colors[theme].accent} />
                        ) : (
                          <FontAwesome5 
                            name="bookmark" 
                            size={18} 
                            color={isBookmarked ? Colors[theme].accent : Colors[theme].textLight} 
                            solid={isBookmarked} 
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          ) : (
            <ThemedView 
              lightColor={Colors.light.card} 
              darkColor={Colors.dark.card} 
              style={[styles.emptyStateContainer, {shadowColor: Colors[theme].shadowColor}]}
            >
              <FontAwesome5 name="tasks" size={24} color={Colors[theme].primary} />
              <ThemedText style={[styles.emptyStateText, {color: Colors[theme].textLight}]}>Henüz görev bulunamadı</ThemedText>
            </ThemedView>
          )}
        </View>

        {/* My Routes Section */}
        <View style={styles.sectionContainer}>
          <View style={styles.sectionHeader}>
            <ThemedText style={styles.sectionTitle}>Rotalarım</ThemedText>
            <TouchableOpacity onPress={() => router.push(`/route` as any)}>
              <ThemedText style={[styles.seeAllText, { color: Colors[theme].primary }]}>Yeni Rota Oluştur</ThemedText>
            </TouchableOpacity>
          </View>

          <ThemedView lightColor={Colors[theme].background} darkColor={Colors[theme].background} style={styles.routesContainer}>
            <TouchableOpacity 
              style={styles.createRouteCard}
              activeOpacity={0.8}
              onPress={() => router.push(`/route` as any)}
            >
              <LinearGradient
                colors={theme === 'light' ? [Colors.light.primary, Colors.light.secondary] : [Colors.dark.primary, Colors.dark.secondary]}
                style={styles.routeGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <FontAwesome5 name="route" size={24} color="white" />
                <ThemedText style={[styles.createRouteText, { color: Colors.dark.text }]}>Yeni Rota Oluştur</ThemedText>
                <ThemedText style={[styles.createRouteSubtext, { color: Colors.dark.text }]}>
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
              <ThemedText style={[styles.seeAllText, { color: Colors[theme].primary }]}>Tümünü Gör</ThemedText>
            </TouchableOpacity>
          </View>

          {feedPosts.length > 0 ? (
            feedPosts.map((post) => (
              <ThemedView 
                key={post.id} 
                lightColor={Colors.light.card} 
                darkColor={Colors.dark.card} 
                style={[styles.storyCard, {shadowColor: Colors[theme].shadowColor}]}
              >
                <View style={styles.storyHeader}>
                  <Image
                    source={{ uri: post.user?.avatar_url || 'https://randomuser.me/api/portraits/men/1.jpg' }}
                    style={styles.storyAvatar}
                  />
                  <View>
                    <ThemedText style={styles.storyUsername}>{post.user?.username || 'Gezgin'}</ThemedText>
                    {post.location && (
                      <View style={styles.storyPlace}>
                        <FontAwesome5 name="map-marker-alt" size={12} color={Colors[theme].primary} />
                        <ThemedText style={styles.storyPlaceText}>{post.location || ''}</ThemedText>
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
                    <FontAwesome5 name="heart" size={16} color={Colors[theme].textLight} />
                    <ThemedText style={styles.storyActionText}>{post.likes_count || 0}</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.storyAction}>
                    <FontAwesome5 name="comment" size={16} color={Colors[theme].textLight} />
                    <ThemedText style={styles.storyActionText}>{post.comments_count || 0}</ThemedText>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.storyAction}>
                    <FontAwesome5 name="share" size={16} color={Colors[theme].textLight} />
                  </TouchableOpacity>
                </View>
              </ThemedView>
            ))
          ) : (
            <ThemedView style={styles.emptyStateContainer}>
              <FontAwesome5 name="book-open" size={24} color={Colors[theme].primary} />
              <ThemedText style={styles.emptyStateText}>Henüz hikaye paylaşılmamış</ThemedText>
            </ThemedView>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { // Base container, flex:1 is key. Background set dynamically.
    flex: 1,
  },
  loadingNearbyContainer: { // Used with ThemedView
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingNearbyText: { // Used with ThemedText
    marginLeft: 8,
    fontSize: THEME.SIZES.medium,
  },
  flatListContent: {
    paddingRight: 16,
  },
  scrollContainer: {
    flex: 1,
  },
  header: { // Background set dynamically
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? 15 : 10,
    paddingBottom: 15,
  },
  greeting: { // Color from ThemedText
    fontSize: THEME.SIZES.large,
    fontWeight: 'bold',
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 5,
  },
  pointsText: { // Color set dynamically
    marginLeft: 5,
    fontSize: THEME.SIZES.medium,
    fontWeight: 'bold',
  },
  profileIcon: { // BorderColor set dynamically
    width: 40,
    height: 40,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 2,
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
    // shadowColor will be applied dynamically via inline style
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
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
    backgroundColor: 'rgba(0,0,0,0.4)', // Static overlay, usually dark
    justifyContent: 'flex-end',
  },
  featuredContent: {
    padding: 15,
  },
  featuredTag: {
    // backgroundColor and color are dynamic (inline)
    fontSize: THEME.SIZES.small,
    fontWeight: 'bold',
    textTransform: 'uppercase',
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
    marginBottom: 8,
  },
  featuredTitle: {
    // color is dynamic (inline)
    fontSize: THEME.SIZES.xlarge,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  featuredDescription: {
    // color is dynamic (inline)
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
    // color is dynamic (inline)
    fontWeight: 'bold',
    marginLeft: 5,
  },
  featuredButton: {
    // backgroundColor is dynamic (inline)
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  featuredButtonText: {
    // color is dynamic (inline)
    fontWeight: 'bold',
  },
  sectionContainer: {
    marginBottom: 20,
    paddingHorizontal: 16,
  },
  lastSection: {
    marginBottom: 40, 
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 15,
  },
  sectionTitle: { // Color from ThemedText
    fontSize: THEME.SIZES.large,
    fontWeight: 'bold',
  },
  seeAllText: { // Color set dynamically
    fontWeight: 'bold',
  },
  placeCard: { // Background and shadowColor set dynamically
    width: 280,
    height: 200,
    marginRight: 16,
    borderRadius: 16,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  cardContainer: { // Used with View, not ThemedView, so it's transparent
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
  placeName: { // Color set to Colors.dark.text (static light for overlay)
    fontSize: THEME.SIZES.large,
    fontWeight: 'bold',
    color: Colors.dark.text, 
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
  placeTypeText: { // Color set to Colors.dark.text (static light for overlay)
    fontSize: THEME.SIZES.small,
    color: Colors.dark.text, 
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
  placeRatingText: { // Color set to Colors.dark.text (static light for overlay)
    fontSize: THEME.SIZES.small,
    color: Colors.dark.text, 
    marginLeft: 6,
    fontWeight: '600',
  },
  favoriteButton: { // Background set dynamically
    position: 'absolute',
    top: 12, 
    right: 12, 
    borderRadius: 20, 
    width: 40, 
    height: 40, 
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  routesContainer: { // Used with ThemedView
    marginVertical: 8,
  },
  createRouteCard: {
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 16,
  },
  routeGradient: { // Colors for gradient set dynamically
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  createRouteText: {
    fontSize: 18,
    fontWeight: 'bold',
    // color is dynamic (inline)
    marginTop: 12,
    marginBottom: 8,
  },
  createRouteSubtext: {
    fontSize: 13,
    // color is dynamic (inline)
    opacity: 0.8,
    textAlign: 'center',
    maxWidth: '90%',
  },
  storyCard: {
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 15,
    overflow: 'hidden',
    // backgroundColor and shadowColor are dynamic (ThemedView + inline)
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
    // color is dynamic (inline)
  },
  storyTime: {
    fontSize: 12,
    marginLeft: 'auto',
    // color is dynamic (inline)
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
    // color is dynamic (inline)
  },
  // Yükleme durumu için stiller
  loadingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: THEME.SIZES.medium,
    // color: THEME.COLORS.primary, // Dynamic
  },
  // Hata durumu için stiller
  errorContainer: { // Background set dynamically on SafeAreaView
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1, // Ensure it fills SafeAreaView
  },
  errorText: { // Color from ThemedText
    marginTop: 15,
    fontSize: THEME.SIZES.medium,
    textAlign: 'center',
    marginBottom: 20,
    paddingHorizontal: 40,
  },
  retryButton: { // Background set dynamically
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  retryButtonText: { // Color set dynamically
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
