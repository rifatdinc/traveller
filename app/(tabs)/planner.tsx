import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Image, TextInput, Dimensions, ActivityIndicator, Text, Pressable, Alert, Modal, TouchableOpacity, FlatList, RefreshControl } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { FontAwesome5 } from '@expo/vector-icons';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import debounce from 'lodash/debounce';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { THEME } from '@/constants/Theme';
import { HapticTab } from '@/components/HapticTab';
import { plannerService } from '@/services/plannerService';
import { placesService } from '@/services/placesService';
import { useAuth } from '@/hooks/useAuth';
import { searchPlaces, getPlaceDetails, getPlacePhoto, searchNearbyPlaces, LocationCoords } from '@/lib/googleMapsService';
import { PlaceSelectionModal } from '@/app/components/PlaceSelectionModal';

// Arayüzler
interface FilterItem {
  id: string;
  name: string;
}

interface InterestTag {
  id: string;
  name: string;
}

interface Place {
  id: string;
  name: string;
  type: string;
  points: number;
  latitude: number;
  longitude: number;
  city: string;
  description: string;
  image?: string;
  image_url?: string;
  visited_by: number;
  rating: number;
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
  username?: string;
  avatar?: string;
}

const filters: FilterItem[] = [
  { id: 'all', name: 'Tümü' },
  { id: 'history', name: 'Tarih' },
  { id: 'nature', name: 'Doğa' },
  { id: 'food', name: 'Yemek' },
  { id: 'adventure', name: 'Macera' },
];

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

