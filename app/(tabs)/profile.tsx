import { useState, useEffect, useCallback, useLayoutEffect } from 'react'; // Added useLayoutEffect
import { StyleSheet, View, ScrollView, TouchableOpacity, Image, Dimensions, ActivityIndicator, Alert, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView, } from 'react-native-gesture-handler';
import { router, useNavigation } from 'expo-router'; // Added useNavigation
import { FontAwesome5 } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { UserChallengeCard } from '@/components/UserChallengeCard';
import { THEME } from '@/constants/Theme';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/lib/supabase';
import { plannerService } from '@/services/plannerService';
import { statsService } from '@/services/statsService';
import { challengesService } from '@/services/challengesService';

const { width } = Dimensions.get('window');

// Type definitions
interface UserData {
  id: string;
  username: string;
  avatar: string;
  level: string;
  total_points: number;
  visited_places: number;
  rank?: number;
}

interface Place {
  id: string;
  name: string;
  image: string;
  image_url?: string;
  type: string;
  city: string;
  points: number;
}

interface TripPlan {
  id: string;
  title: string;
  description: string;
  category: string;
  budget: string;
  duration: string;
  image_url: string;
  total_points: number;
  created_by: string;
  is_public: boolean;
  places?: Place[];
  created_at?: string;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
}

interface Story {
  id: string;
  title: string;
  content: string;
  image?: string;
  created_at: string;
  likes: number;
  comments: number;
}

interface Reward {
  id: string;
  name: string;
  description: string;
  icon: string;
}

