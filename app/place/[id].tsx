import { useEffect, useState } from 'react';
import { StyleSheet, View, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator, Platform, Linking, Dimensions } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FontAwesome5 } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import { supabase } from '@/lib/supabase';
import { ThemedText } from '@/components/ThemedText';
import { THEME } from '@/constants/Theme';
import { Place } from '@/types';
import { getCurrentLocation } from '@/lib/googleMapsService';
import { checkinService } from '@/services/checkinService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const [place, setPlace] = useState<Place | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [hasCheckedIn, setHasCheckedIn] = useState(false);

  useEffect(() => {
    fetchPlaceDetails();
  }, [id]);

  const fetchPlaceDetails = async () => {
    if (!id) {
      setError('Place ID is missing');
      setIsLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('places')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Place not found');

      setPlace(data);
    } catch (error) {
      console.error('Error fetching place details:', error);
      setError('Failed to load place details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!place || isCheckingIn || hasCheckedIn) return;

    setIsCheckingIn(true);
    try {
      const userLocation = await getCurrentLocation();
      if (!userLocation) {
        Alert.alert('Hata', 'Konum alınamadı. Lütfen konum izinlerini kontrol edin.');
        return;
      }

      // Get current user
      const { data: { user }} = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Hata', 'Oturum açmanız gerekiyor.');
        return;
      }

      const checkInResult = await checkinService.checkInToPlace(
        user.id,
        place.id,
        {
          location: userLocation,
          notes: '',
        }
      );

      if (checkInResult) {
        setHasCheckedIn(true);
        Alert.alert('Başarılı', 'Check-in başarıyla yapıldı!');
      } else {
        Alert.alert('Hata', 'Check-in yapılamadı. Lütfen daha sonra tekrar deneyin.');
      }
    } catch (err) {
      console.error('Check-in error:', err);
      Alert.alert('Hata', 'Check-in yapılırken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsCheckingIn(false);
    }
  };

  const openMapsWithDirections = (latitude: number, longitude: number, placeName: string) => {
    const scheme = Platform.select({ ios: 'maps:', android: 'geo:' });
    const url = Platform.select({
      ios: `maps:0,0?q=${latitude},${longitude}(${placeName})`,
      android: `geo:${latitude},${longitude}?q=${latitude},${longitude}(${placeName})`
    });

    if (url) {
      Linking.openURL(url).catch((err) => 
        Alert.alert('Hata', 'Harita uygulaması açılamadı.')
      );
    }
  };

  const addToTrip = () => {
    if (!id) return;
    router.push({
      pathname: '/(tabs)/planner',
      params: { addPlace: id }
    });
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.COLORS.primary} />
      </SafeAreaView>
    );
  }

  if (error || !place) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <FontAwesome5 
          name="exclamation-circle" 
          size={50} 
          color={THEME.COLORS.error} 
        />
        <ThemedText style={styles.errorText}>{error || 'Place not found'}</ThemedText>
        <TouchableOpacity 
          style={styles.backButton} 
          onPress={() => router.back()}
        >
          <ThemedText style={styles.backButtonText}>Geri Dön</ThemedText>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <Stack.Screen 
        options={{
          headerTransparent: true,
          headerTintColor: '#fff',
          headerTitle: '',
          headerStyle: { backgroundColor: 'transparent' },
        }}
      />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        bounces={false}
      >
        {/* Hero Image Section */}
        <View style={styles.heroContainer}>
          <Image 
            source={{ uri: place.image_url }} 
            style={styles.heroImage}
            resizeMode="cover"
          />
          <View style={styles.heroOverlay}>
            <View style={styles.heroContent}>
              <ThemedText style={styles.title}>{place.name}</ThemedText>
              <View style={styles.locationRow}>
                <FontAwesome5 name="map-marker-alt" size={16} color="#fff" />
                <ThemedText style={styles.locationText}>
                  {place.address || place.city}
                </ThemedText>
              </View>
            </View>
          </View>
        </View>

        {/* Stats Cards */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <FontAwesome5 name="star" size={20} color={THEME.COLORS.accent} />
            <ThemedText style={styles.statValue}>{place.rating}/5.0</ThemedText>
            <ThemedText style={styles.statLabel}>Rating</ThemedText>
          </View>
          
          <View style={styles.statCard}>
            <FontAwesome5 name="users" size={20} color={THEME.COLORS.accent} />
            <ThemedText style={styles.statValue}>{place.visited_by || 0}</ThemedText>
            <ThemedText style={styles.statLabel}>Ziyaretçi</ThemedText>
          </View>
          
          <View style={styles.statCard}>
            <FontAwesome5 name="coins" size={20} color={THEME.COLORS.accent} />
            <ThemedText style={styles.statValue}>{place.points}</ThemedText>
            <ThemedText style={styles.statLabel}>Puan</ThemedText>
          </View>
        </View>

        {/* Description Section */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionTitle}>Hakkında</ThemedText>
          <ThemedText style={styles.description}>{place.description}</ThemedText>
        </View>

        {/* Map Section */}
        {place.location && (
          <View style={styles.section}>
            <ThemedText style={styles.sectionTitle}>Konum</ThemedText>
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: place.location.latitude,
                  longitude: place.location.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
              >
                <Marker
                  coordinate={{
                    latitude: place.location.latitude,
                    longitude: place.location.longitude,
                  }}
                  title={place.name}
                />
              </MapView>
            </View>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.primaryButton, hasCheckedIn && styles.disabledButton]}
            onPress={handleCheckIn}
            disabled={isCheckingIn || hasCheckedIn}
          >
            <FontAwesome5 
              name={hasCheckedIn ? "check-circle" : "map-marker-alt"}
              size={20} 
              color="#fff"
            />
            <ThemedText style={styles.actionButtonText}>
              {isCheckingIn ? 'Konum Doğrulanıyor...' : 
                hasCheckedIn ? 'Check-in Yapıldı' : 'Check-in Yap'}
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={() => {
              if (place.location) {
                openMapsWithDirections(
                  place.location.latitude,
                  place.location.longitude,
                  place.name
                );
              }
            }}
          >
            <FontAwesome5 name="directions" size={20} color={THEME.COLORS.primary} />
            <ThemedText style={[styles.actionButtonText, { color: THEME.COLORS.primary }]}>
              Yol Tarifi Al
            </ThemedText>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.tertiaryButton]}
            onPress={addToTrip}
          >
            <FontAwesome5 name="calendar-plus" size={20} color={THEME.COLORS.text} />
            <ThemedText style={[styles.actionButtonText, { color: THEME.COLORS.text }]}>
              Planıma Ekle
            </ThemedText>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.COLORS.background,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.COLORS.background,
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    textAlign: 'center',
    marginVertical: 20,
  },
  backButton: {
    padding: 12,
    backgroundColor: THEME.COLORS.primary,
    borderRadius: 8,
  },
  backButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  heroContainer: {
    height: SCREEN_HEIGHT * 0.45,
    width: SCREEN_WIDTH,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '60%',
    justifyContent: 'flex-end',
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  heroContent: {
    marginBottom: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  locationText: {
    fontSize: 16,
    color: '#fff',
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 20,
    marginTop: -40,
    zIndex: 1,
  },
  statCard: {
    backgroundColor: THEME.COLORS.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: SCREEN_WIDTH * 0.27,
    shadowColor: THEME.COLORS.shadowColor,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: THEME.COLORS.gray,
    marginTop: 4,
  },
  section: {
    padding: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: THEME.COLORS.gray,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
    marginTop: 8,
  },
  map: {
    width: '100%',
    height: '100%',
  },
  actionsContainer: {
    padding: 20,
    gap: 12,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    borderRadius: 12,
    gap: 8,
  },
  primaryButton: {
    backgroundColor: THEME.COLORS.primary,
  },
  secondaryButton: {
    backgroundColor: THEME.COLORS.card,
    borderWidth: 1,
    borderColor: THEME.COLORS.primary,
  },
  tertiaryButton: {
    backgroundColor: THEME.COLORS.card,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  disabledButton: {
    backgroundColor: THEME.COLORS.gray,
    opacity: 0.7,
  },
});