export default function PlannerScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [activeFilter, setActiveFilter] = useState('all');
  const [destination, setDestination] = useState('');
  const [budget, setBudget] = useState('');
  const [duration, setDuration] = useState('');
  const [selectedInterests, setSelectedInterests] = useState<string[]>(['history']);
  const [interestTags, setInterestTags] = useState<InterestTag[]>([]);
  
  // Yeni state'ler
  const [isPlaceModalVisible, setIsPlaceModalVisible] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState<Place[]>([]);
  const [selectedPlaces, setSelectedPlaces] = useState<Place[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tripPlans, setTripPlans] = useState<TripPlan[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  
  // Google Places Autocomplete için state'ler
  const [searchSuggestions, setSearchSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [selectedCityName, setSelectedCityName] = useState<string>('');

  // Google Places arama işlevi
  const searchPlacesWithDebounce = useRef(
    debounce(async (text: string) => {
      if (text.length < 2) {
        setSearchSuggestions([]);
        setShowSuggestions(false);
        return;
      }
      
      try {
        setSearchLoading(true);
        const results = await searchPlaces(text);
        if (results && results.length > 0) {
          setSearchSuggestions(results);
          setShowSuggestions(true);
        } else {
          // ZERO_RESULTS durumunda kullanıcı arayüzünde boş sonuç göster
          setSearchSuggestions([]);
          setShowSuggestions(false);
          console.log('Google Places API: Arama için sonuç bulunamadı:', text);
        }
      } catch (error) {
        console.error('Google Places search error:', error);
      } finally {
        setSearchLoading(false);
      }
    }, 500)
  ).current;

  // Destinasyon değiştiğinde arama yap
  const handleDestinationChange = (text: string) => {
    setDestination(text);
    setSelectedPlaceId(null);
    searchPlacesWithDebounce(text);
  };

  // Kullanıcının planlarını yükle
  useEffect(() => {
    loadUserPlans();
  }, [user]);

  // Kullanıcı planlarını yükleyen fonksiyon
  const loadUserPlans = async () => {
    if (user) {
      try {
        setLoading(true);
        // Kullanıcının planlarını getir
        const plans = await plannerService.getUserTripPlans(user.id);
        
        if (plans) {
          // Places already included in the plans from getUserTripPlans
          setTripPlans(plans);
        }
      } catch (err) {
        console.error('Planlar yüklenirken bir hata oluştu:', err);
      } finally {
        setLoading(false);
      }
    }
  };

  // Pull-to-refresh işlemi
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadUserPlans();
    setRefreshing(false);
  }, [user]);

  // Önerilen yerden birini seç
  const handleSelectPlace = async (placeId: string, description: string) => {
    try {
      setSearchLoading(true);
      const placeDetails = await getPlaceDetails(placeId);
      
      if (placeDetails) {
        // Şehir bilgisini al (genellikle adresin son kısmı)
        const addressComponents = placeDetails.address_components || [];
        let cityName = '';
        
        // Şehir bilgisini bul (locality veya administrative_area_level_1)
        for (const component of addressComponents) {
          if (component.types.includes('locality')) {
            cityName = component.long_name;
            break;
          } else if (component.types.includes('administrative_area_level_1')) {
            cityName = component.long_name;
          }
        }
        
        if (!cityName && description) {
          // Açıklamadan şehir adını çıkar
          const parts = description.split(', ');
          if (parts.length > 1) {
            cityName = parts[parts.length - 2]; // Genelde son parça ülke adı, ondan önceki şehir
          }
        }
        
        if (cityName) {
          setDestination(cityName);
          setSelectedCityName(cityName);
          setSelectedPlaceId(placeId);
        } else {
          setDestination(description.split(',')[0]);
          setSelectedCityName(description.split(',')[0]);
        }
        
        setShowSuggestions(false);
        
        // Şehir seçildiğinde otomatik olarak yerleri getir
        setTimeout(() => {
          // Biraz gecikme ekleyerek state'in güncellenmesini bekle
          fetchNearbyPlaces();
          setIsPlaceModalVisible(true); // Yerler yüklendiğinde modalı göster
        }, 500);
      } else {
        setShowSuggestions(false);
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
      setShowSuggestions(false);
    } finally {
      setSearchLoading(false);
    }
  };

  // Yakındaki yerleri getir
  const fetchNearbyPlaces = async () => {
    try {
      if (!destination) {
        setError('Lütfen bir şehir veya hedef girin');
        Alert.alert('Uyarı', 'Lütfen bir şehir veya hedef girin');
        return;
      }
      
      setLoading(true);
      // Şehir adını kullan (Google Places'dan veya doğrudan girilen)
      const cityName = selectedCityName || destination.trim()
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
        
      console.log('Fetching places for city:', cityName);
      const places = await placesService.getPlacesByCity(cityName);
      
      if (places && places.length > 0) {
        setNearbyPlaces(places);
        setSelectedPlaces([]); // Seçili yerleri sıfırla
        setError(null);
      } else {
        // Eğer veritabanında bu şehir için yer yoksa, Google'dan yeni yerler almayı dene
        const addedPlaces = await fetchAndAddPlacesForCity(cityName);
        
        if (addedPlaces && addedPlaces.length > 0) {
          setNearbyPlaces(addedPlaces);
          setSelectedPlaces([]);
          setError(null);
        } else {
          setNearbyPlaces([]);
          const errorMessage = `${cityName} için yer bulunamadı. Farklı bir şehir deneyin.`;
          setError(errorMessage);
          Alert.alert('Yer Bulunamadı', errorMessage);
        }
      }
    } catch (error) {
      const errorMessage = 'Yakındaki yerler getirilirken bir hata oluştu';
      setError(errorMessage);
      Alert.alert('Hata', errorMessage);
      console.error('fetchNearbyPlaces error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Google Maps API'den şehir için yerler getir ve veritabanına ekle
  const fetchAndAddPlacesForCity = async (cityName: string): Promise<Place[]> => {
    try {
      // Google Places API'den şehir hakkında bilgi al
      const cityResults = await searchPlaces(cityName);
      if (!cityResults || cityResults.length === 0) {
        return [];
      }
      
      // Şehir için place_id al
      const cityPlaceId = cityResults[0].place_id;
      const cityDetails = await getPlaceDetails(cityPlaceId);
      
      if (!cityDetails || !cityDetails.geometry || !cityDetails.geometry.location) {
        return [];
      }
      
      // Şehir koordinatlarını al
      const location: LocationCoords = {
        latitude: cityDetails.geometry.location.lat,
        longitude: cityDetails.geometry.location.lng
      };
      
      // Turistik yerleri, restoranları ve diğer ilgi çekici yerleri getir
      const types = ['tourist_attraction', 'museum', 'restaurant', 'park', 'shopping_mall'];
      const newPlaces: Place[] = [];
      
      // Her tür için ayrı ayrı arama yap
      for (const type of types) {
        const nearbyResults = await searchNearbyPlaces(location, 5000, type);
        
        if (nearbyResults && nearbyResults.length > 0) {
          // Her bir yeri işle ve veritabanına ekle
          for (const place of nearbyResults.slice(0, 3)) { // Her türden en fazla 3 yer al
            try {
              // Yer fotoğrafı
              let imageUrl = 'https://via.placeholder.com/300';
              if (place.photos && place.photos.length > 0) {
                imageUrl = getPlacePhoto(place.photos[0].photo_reference);
              }
              
              // Yer türünü belirle
              let placeType = 'Turistik Yer';
              if (place.types.includes('museum')) {
                placeType = 'Müze';
              } else if (place.types.includes('restaurant')) {
                placeType = 'Önerilen Restoran';
              } else if (place.types.includes('park')) {
                placeType = 'Doğa Rotası';
              } else if (place.types.includes('shopping_mall')) {
                placeType = 'Turistik Merkez';
              }
              
              // Yer puanı
              const rating = place.rating || Math.floor(Math.random() * 3) + 3; // 3-5 arası rastgele puan
              
              // Veritabanına eklenecek yer
              const newPlaceData = {
                // Remove the id field and let the database generate one with uuid_generate_v4()
                name: place.name,
                type: placeType,
                points: Math.floor(rating * 100),
                latitude: place.geometry.location.lat,
                longitude: place.geometry.location.lng,
                city: cityName,
                description: place.vicinity || `${place.name}, ${cityName}`,
                image: imageUrl,     // Setting both image fields
                image_url: imageUrl, // to the same value
                visited_by: Math.floor(Math.random() * 50) + 5, // Rastgele ziyaretçi sayısı
                rating: rating
              };
              
              // Veritabanına ekle
              const addedPlace = await placesService.insertPlace(newPlaceData);
              if (addedPlace) {
                newPlaces.push(addedPlace);
              }
            } catch (err) {
              console.error(`${place.name} eklenirken hata oluştu:`, err);
            }
          }
        }
      }
      
      return newPlaces;
    } catch (error) {
      console.error('Google Maps yerlerini alırken hata:', error);
      return [];
    }
  };

  // Özel bileşeni kullan
  const handleModalClose = () => {
    // Form temizle
    setDestination('');
    setBudget('');
    setDuration('');
    setSelectedPlaces([]);
  };

  const handleCreatePlan = async (
    title: string,
    description: string,
    category: string,
    budget: string,
    duration: string,
    image_url: string,
    created_by: string,
    place_ids: string[]
  ) => {
    if (!user) {
      Alert.alert('Hata', 'Plan oluşturmak için giriş yapmalısınız.');
      return null;
    }
    
    return await plannerService.createTripPlan({
      title,
      description,
      category,
      budget,
      duration,
      image_url,
      created_by,
      place_ids
    });
  };

  // Verileri Supabase'den çek
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        setError(null);
        
        // İlgi alanlarını çek
        const interestData = await plannerService.getInterestTags();
        if (interestData && interestData.length > 0) {
          setInterestTags(interestData);
          // Eğer seçili ilgi alanı yoksa, ilk ilgi alanını seç
          if (selectedInterests.length === 0 && interestData.length > 0) {
            setSelectedInterests([interestData[0].id]);
          }
        } else {
          console.warn('İlgi alanları getirilemedi veya boş');
        }
        
        // Gezi planlarını çek
        const plansData = await plannerService.getAllTripPlans();
        if (plansData && plansData.length > 0) {
          setTripPlans(plansData as TripPlan[]);
        } else {
          console.log('Gezi planları bulunamadı veya boş');
        }
      } catch (err: any) {
        console.error('Verileri çekerken bir hata oluştu:', err);
        setError(err.message || 'Veriler yüklenirken bir hata oluştu.');
      } finally {
        setLoading(false);
      }
    }
    
    fetchData();
  }, []);

  // Toggle interest tag selection
  const toggleInterestTag = (tagId: string) => {
    if (selectedInterests.includes(tagId)) {
      // Don't allow deselecting if it's the only one selected
      if (selectedInterests.length > 1) {
        setSelectedInterests(selectedInterests.filter(id => id !== tagId));
      }
    } else {
      setSelectedInterests([...selectedInterests, tagId]);
    }
  };

  // Filter trip plans based on selected filter
  const filteredPlans = tripPlans.filter(plan => 
    activeFilter === 'all' || 
    (activeFilter === 'history' && plan.category?.includes('Tarih')) ||
    (activeFilter === 'nature' && plan.category?.includes('Doğa')) ||
    (activeFilter === 'food' && plan.category?.includes('Yemek')) ||
    (activeFilter === 'adventure' && plan.category?.includes('Macera'))
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar style="auto" />
      
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.title}>Gezi Planlayıcı</ThemedText>
      </View>
      
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[THEME.COLORS.primary]}
            tintColor={THEME.COLORS.primary}
          />
        }
      >
        {/* Create Plan Card */}
        <Animated.View entering={FadeInDown.duration(500).delay(100)}>
          <ThemedView style={styles.createPlanCard}>
            <ThemedText style={styles.createPlanTitle}>Özel Gezi Planı Oluştur</ThemedText>
            
            <View style={styles.inputContainer}>
              <FontAwesome5 name="map-marker-alt" size={16} color={THEME.COLORS.gray} style={styles.inputIcon} />
              <TextInput
                style={styles.input}
                placeholder="Nereye gitmek istiyorsun?"
                placeholderTextColor={THEME.COLORS.gray}
                value={destination}
                onChangeText={handleDestinationChange}
                onFocus={() => {
                  if (destination.length > 1) {
                    setShowSuggestions(true);
                  }
                }}
              />
              {searchLoading && (
                <ActivityIndicator size="small" color={THEME.COLORS.primary} style={{marginHorizontal: 5}} />
              )}
            </View>
            
            {/* Google Places Önerileri */}
            {showSuggestions && searchSuggestions.length > 0 && (
              <View style={styles.suggestionsContainer}>
                <ScrollView 
                  style={styles.suggestionsList}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled={true}
                >
                  {searchSuggestions.map((suggestion) => (
                    <HapticTab
                      key={suggestion.place_id}
                      style={styles.suggestionItem}
                      onPress={() => handleSelectPlace(suggestion.place_id, suggestion.description)}
                    >
                      <FontAwesome5 name="map-marker-alt" size={16} color={THEME.COLORS.primary} style={{marginRight: 10}} />
                      <ThemedText 
                        style={styles.suggestionText}
                        numberOfLines={1} 
                        ellipsizeMode="tail"
                      >
                        {suggestion.description}
                      </ThemedText>
                    </HapticTab>
                  ))}
                </ScrollView>
              </View>
            )}
            
            <View style={styles.inputRow}>
              <View style={[styles.inputContainer, styles.halfInput]}>
                <FontAwesome5 name="wallet" size={16} color={THEME.COLORS.gray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Bütçe"
                  placeholderTextColor={THEME.COLORS.gray}
                  keyboardType="numeric"
                  value={budget}
                  onChangeText={setBudget}
                />
              </View>
              
              <View style={[styles.inputContainer, styles.halfInput]}>
                <FontAwesome5 name="calendar-alt" size={16} color={THEME.COLORS.gray} style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  placeholder="Kaç gün?"
                  placeholderTextColor={THEME.COLORS.gray}
                  keyboardType="numeric"
                  value={duration}
                  onChangeText={setDuration}
                />
              </View>
            </View>
            
            <View style={styles.interestSection}>
              <ThemedText style={styles.interestTitle}>İlgi Alanların</ThemedText>
              {loading ? (
                <ActivityIndicator color={THEME.COLORS.primary} />
              ) : (
                <ScrollView 
                  horizontal 
                  showsHorizontalScrollIndicator={false} 
                  style={styles.interestTagsContainer}
                  contentContainerStyle={styles.interestTags}
                >
                  {interestTags.map((tag) => (
                    <HapticTab
                      key={tag.id}
                      onPress={() => toggleInterestTag(tag.id)}
                      style={[
                        styles.interestTag,
                        selectedInterests.includes(tag.id) && styles.interestTagSelected
                      ]}
                    >
                      <ThemedText 
                        style={[
                          styles.interestTagText,
                          selectedInterests.includes(tag.id) && styles.interestTagTextSelected
                        ]}
                      >
                        {tag.name}
                      </ThemedText>
                    </HapticTab>
                  ))}
                </ScrollView>
              )}
            </View>
            
            <HapticTab 
              style={styles.createButton}
              onPress={async () => {
                await fetchNearbyPlaces();
                setIsPlaceModalVisible(true);
              }}
            >
              <ThemedText style={styles.createButtonText}>Yer Seç</ThemedText>
            </HapticTab>

            <HapticTab 
              style={styles.createButton}
              onPress={async () => {
                if (!user) {
                  Alert.alert('Hata', 'Plan oluşturmak için giriş yapmalısınız.');
                  return;
                }

                if (!destination || !budget || !duration) {
                  Alert.alert('Hata', 'Lütfen tüm alanları doldurun.');
                  return;
                }

                // Yakındaki yerleri getir ve modalı aç
                await fetchNearbyPlaces();
                setIsPlaceModalVisible(true);
              }}
            >
              <ThemedText style={styles.createButtonText}>Plan Oluştur</ThemedText>
            </HapticTab>
          </ThemedView>
        </Animated.View>
        
        {/* Trip Plans Section */}
        <Animated.View entering={FadeInDown.duration(500).delay(200)} style={styles.plansContainer}>
          <View style={styles.plansHeader}>
            <ThemedText style={styles.plansTitle}>Hazır Gezi Planları</ThemedText>
            <HapticTab>
              <ThemedText style={styles.seeAllText}>Tümünü Gör</ThemedText>
            </HapticTab>
          </View>
          
          {/* Filters */}
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false} 
            style={styles.filtersList}
            contentContainerStyle={{ paddingVertical: 5 }}
          >
            {filters.map((filter) => (
              <HapticTab
                key={filter.id}
                style={[
                  styles.filterItem,
                  activeFilter === filter.id && styles.activeFilterItem
                ]}
                onPress={() => setActiveFilter(filter.id)}
              >
                <ThemedText 
                  style={[
                    styles.filterText,
                    activeFilter === filter.id && styles.activeFilterText
                  ]}
                >
                  {filter.name}
                </ThemedText>
              </HapticTab>
            ))}
          </ScrollView>
          
          {/* Trip Plan Cards */}
          <View style={styles.plansList}>
            {loading ? (
              <View style={styles.statusWrapper}>
                <ActivityIndicator size="large" color={THEME.COLORS.primary} />
                <ThemedText style={{ marginTop: 10 }}>Planlar yükleniyor...</ThemedText>
              </View>
            ) : error ? (
              <View style={styles.statusWrapper}>
                <FontAwesome5 name="exclamation-circle" size={24} color={THEME.COLORS.danger} />
                <ThemedText style={{ marginTop: 10 }}>Bir hata oluştu. Lütfen tekrar deneyin.</ThemedText>
              </View>
            ) : filteredPlans.length === 0 ? (
              <View style={styles.statusWrapper}>
                <FontAwesome5 name="map" size={24} color={THEME.COLORS.gray} />
                <ThemedText style={{ marginTop: 10 }}>Bu kategoride plan bulunamadı.</ThemedText>
              </View>
            ) : (
              filteredPlans.map((plan) => {
                const planPlaces = plan.places || [];
                
                return (
                  <HapticTab 
                    key={plan.id} 
                    style={styles.planCard}
                    onPress={() => {
                      // Navigate to plan details (Şu an için sadece alert gösteriyoruz)
                      alert(`Plan detayları: ${plan.title}`);
                    }}
                  >
                    <Image 
                      source={{ uri: plan.image_url }} 
                      style={styles.planImage} 
                    />
                    <View style={styles.planOverlay}>
                      <View style={styles.planDetails}>
                        <View>
                          <ThemedText style={styles.planCategory}>{plan.category}</ThemedText>
                          <ThemedText style={styles.planTitle}>{plan.title}</ThemedText>
                        </View>
                        <View style={styles.planPointsBadge}>
                          <FontAwesome5 name="star" size={14} color={THEME.COLORS.light} />
                          <ThemedText style={styles.planPointsText}>{plan.total_points}</ThemedText>
                        </View>
                      </View>
                    </View>
                    <View style={styles.planContent}>
                      <ThemedText style={styles.planDescription}>{plan.description}</ThemedText>
                      
                      <View style={styles.planInfo}>
                        <View style={styles.planInfoItem}>
                          <FontAwesome5 name="calendar-alt" size={14} color={THEME.COLORS.primary} />
                          <ThemedText style={styles.planInfoText}>{plan.duration}</ThemedText>
                        </View>
                        <View style={styles.planInfoItem}>
                          <FontAwesome5 name="wallet" size={14} color={THEME.COLORS.primary} />
                          <ThemedText style={styles.planInfoText}>{plan.budget}</ThemedText>
                        </View>
                        <View style={styles.planInfoItem}>
                          <FontAwesome5 name="map-marker-alt" size={14} color={THEME.COLORS.primary} />
                          <ThemedText style={styles.planInfoText}>{planPlaces.length} Yer</ThemedText>
                        </View>
                      </View>
                      
                      <View style={styles.planPlaces}>
                        {planPlaces.map((place, index) => (
                          <View key={place?.id || index} style={styles.planPlace}>
                            <FontAwesome5 
                              name={
                                place?.type === 'Tarihi Yer' ? 'landmark' : 
                                place?.type === 'Doğa' ? 'tree' : 
                                place?.type === 'Doğa Rotası' ? 'mountain' :
                                place?.type === 'Önerilen Restoran' ? 'utensils' :
                                place?.type === 'Turistik Merkez' ? 'store' : 'map-marker'
                              } 
                              size={12} 
                              color={THEME.COLORS.gray} 
                            />
                            <ThemedText style={styles.planPlaceText}>
                              {place?.name || 'Yer Bilgisi'}
                              {index < planPlaces.length - 1 && ','}
                            </ThemedText>
                          </View>
                        ))}
                      </View>
                      
                      <HapticTab 
                        style={styles.useThisPlanButton}
                        onPress={async () => {
                          if (!user) {
                            Alert.alert('Hata', 'Plan kullanmak için giriş yapmalısınız.');
                            return;
                          }

                          try {
                            // Mevcut planı kopyala ve yeni bir plan olarak kaydet
                            const newPlan = await plannerService.createTripPlan({
                              title: `${plan.title} (Kopyam)`,
                              description: plan.description,
                              category: plan.category,
                              budget: plan.budget,
                              duration: plan.duration,
                              image_url: plan.image_url,
                              created_by: user.id,
                              place_ids: plan.places?.map(p => p.id) || []
                            });

                            // Planlar listesini güncelle
                            if (newPlan) {
                              setTripPlans(prev => [newPlan as TripPlan, ...prev]);
                              Alert.alert('Başarılı', 'Plan başarıyla kopyalandı!');
                            }
                          } catch (error: any) {
                            Alert.alert('Hata', error.message || 'Plan kopyalanırken bir hata oluştu.');
                          }
                        }}
                      >
                        <ThemedText style={styles.useThisPlanButtonText}>Bu Planı Kullan</ThemedText>
                      </HapticTab>
                    </View>
                  </HapticTab>
                );
              })
            )}
          </View>
        </Animated.View>
      </ScrollView>

      <PlaceSelectionModal 
        isVisible={isPlaceModalVisible}
        setIsVisible={setIsPlaceModalVisible}
        loading={loading}
        error={error}
        nearbyPlaces={nearbyPlaces}
        selectedPlaces={selectedPlaces}
        setSelectedPlaces={setSelectedPlaces}
        destination={destination}
        duration={duration}
        budget={budget}
        selectedInterests={selectedInterests}
        userId={user?.id || ''}
        onCreatePlan={handleCreatePlan}
        onClose={handleModalClose}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.COLORS.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 15,
  },
  title: {
    fontSize: THEME.SIZES.xxlarge,
    fontWeight: 'bold',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContentWrapper: {
    backgroundColor: THEME.COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    height: '80%',
  },
  createPlanCard: {
    margin: 20,
    padding: 15,
    borderRadius: 15,
    ...THEME.SHADOWS.small,
  },
  createPlanTitle: {
    fontSize: THEME.SIZES.large,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.COLORS.background,
    borderRadius: 10,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    height: 45,
    fontSize: THEME.SIZES.medium,
    color: THEME.COLORS.text,
  },
  inputRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  interestSection: {
    marginTop: 5,
    marginBottom: 15,
  },
  interestTitle: {
    fontSize: THEME.SIZES.medium,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  interestTagsContainer: {
    marginBottom: 5,
  },
  interestTags: {
    flexDirection: 'row',
    paddingVertical: 5,
  },
  interestTag: {
    backgroundColor: THEME.COLORS.background,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    marginBottom: 5,
    borderWidth: 1,
    borderColor: THEME.COLORS.border,
  },
  interestTagSelected: {
    backgroundColor: THEME.COLORS.primary,
    borderColor: THEME.COLORS.primary,
  },
  interestTagText: {
    fontSize: THEME.SIZES.small,
  },
  interestTagTextSelected: {
    color: THEME.COLORS.light,
  },
  createButton: {
    backgroundColor: THEME.COLORS.primary,
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 5,
  },
  createButtonText: {
    color: THEME.COLORS.light,
    fontSize: THEME.SIZES.medium,
    fontWeight: 'bold',
  },
  plansContainer: {
    paddingHorizontal: 20,
  },
  plansHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  plansTitle: {
    fontSize: THEME.SIZES.large,
    fontWeight: 'bold',
  },
  seeAllText: {
    color: THEME.COLORS.primary,
    fontSize: THEME.SIZES.small,
  },
  filtersList: {
    marginBottom: 15,
  },
  filterItem: {
    backgroundColor: THEME.COLORS.background,
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 10,
    borderWidth: 1,
    borderColor: THEME.COLORS.border,
  },
  activeFilterItem: {
    backgroundColor: THEME.COLORS.primary,
    borderColor: THEME.COLORS.primary,
  },
  filterText: {
    fontSize: THEME.SIZES.small,
  },
  activeFilterText: {
    color: THEME.COLORS.light,
  },
  plansList: {
    marginBottom: 20,
  },
  statusWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
    backgroundColor: THEME.COLORS.card,
    borderRadius: 10,
    ...THEME.SHADOWS.small,
  },
  planCard: {
    backgroundColor: THEME.COLORS.card,
    borderRadius: 15,
    marginBottom: 20,
    overflow: 'hidden',
    ...THEME.SHADOWS.medium,
  },
  planImage: {
    width: '100%',
    height: 150,
  },
  planOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 150,
    backgroundColor: 'rgba(0,0,0,0.3)',
    paddingHorizontal: 15,
    paddingVertical: 15,
    justifyContent: 'flex-end',
  },
  planDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  planCategory: {
    color: THEME.COLORS.light,
    fontSize: THEME.SIZES.small,
    opacity: 0.8,
    marginBottom: 3,
  },
  planTitle: {
    color: THEME.COLORS.light,
    fontSize: THEME.SIZES.large,
    fontWeight: 'bold',
  },
  planPointsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 15,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  planPointsText: {
    color: THEME.COLORS.light,
    fontSize: THEME.SIZES.small,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  planContent: {
    padding: 15,
  },
  planDescription: {
    fontSize: THEME.SIZES.small,
    marginBottom: 15,
  },
  planInfo: {
    flexDirection: 'row',
    marginBottom: 15,
  },
  planInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 15,
  },
  planInfoText: {
    fontSize: THEME.SIZES.small,
    marginLeft: 5,
  },
  planPlaces: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 15,
  },
  planPlace: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 5,
    marginBottom: 5,
  },
  planPlaceText: {
    fontSize: THEME.SIZES.small,
    marginLeft: 3,
  },
  useThisPlanButton: {
    backgroundColor: THEME.COLORS.primary,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  useThisPlanButtonText: {
    color: THEME.COLORS.light,
    fontSize: THEME.SIZES.small,
    fontWeight: 'bold',
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: THEME.COLORS.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    height: '80%',
  },
  modalTitle: {
    fontSize: THEME.SIZES.large,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  placesList: {
    flex: 1,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginBottom: 10,
    backgroundColor: THEME.COLORS.card,
    borderRadius: 10,
    ...THEME.SHADOWS.small,
  },
  selectedPlaceItem: {
    borderColor: THEME.COLORS.primary,
    borderWidth: 1,
  },
  placeImage: {
    width: 60,
    height: 60,
    borderRadius: 10,
    marginRight: 10,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: THEME.SIZES.medium,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  placeType: {
    fontSize: THEME.SIZES.small,
    color: THEME.COLORS.gray,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  modalButton: {
    flex: 1,
    padding: 15,
    borderRadius: 10,
    marginHorizontal: 5,
  },
  cancelButton: {
    backgroundColor: THEME.COLORS.gray,
  },
  confirmButton: {
    backgroundColor: THEME.COLORS.primary,
  },
  modalButtonText: {
    color: THEME.COLORS.light,
    textAlign: 'center',
    fontWeight: 'bold',
  },
  errorText: {
    color: THEME.COLORS.error,
    textAlign: 'center',
    marginTop: 10,
  },
  suggestionsContainer: {
    position: 'absolute',
    top: 80, // Positioned below the search input
    left: 20,
    right: 20,
    backgroundColor: THEME.COLORS.card,
    borderRadius: 10,
    maxHeight: 200,
    zIndex: 100,
    ...THEME.SHADOWS.medium,
  },
  suggestionsList: {
    maxHeight: 200,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.COLORS.border,
  },
  suggestionText: {
    fontSize: THEME.SIZES.small,
  },
});
