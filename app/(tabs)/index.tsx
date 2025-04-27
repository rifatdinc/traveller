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
import { getCurrentLocation, searchNearbyPlaces, getPlacePhoto, NearbyPlace } from '@/lib/googleMapsService';

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
      
      const nearbyResults = await searchNearbyPlaces(
        userLocation,
        1500, // Yarıçap (metre)
        'tourist_attraction', // Varsayılan olarak turistik yerler
        'tr' // Dil
      );
      
      if (nearbyResults && nearbyResults.length > 0) {
        setNearbyPlaces(nearbyResults.slice(0, 5)); // Sadece ilk 5 sonucu göster
      }
    } catch (err) {
      console.error('Yakındaki yerler aranırken hata:', err);
      // Hata durumunda yakındaki yerler yerine Supabase'den gelen yerler gösterilecek
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
      setDailyChallenge(dailyChallengeData);
      
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

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, styles.loadingContainer]}>
        <ActivityIndicator size="large" color={THEME.COLORS.primary} />
        <ThemedText style={styles.loadingText}>Veriler yükleniyor...</ThemedText>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={[styles.container, styles.errorContainer]}>
        <FontAwesome5 name="exclamation-circle" size={50} color={THEME.COLORS.error} />
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => router.replace('/')}
        >
          <ThemedText style={styles.retryButtonText}>Tekrar Dene</ThemedText>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
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
              source={{ uri: dailyChallenge.image_url || dailyChallenge.image }} 
              style={styles.featuredImage}
              resizeMode="cover"
            />
            <View style={styles.featuredOverlay}>
              <View style={styles.featuredContent}>
                <ThemedText style={styles.featuredTag}>Günün Görevi</ThemedText>
                <ThemedText style={styles.featuredTitle}>{dailyChallenge.title}</ThemedText>
                <ThemedText style={styles.featuredDescription}>{dailyChallenge.description}</ThemedText>
                <View style={styles.featuredFooter}>
                  <View style={styles.featuredPoints}>
                    <ThemedText style={{ color: THEME.COLORS.accent }}>
                      <FontAwesome5 name="star" size={16} />
                    </ThemedText>
                    <ThemedText style={styles.featuredPointsText}>{dailyChallenge.points} Puan</ThemedText>
                  </View>
                  <TouchableOpacity style={styles.featuredButton}>
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
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={styles.challengeCard}
                  onPress={() => router.push('/(tabs)/challenges')}
                >
                  <Image 
                    source={{ uri: item.image_url || item.image }} 
                    style={styles.challengeImage}
                    resizeMode="cover"
                  />
                  <View style={styles.challengeInfo}>
                    <ThemedText style={styles.challengeTitle}>{item.title}</ThemedText>
                    <View style={styles.challengeDetails}>
                      <View style={styles.challengeType}>
                      <ThemedText style={{ color: THEME.COLORS.primary }}>
                        <FontAwesome5 name="calendar-alt" size={12} />
                      </ThemedText>
                      <ThemedText style={styles.challengeTypeText}>{
                        item.deadline 
                          ? new Date(item.deadline).toLocaleDateString('tr-TR', {day: 'numeric', month: 'short'})
                          : 'Süresiz'
                      }</ThemedText>
                    </View>
                    <View style={styles.challengePoints}>
                      <ThemedText style={{ color: THEME.COLORS.accent }}>
                        <FontAwesome5 name="star" size={12} />
                      </ThemedText>
                      <ThemedText style={styles.challengePointsText}>{item.points}</ThemedText>
                    </View>
                  </View>
                  </View>
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
  challengeCard: {
    width: 200,
    marginLeft: 20,
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
  challengeImage: {
    width: '100%',
    height: 120,
  },
  challengeInfo: {
    padding: 10,
  },
  challengeTitle: {
    fontSize: THEME.SIZES.medium,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  challengeDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  challengeType: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  challengeTypeText: {
    fontSize: 12,
    marginLeft: 5,
    color: THEME.COLORS.gray,
  },
  challengePoints: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  challengePointsText: {
    fontSize: 12,
    marginLeft: 5,
    color: THEME.COLORS.accent,
    fontWeight: 'bold',
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