const tabs = [
  { id: 'stats', name: 'İstatistikler' },
  { id: 'plans', name: 'Planlarım' },
  { id: 'challenges', name: 'Görevler' },
  { id: 'badges', name: 'Rozetler' },
  { id: 'visited', name: 'Gezilen Yerler' },
  { id: 'stories', name: 'Hikayeler' },
  { id: 'rewards', name: 'Ödüller' },
];

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const navigation = useNavigation(); // Added
  const [activeTab, setActiveTab] = useState('stats');
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [userChallenges, setUserChallenges] = useState<any[]>([]);
  const [visitedPlaces, setVisitedPlaces] = useState<Place[]>([]);
  const [earnedBadges, setEarnedBadges] = useState<Badge[]>([]);
  const [userStories, setUserStories] = useState<Story[]>([]);
  const [leaderboardData, setLeaderboardData] = useState<UserData[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [userPlans, setUserPlans] = useState<TripPlan[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // Set header title
  useLayoutEffect(() => {
    navigation.setOptions({
      headerTitle: 'Profilim',
    });
  }, [navigation]);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchLeaderboard();
      fetchVisitedPlaces();
      fetchBadges();
      fetchStories();
      fetchRewards();
      fetchUserChallenges();
      fetchUserPlans();
    } else {
      router.replace('/auth/login');
    }
  }, [user]);

  const fetchUserChallenges = async () => {
    if (!user) return;
    try {
      const challenges = await challengesService.getUserChallenges(user.id);
      setUserChallenges(challenges);
    } catch (error) {
      console.error('Error fetching user challenges:', error);
    }
  };

  // Kullanıcının gezi planlarını yükle
  const fetchUserPlans = async () => {
    if (!user) return;
    try {
      const plans = await plannerService.getUserTripPlans(user.id);
      if (plans) {
        setUserPlans(plans);
      }
    } catch (error) {
      console.error('Error fetching user plans:', error);
    }
  };

  // Tüm verileri yenileme fonksiyonu
  const refreshAllData = async () => {
    if (!user) return;

    try {
      setLoading(true);
      await Promise.all([
        fetchUserProfile(),
        fetchLeaderboard(),
        fetchVisitedPlaces(),
        fetchBadges(),
        fetchStories(),
        fetchRewards(),
        fetchUserChallenges(),
        fetchUserPlans()
      ]);
    } catch (error) {
      console.error('Error refreshing data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Pull-to-refresh işlemi - sadece aktif tab içeriğini yenileyecek şekilde güncellenmiş
  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    try {
      // Sadece aktif tab için gereken verileri yenile
      switch (activeTab) {
        case 'stats':
          await Promise.all([
            fetchUserProfile(),
            fetchLeaderboard(),
            fetchVisitedPlaces(),
            fetchBadges()
          ]);
          break;

        case 'plans':
          await fetchUserPlans();
          break;

        case 'challenges':
          await fetchUserChallenges();
          break;

        case 'badges':
          await fetchBadges();
          break;

        case 'visited':
          await fetchVisitedPlaces();
          break;

        case 'stories':
          await fetchStories();
          break;

        case 'rewards':
          await fetchRewards();
          break;

        default:
          // Aktif tab için özel bir yenileme fonksiyonu yoksa
          // veya tab bilinmiyorsa header gibi ortak alanları güncelle
          await fetchUserProfile();
      }
    } catch (error) {
      console.error(`Error refreshing ${activeTab} tab:`, error);
    } finally {
      setRefreshing(false);
    }
  }, [activeTab, user]);

  const fetchUserProfile = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      // First ensure the user exists in both users and profiles tables
      await supabase.rpc('get_or_create_user', {
        p_user_id: user.id,
        p_email: user.email || '',
        p_username: null
      });
      
      // Kullanıcı profil bilgilerini çek
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) {
        console.error('Error fetching user profile:', error);
        // If the user doesn't exist, create a new profile
        await createUserProfile();
        return;
      }

      // Kullanıcı istatistiklerini çek
      const stats = await statsService.getUserStats(user.id);

      // Ziyaret edilen yer sayısını güncelle
      await statsService.updateVisitedPlacesCount(user.id);

      // Kullanıcı verilerini ve istatistikleri birleştir
      const fullUserData: UserData = {
        id: data.id,
        username: data.username,
        avatar: data.avatar,
        level: `Seviye ${stats?.level || 1}`,
        total_points: stats?.total_points || 0,
        visited_places: stats?.visited_places || 0,
        rank: stats?.rank || 0
      };

      setUserData(fullUserData);
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // If any error occurs, try to create a new profile
      await createUserProfile();
    } finally {
      setLoading(false);
    }
  };

  const createUserProfile = async () => {
    if (!user) return;

    try {
      const username = user.email ? user.email.split('@')[0] : 'traveler';
      const avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=random&color=fff&size=256`;

      const { error } = await supabase
        .from('users')
        .insert({
          id: user.id,
          username: username,
          email: user.email,
          avatar: avatarUrl,
          total_points: 0,
          level: 'Yeni Gezgin',
          visited_places: 0,
          created_at: new Date().toISOString()
        });

      if (error) throw error;

      // Kullanıcı profilini yeniden çek
      const { data, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('id', user.id)
        .single();

      if (fetchError) throw fetchError;
      setUserData(data as UserData);
    } catch (createError) {
      console.error('Error creating user profile:', createError);
      // Set default user data when everything fails
      setUserData({
        id: user.id,
        username: user.email ? user.email.split('@')[0] : 'traveler',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email || 'traveler')}&background=random&color=fff&size=256`,
        level: 'Yeni Gezgin',
        total_points: 0,
        visited_places: 0
      });
    }
  };

  const fetchLeaderboard = async () => {
    try {
      // Liderlik tablosunu statsService ile çek
      const leaderboardData = await statsService.getLeaderboard(10);
      setLeaderboardData(leaderboardData);
    } catch (error) {
      console.error('Error fetching leaderboard:', error);
    }
  };

  const fetchVisitedPlaces = async () => {
    try {
      // Kullanıcının ziyaret ettiği yerleri çek
      const { data, error } = await supabase
        .from('visited_places')
        .select('place_id')
        .eq('user_id', user?.id);

      if (error) {
        // Table doesn't exist or other error
        console.error('Error fetching visited places:', error);
        setVisitedPlaces([]);
        return;
      }

      if (data && data.length) {
        const placeIds = data.map(item => item.place_id);
        const { data: placesData, error: placesError } = await supabase
          .from('places')
          .select('*')
          .in('id', placeIds);

        if (placesError) throw placesError;
        setVisitedPlaces(placesData as Place[]);
      } else {
        setVisitedPlaces([]);
      }
    } catch (error) {
      console.error('Error fetching visited places:', error);
      setVisitedPlaces([]);
    }
  };

  const fetchBadges = async () => {
    try {
      // Kullanıcının kazandığı rozetleri çek
      const { data, error } = await supabase
        .from('user_badges')
        .select('badge_id')
        .eq('user_id', user?.id);

      if (error) throw error;

      if (data && data.length) {
        const badgeIds = data.map(item => item.badge_id);
        const { data: badgesData, error: badgesError } = await supabase
          .from('badges')
          .select('*')
          .in('id', badgeIds);

        if (badgesError) throw badgesError;
        setEarnedBadges(badgesData as Badge[]);
      } else {
        setEarnedBadges([]);
      }
    } catch (error) {
      console.error('Error fetching badges:', error);
    }
  };

  const fetchStories = async () => {
    try {
      // Kullanıcının hikayelerini çek
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUserStories(data as Story[] || []);
    } catch (error) {
      console.error('Error fetching stories:', error);
    }
  };

  const fetchRewards = async () => {
    try {
      // Kullanıcının ödüllerini çek
      const { data, error } = await supabase
        .from('user_rewards')
        .select('reward_id')
        .eq('user_id', user?.id);

      if (error) {
        // Table doesn't exist or other error
        console.error('Error fetching rewards:', error);
        setRewards([]);
        return;
      }

      if (data && data.length) {
        const rewardIds = data.map(item => item.reward_id);
        const { data: rewardsData, error: rewardsError } = await supabase
          .from('rewards')
          .select('*')
          .in('id', rewardIds);

        if (rewardsError) throw rewardsError;
        setRewards(rewardsData as Reward[]);
      } else {
        setRewards([]);
      }
    } catch (error) {
      console.error('Error fetching rewards:', error);
      setRewards([]);
    }
  };

  const handleSignOut = async () => {
    Alert.alert(
      'Çıkış Yap',
      'Hesabınızdan çıkış yapmak istediğinize emin misiniz?',
      [
        { text: 'İptal', style: 'cancel' },
        {
          text: 'Çıkış Yap',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            const { error } = await signOut();
            if (error) {
              Alert.alert('Hata', error.message);
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  const handleEditProfile = () => {
    Alert.alert('Bilgi', 'Profil düzenleme özelliği yakında eklenecek!');
  };

  const renderChallenges = () => {
    if (userChallenges.length === 0) {
      return (
        <ThemedView style={styles.emptyContainer}>
          <FontAwesome5 name="tasks" size={40} color={THEME.COLORS.primary} />
          <ThemedText style={styles.emptyText}>
            Henüz hiçbir göreve katılmadınız.
          </ThemedText>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.push('/(tabs)/challenges')}
          >
            <ThemedText style={styles.emptyButtonText}>
              Görevleri Keşfet
            </ThemedText>
          </TouchableOpacity>
        </ThemedView>
      );
    }

    const completedChallenges = userChallenges.filter(c => c.completed);
    const ongoingChallenges = userChallenges.filter(c => !c.completed);

    return (
      <View style={styles.challengesContainer}>
        <View style={styles.challengesSummary}>
          <View style={styles.summaryItem}>
            <ThemedText style={styles.summaryNumber}>{ongoingChallenges.length}</ThemedText>
            <ThemedText style={styles.summaryLabel}>Devam Eden</ThemedText>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <ThemedText style={styles.summaryNumber}>{completedChallenges.length}</ThemedText>
            <ThemedText style={styles.summaryLabel}>Tamamlanan</ThemedText>
          </View>
        </View>

        {ongoingChallenges.length > 0 && (
          <View style={styles.challengeSection}>
            <ThemedText style={styles.sectionTitle}>Devam Eden Görevler</ThemedText>
            <View style={styles.challengeGrid}>
              {ongoingChallenges.map((challenge) => (
                <UserChallengeCard
                  key={challenge.id}
                  challenge={{
                    id: challenge.id,
                    title: challenge.title,
                    description: challenge.description,
                    points: challenge.points,
                    image_url: challenge.image_url,
                    image: challenge.image,
                    progress_percentage: challenge.progress_percentage || 0,
                    completed: false
                  }}
                />
              ))}
            </View>
          </View>
        )}

        {completedChallenges.length > 0 && (
          <View style={styles.challengeSection}>
            <ThemedText style={styles.sectionTitle}>Tamamlanan Görevler</ThemedText>
            <View style={styles.challengeGrid}>
              {completedChallenges.map((challenge) => (
                <UserChallengeCard
                  key={challenge.id}
                  challenge={{
                    id: challenge.id,
                    title: challenge.title,
                    description: challenge.description,
                    points: challenge.points,
                    image_url: challenge.image_url,
                    image: challenge.image,
                    progress_percentage: 100,
                    completed: true
                  }}
                />
              ))}
            </View>
          </View>
        )}
      </View>
    );
  };

  const renderStats = () => {
    return (
      <View style={styles.statsContainer}>
        <View style={styles.statsSummary}>
          <View style={styles.statItem}>
            <ThemedText style={styles.statNumber}>{userData?.total_points || 0}</ThemedText>
            <ThemedText style={styles.statLabel}>Toplam Puan</ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText style={styles.statNumber}>{userData?.visited_places || 0}</ThemedText>
            <ThemedText style={styles.statLabel}>Ziyaret Edilen</ThemedText>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <ThemedText style={styles.statNumber}>{userData?.rank || '-'}</ThemedText>
            <ThemedText style={styles.statLabel}>Sıralama</ThemedText>
          </View>
        </View>

        {/* Rozetlerim Bölümü */}
        <View style={styles.statSection}>
          <ThemedText style={styles.sectionTitle}>Rozetlerim</ThemedText>
          <View style={styles.badgesContainer}>
            {earnedBadges.length > 0 ? (
              earnedBadges.map((badge) => (
                <View key={badge.id} style={styles.badgeItem}>
                  <View style={styles.badgeIconContainer}>
                    <FontAwesome5 name={badge.icon || "award"} size={24} color={THEME.COLORS.accent} />
                  </View>
                  <ThemedText style={styles.badgeName}>{badge.name}</ThemedText>
                </View>
              ))
            ) : (
              <ThemedView style={styles.emptyBadgeContainer}>
                <FontAwesome5 name="award" size={24} color={THEME.COLORS.gray} />
                <ThemedText style={styles.emptyText}>
                  Henüz rozet kazanmadınız
                </ThemedText>
              </ThemedView>
            )}
          </View>
        </View>

        <View style={styles.statSection}>
          <ThemedText style={styles.sectionTitle}>Liderlik Tablosu</ThemedText>
          <View style={styles.leaderboardContainer}>
            {leaderboardData.slice(0, 5).map((user, index) => (
              <View key={user.id} style={styles.leaderboardItem}>
                <ThemedText style={styles.rankNumber}>{index + 1}</ThemedText>
                <Image
                  source={{ uri: user.avatar || 'https://ui-avatars.com/api/?name=User&background=random' }}
                  style={styles.leaderAvatar}
                />
                <ThemedText style={styles.leaderName}>{user.username}</ThemedText>
                <View style={styles.leaderPoints}>
                  <FontAwesome5 name="star" size={12} color={THEME.COLORS.accent} />
                  <ThemedText style={styles.pointsText}>{user.total_points}</ThemedText>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.statSection}>
          <ThemedText style={styles.sectionTitle}>Son Aktiviteler</ThemedText>
          <View style={styles.activityContainer}>
            {visitedPlaces.length > 0 ? (
              visitedPlaces.slice(0, 3).map((place) => (
                <TouchableOpacity
                  key={place.id}
                  style={styles.activityItem}
                  onPress={() => router.push(`/place/${place.id}`)}
                >
                  <Image
                    source={{ uri: place.image_url || place.image }}
                    style={styles.activityImage}
                    resizeMode="cover"
                  />
                  <View style={styles.activityContent}>
                    <ThemedText style={styles.activityTitle} numberOfLines={1}>{place.name}</ThemedText>
                    <ThemedText style={styles.activitySubtitle}>{place.city}</ThemedText>
                    <View style={styles.activityPoints}>
                      <FontAwesome5 name="star" size={12} color={THEME.COLORS.accent} />
                      <ThemedText style={styles.pointsText}>{place.points} puan kazanıldı</ThemedText>
                    </View>
                  </View>
                  <FontAwesome5 name="chevron-right" size={14} color={THEME.COLORS.gray} style={styles.activityArrow} />
                </TouchableOpacity>
              ))
            ) : (
              <ThemedView style={styles.emptyContainer}>
                <FontAwesome5 name="map-marker-alt" size={40} color={THEME.COLORS.primary} />
                <ThemedText style={styles.emptyText}>
                  Henüz hiçbir yer ziyaret etmediniz.
                </ThemedText>
                <TouchableOpacity
                  style={styles.emptyButton}
                  onPress={() => router.push('/(tabs)')}
                >
                  <ThemedText style={styles.emptyButtonText}>
                    Yerleri Keşfet
                  </ThemedText>
                </TouchableOpacity>
              </ThemedView>
            )}
          </View>
        </View>
      </View>
    );
  };

  const renderPlans = () => {
    // Planları kategorilerine göre grupla
    const groupedPlans = userPlans.reduce((acc, plan) => {
      const category = plan.category || 'Diğer';
      if (!acc[category]) acc[category] = [];
      acc[category].push(plan);
      return acc;
    }, {} as Record<string, TripPlan[]>);

    const categories = Object.keys(groupedPlans);

    // Image gradients için renkler
    const categoryColors: Record<string, string> = {
      'history': 'rgba(25, 118, 210, 0.85)',  // Mavi
      'Tarih': 'rgba(25, 118, 210, 0.85)',    // Mavi
      'nature': 'rgba(56, 142, 60, 0.85)',    // Yeşil
      'Doğa': 'rgba(56, 142, 60, 0.85)',      // Yeşil
      'museum': 'rgba(156, 39, 176, 0.85)',   // Mor
      'Müze': 'rgba(156, 39, 176, 0.85)',     // Mor
      'beach': 'rgba(0, 131, 143, 0.85)',     // Turkuaz
      'Plaj': 'rgba(0, 131, 143, 0.85)',      // Turkuaz
      'Şehir Turu': 'rgba(66, 66, 66, 0.85)', // Gri
      'Deniz & Tarih': 'rgba(0, 151, 167, 0.85)', // Mavi-yeşil
      'Diğer': 'rgba(66, 66, 66, 0.85)'       // Gri
    };

    return (
      <View style={styles.plansContainer}>
        {userPlans.length > 0 ? (
          <>
            <View style={styles.planStatContainer}>
              <View style={styles.planStatItem}>
                <ThemedText style={styles.planStatNumber}>{userPlans.length}</ThemedText>
                <ThemedText style={styles.planStatLabel}>Plan</ThemedText>
              </View>
              <View style={styles.planStatItem}>
                <ThemedText style={styles.planStatNumber}>
                  {userPlans.reduce((count, plan) => count + (plan.places?.length || 0), 0)}
                </ThemedText>
                <ThemedText style={styles.planStatLabel}>Yer</ThemedText>
              </View>
              <View style={styles.planStatItem}>
                <ThemedText style={styles.planStatNumber}>
                  {categories.length}
                </ThemedText>
                <ThemedText style={styles.planStatLabel}>Kategori</ThemedText>
              </View>
            </View>

            <View style={styles.planListContainer}>
              <View style={styles.planCategoryContainer}>
                {categories.map(category => (
                  <View key={category} style={styles.planCategorySection}>
                    <View style={styles.planCategoryHeader}>
                      <FontAwesome5
                        name={
                          category === 'Tarih' || category === 'history' ? 'landmark' :
                            category === 'Doğa' || category === 'nature' ? 'tree' :
                              category === 'Müze' || category === 'museum' ? 'university' :
                                category === 'Plaj' || category === 'beach' ? 'umbrella-beach' :
                                  category === 'Şehir Turu' ? 'city' :
                                    category === 'Deniz & Tarih' ? 'anchor' : 'map-marked-alt'
                        }
                        size={16}
                        color={THEME.COLORS.primary}
                      />
                      <ThemedText style={styles.planCategoryTitle}>{category}</ThemedText>
                    </View>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      contentContainerStyle={styles.planHorizontalScroll}
                    >
                      {groupedPlans[category].map((plan) => (
                        <TouchableOpacity
                          key={plan.id}
                          style={styles.planCardHorizontal}
                          activeOpacity={0.8}
                          onPress={() => router.push(`/plan/${plan.id}`)}
                        >
                          <Image
                            source={{ uri: plan.image_url || 'https://via.placeholder.com/300' }}
                            style={styles.planCardImage}
                          />
                          <View
                            style={[
                              styles.planCardGradient,
                              { backgroundColor: categoryColors[category] || 'rgba(0,0,0,0.5)' }
                            ]}
                          />
                          <View style={styles.planCardContent}>
                            <View style={styles.planCardTop}>
                              <View style={styles.planCardBadge}>
                                <ThemedText style={styles.planCardBadgeText}>{plan.duration}</ThemedText>
                              </View>
                              <View style={styles.planCardBadge}>
                                <ThemedText style={styles.planCardBadgeText}>
                                  {plan.places?.length || 0} Yer
                                </ThemedText>
                              </View>
                            </View>
                            <View style={styles.planCardBottom}>
                              <ThemedText style={styles.planCardTitle} numberOfLines={2}>
                                {plan.title}
                              </ThemedText>
                              <ThemedText style={styles.planCardSubtitle} numberOfLines={1}>
                                {plan.budget}
                              </ThemedText>
                              <View style={styles.planCardPlaces}>
                                <FontAwesome5 name="map-marker-alt" size={12} color="#fff" />
                                <ThemedText style={styles.planCardPlacesText} numberOfLines={1}>
                                  {plan.places && plan.places.length > 0
                                    ? plan.places.slice(0, 2).map(p => p.name).join(', ') +
                                    (plan.places.length > 2 ? '...' : '')
                                    : 'Yer yok'}
                                </ThemedText>
                              </View>
                            </View>
                          </View>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                  </View>
                ))}
              </View>
            </View>
          </>
        ) : (
          <ThemedView style={styles.emptyContainer}>
            <FontAwesome5 name="route" size={40} color={THEME.COLORS.primary} />
            <ThemedText style={styles.emptyText}>
              Henüz hiç gezi planı oluşturmadınız.
            </ThemedText>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/planner')}
            >
              <ThemedText style={styles.emptyButtonText}>
                Plan Oluştur
              </ThemedText>
            </TouchableOpacity>
          </ThemedView>
        )}
      </View>
    );
  };

  if (!user || loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.COLORS.primary} />
      </SafeAreaView>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />

        <View style={styles.header}>
          <View style={styles.userInfoContainer}>
            <Image
              source={{ uri: userData?.avatar || 'https://ui-avatars.com/api/?name=User&background=random' }}
              style={styles.avatar}
            />
            <View style={styles.userInfo}>
              <ThemedText style={styles.username}>{userData?.username || 'Kullanıcı'}</ThemedText>
              <ThemedText style={styles.level}>{userData?.level || 'Yeni Gezgin'}</ThemedText>
            </View>
          </View>

          <View style={styles.actions}>
            <TouchableOpacity style={styles.actionButton} onPress={handleEditProfile}>
              <FontAwesome5 name="edit" size={18} color={THEME.COLORS.primary} />
            </TouchableOpacity>
            <TouchableOpacity style={styles.actionButton} onPress={handleSignOut}>
              <FontAwesome5 name="sign-out-alt" size={18} color={THEME.COLORS.danger} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.tabBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.tabsContainer}
          >
            {tabs.map(tab => (
              <TouchableOpacity
                key={tab.id}
                style={[
                  styles.tab,
                  activeTab === tab.id ? styles.activeTab : null
                ]}
                onPress={() => {
                  setActiveTab(tab.id);
                  Haptics.selectionAsync();
                }}
              >
                <ThemedText
                  style={[
                    styles.tabText,
                    activeTab === tab.id ? styles.activeTabText : null
                  ]}
                >
                  {tab.name}
                </ThemedText>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <ScrollView
          style={styles.content}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[THEME.COLORS.primary]}
              tintColor={THEME.COLORS.primary}
            />
          }
        >
          {activeTab === 'challenges' ? renderChallenges() : null}
          {activeTab === 'stats' ? renderStats() : null}
          {activeTab === 'plans' ? renderPlans() : null}
          {/* Keep your other tab content rendering logic */}
        </ScrollView>
      </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.COLORS.background,
  },
  container: {
    flex: 1,
    backgroundColor: THEME.COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    backgroundColor: THEME.COLORS.card,
  },
  userInfoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: THEME.COLORS.primary,
  },
  userInfo: {
    marginLeft: 15,
  },
  username: {
    fontSize: THEME.SIZES.large,
    fontWeight: 'bold',
  },
  level: {
    fontSize: THEME.SIZES.small,
    color: THEME.COLORS.gray,
  },
  actions: {
    flexDirection: 'row',
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: THEME.COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 10,
  },
  tabBar: {
    height: 40,
    backgroundColor: THEME.COLORS.card,
    borderBottomWidth: 1,
    borderBottomColor: THEME.COLORS.border,
  },
  tabsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  tab: {
    paddingHorizontal: 15,
    height: 30,
    borderRadius: 15,
    marginRight: 10,
    backgroundColor: THEME.COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeTab: {
    backgroundColor: THEME.COLORS.primary,
  },
  tabText: {
    fontSize: THEME.SIZES.small,
    fontWeight: '500',
  },
  activeTabText: {
    color: THEME.COLORS.light,
  },
  content: {
    flex: 1,
    padding: 15,
  },
  challengesContainer: {
    flex: 1,
    padding: 15,
  },
  challengesSummary: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.COLORS.card,
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryNumber: {
    fontSize: THEME.SIZES.xlarge,
    fontWeight: 'bold',
    color: THEME.COLORS.primary,
  },
  summaryLabel: {
    fontSize: THEME.SIZES.small,
    color: THEME.COLORS.gray,
    marginTop: 4,
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: THEME.COLORS.border,
    marginHorizontal: 20,
  },
  challengeSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: THEME.SIZES.medium,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  challengeCard: {
    flexDirection: 'row',
    backgroundColor: THEME.COLORS.card,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  completedCard: {
    opacity: 0.8,
  },
  challengeThumbnail: {
    width: 80,
    height: 80,
  },
  challengeContent: {
    flex: 1,
    padding: 10,
  },
  challengeTitle: {
    fontSize: THEME.SIZES.medium,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  challengeMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  challengePoints: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pointsText: {
    marginLeft: 4,
    fontSize: THEME.SIZES.small,
    color: THEME.COLORS.accent,
  },
  joinedDate: {
    fontSize: THEME.SIZES.small,
    color: THEME.COLORS.gray,
  },
  progressBar: {
    height: 4,
    backgroundColor: THEME.COLORS.border,
    borderRadius: 2,
  },
  progressFill: {
    height: '100%',
    backgroundColor: THEME.COLORS.primary,
    borderRadius: 2,
  },
  deleteAction: {
    backgroundColor: THEME.COLORS.error,
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    height: '100%',
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  challengeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginHorizontal: -5,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    marginTop: 50,
  },
  emptyText: {
    fontSize: THEME.SIZES.medium,
    textAlign: 'center',
    marginTop: 15,
    marginBottom: 20,
  },
  emptyButton: {
    backgroundColor: THEME.COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  emptyButtonText: {
    color: THEME.COLORS.light,
    fontWeight: 'bold',
  },
  statsContainer: {
    marginBottom: 20,
  },
  statsSummary: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.COLORS.card,
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  // Rozet stil tanımları
  badgesContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    paddingVertical: 10,
  },
  badgeItem: {
    alignItems: 'center',
    width: width / 4 - 20,
    marginBottom: 15,
    marginRight: 10,
  },
  badgeIconContainer: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: THEME.COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  badgeName: {
    fontSize: THEME.SIZES.small,
    textAlign: 'center',
  },
  emptyBadgeContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: THEME.COLORS.card,
    borderRadius: 12,
  },
  statNumber: {
    fontSize: THEME.SIZES.xlarge,
    fontWeight: 'bold',
    color: THEME.COLORS.primary,
  },
  statLabel: {
    fontSize: THEME.SIZES.small,
    color: THEME.COLORS.gray,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: THEME.COLORS.border,
    marginHorizontal: 20,
  },
  statSection: {
    marginBottom: 20,
  },
  leaderboardContainer: {
    maxHeight: 150,
    borderRadius: 12,
    overflow: 'hidden',
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.COLORS.border,
  },
  rankNumber: {
    width: 30,
    textAlign: 'center',
    fontWeight: 'bold',
    color: THEME.COLORS.primary,
  },
  leaderAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
  },
  leaderName: {
    flex: 1,
    fontWeight: 'bold',
  },
  leaderPoints: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: THEME.COLORS.card,
  },
  activityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.COLORS.border,
  },
  activityImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  activityContent: {
    flex: 1,
  },
  activityTitle: {
    fontWeight: 'bold',
    fontSize: THEME.SIZES.medium,
    marginBottom: 2,
  },
  activitySubtitle: {
    fontSize: THEME.SIZES.small,
    color: THEME.COLORS.gray,
    marginBottom: 4,
  },
  activityPoints: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityArrow: {
    marginLeft: 8,
  },
  plansContainer: {
    flex: 1,
    padding: 15,
  },
  // Plan istatistikleri
  planStatContainer: {
    flexDirection: 'row',
    backgroundColor: THEME.COLORS.card,
    borderRadius: 12,
    padding: 15,
    marginBottom: 20,
    ...THEME.SHADOWS?.medium || { elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 3 },
  },
  planStatItem: {
    flex: 1,
    alignItems: 'center',
  },
  planStatNumber: {
    fontSize: THEME.SIZES.xlarge,
    fontWeight: 'bold',
    color: THEME.COLORS.primary,
  },
  planStatLabel: {
    fontSize: THEME.SIZES.small,
    color: THEME.COLORS.gray,
    marginTop: 2,
  },
  // Kategori bölümleri
  planListContainer: {
    flex: 1,
  },
  planCategoryContainer: {
    marginBottom: 20,
  },
  planCategorySection: {
    marginBottom: 20,
  },
  planCategoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 5,
  },
  planCategoryTitle: {
    fontSize: THEME.SIZES.medium,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  planHorizontalScroll: {
    paddingBottom: 5,
    paddingRight: 20,
  },
  // Yeni plan kartları
  planCardHorizontal: {
    width: width * 0.75,
    height: 200,
    marginRight: 15,
    borderRadius: 16,
    overflow: 'hidden',
    ...THEME.SHADOWS?.medium || { elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 4 },
  },
  planCardImage: {
    width: '100%',
    height: '100%',
  },
  planCardGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
  planCardContent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    padding: 15,
    justifyContent: 'space-between',
  },
  planCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  planCardBadge: {
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  planCardBadgeText: {
    color: THEME.COLORS.light,
    fontSize: 12,
    fontWeight: '600',
  },
  planCardBottom: {
    width: '100%',
  },
  planCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.COLORS.light,
    marginBottom: 4,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  planCardSubtitle: {
    fontSize: 14,
    color: THEME.COLORS.light,
    marginBottom: 8,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  planCardPlaces: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planCardPlacesText: {
    fontSize: 12,
    color: THEME.COLORS.light,
    marginLeft: 5,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  // Eski stiller (geriye uyumluluk için tutuldu)
  plansGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  planCard: {
    width: '48%',
    marginBottom: 15,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: THEME.COLORS.card,
  },
  planImage: {
    width: '100%',
    height: 120,
  },
  planOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'flex-end',
    padding: 10,
  },
  planInfo: {
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 8,
    padding: 10,
  },
  planCategory: {
    fontSize: THEME.SIZES.small,
    color: THEME.COLORS.light,
  },
  planTitle: {
    fontSize: THEME.SIZES.medium,
    fontWeight: 'bold',
    color: THEME.COLORS.light,
  },
  planMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  planMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  planMetaText: {
    marginLeft: 4,
    fontSize: THEME.SIZES.small,
    color: THEME.COLORS.light,
  },
});
