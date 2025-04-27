import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, Image, TouchableOpacity, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import MapView, { Marker } from 'react-native-maps';
import * as Location from 'expo-location';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { placesService } from '@/services/placesService';
import { THEME } from '@/constants/Theme';
import { Place } from '@/types';

const { width } = Dimensions.get('window');
const CONTENT_WIDTH = width - 40;

// Bir kullanıcının check-in yapabilmesi için yere ne kadar yakın olması gerektiği (metre cinsinden)
const CHECK_IN_DISTANCE_THRESHOLD = 300; // 300 metre

export default function PlaceDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [place, setPlace] = useState<Place | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPlaceDetails();
    }
  }, [id]);

  const fetchPlaceDetails = async () => {
    try {
      setIsLoading(true);
      // Fetch all places and find the one with matching id
      const places = await placesService.getAllPlaces();
      let foundPlace = places.find(p => p.id === id);
      
      if (foundPlace) {
        setPlace(foundPlace);
        setError(null);
      } else {
        setError('Yer bulunamadı');
      }
    } catch (err) {
      setError('Yer detayları yüklenirken bir hata oluştu');
      console.error('Error fetching place details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Check-in yapma işlemi
  const handleCheckIn = async () => {
    if (!place || !place.location) {
      Alert.alert('Hata', 'Bu yer için konum bilgisi bulunamadı.');
      return;
    }

    setIsCheckingIn(true);

    try {
      // Konum izni iste
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'İzin Gerekli', 
          'Check-in yapabilmek için konum izni vermeniz gerekiyor.',
          [{ text: 'Tamam' }]
        );
        setIsCheckingIn(false);
        return;
      }

      // Mevcut kullanıcı konumunu al
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High
      });

      // Kullanıcının konumu ile yerin konumu arasındaki mesafeyi hesapla
      const distance = calculateDistance(
        location.coords.latitude,
        location.coords.longitude,
        place.location.latitude,
        place.location.longitude
      );

      // Kullanıcı yere yeterince yakınsa check-in yapabilir
      if (distance <= CHECK_IN_DISTANCE_THRESHOLD) {
        // Burada gerçek check-in işlemini yapacak servisi çağırabiliriz
        // Örneğin: await placesService.checkInToPlace(place.id);
        
        Alert.alert(
          'Başarılı!', 
          `${place.name} yerine başarıyla check-in yaptınız! ${place.points} puan kazandınız.`,
          [{ text: 'Harika!' }]
        );
      } else {
        // Kullanıcı yeterince yakın değilse hata mesajı göster
        Alert.alert(
          'Çok Uzaktasınız', 
          `Check-in yapabilmek için ${place.name} konumuna daha yakın olmanız gerekiyor.`,
          [{ text: 'Anladım' }]
        );
      }
    } catch (err) {
      console.error('Check-in error:', err);
      Alert.alert('Hata', 'Check-in yapılırken bir hata oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsCheckingIn(false);
    }
  };

  // İki nokta arasındaki mesafeyi metre cinsinden hesaplayan fonksiyon (Haversine formülü)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Dünya'nın yarıçapı (metre)
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c;

    return distance; // metre cinsinden
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={THEME.COLORS.primary} />
        <ThemedText style={styles.loadingText}>Yer detayları yükleniyor...</ThemedText>
      </SafeAreaView>
    );
  }

  if (error || !place) {
    return (
      <SafeAreaView style={styles.errorContainer}>
        <FontAwesome5 name="exclamation-circle" size={50} color={THEME.COLORS.error || "#ff6b6b"} />
        <ThemedText style={styles.errorText}>{error || 'Bilinmeyen bir hata oluştu'}</ThemedText>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <ThemedText style={styles.backButtonText}>Geri Dön</ThemedText>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      
      <Stack.Screen 
        options={{
          title: place.name,
          headerStyle: { backgroundColor: THEME.COLORS.background },
          headerTintColor: THEME.COLORS.text,
          headerShadowVisible: false,
        }}
      />
      
      {/* Hero Image */}
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: place.image || place.image_url }}
          style={styles.heroImage}
          resizeMode="cover"
        />
        <View style={styles.imageOverlay}>
          <View style={styles.placeStats}>
            <View style={styles.placeBadge}>
              <ThemedText style={styles.placeBadgeText}>{place.type}</ThemedText>
            </View>
            <View style={styles.placePoints}>
              <FontAwesome5 name="star" size={16} color={THEME.COLORS.accent} />
              <ThemedText style={styles.placePointsText}>{place.points} Puan</ThemedText>
            </View>
          </View>
        </View>
      </View>
      
      {/* Content */}
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Place Info */}
        <View style={styles.infoSection}>
          <ThemedText style={styles.title}>{place.name}</ThemedText>
          <View style={styles.locationRow}>
            <FontAwesome5 name="map-marker-alt" size={16} color={THEME.COLORS.primary} />
            <ThemedText style={styles.locationText}>{place.city}</ThemedText>
          </View>
          
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <FontAwesome5 name="users" size={16} color={THEME.COLORS.gray} />
              <ThemedText style={styles.statText}>{place.visited_by || 0} ziyaretçi</ThemedText>
            </View>
            <View style={styles.statItem}>
              <FontAwesome5 name="star" size={16} color={THEME.COLORS.accent} />
              <ThemedText style={styles.statText}>{place.rating}/5.0</ThemedText>
            </View>
          </View>
        </View>
        
        {/* Description */}
        <View style={styles.descriptionSection}>
          <ThemedText style={styles.sectionTitle}>Hakkında</ThemedText>
          <ThemedText style={styles.description}>{place.description}</ThemedText>
        </View>
        
        {/* Map */}
        {place.location && (
          <View style={styles.mapSection}>
            <ThemedText style={styles.sectionTitle}>Konum</ThemedText>
            <View style={styles.mapContainer}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: place.location.latitude,
                  longitude: place.location.longitude,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
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
        
        {/* Actions */}
        <View style={styles.actionsSection}>
          <ThemedText style={styles.sectionTitle}>Aksiyon</ThemedText>
          <TouchableOpacity 
            style={styles.checkInButton}
            onPress={handleCheckIn}
            disabled={isCheckingIn}
          >
            <FontAwesome5 name="map-marker-alt" size={18} color={THEME.COLORS.light} />
            <ThemedText style={styles.checkInButtonText}>
              {isCheckingIn ? 'Konum Doğrulanıyor...' : 'Check-in Yap'}
            </ThemedText>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.planButton}>
            <FontAwesome5 name="calendar-plus" size={18} color={THEME.COLORS.primary} />
            <ThemedText style={styles.planButtonText}>Ziyaret Planına Ekle</ThemedText>
          </TouchableOpacity>
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.COLORS.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: THEME.SIZES.medium,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: THEME.COLORS.background,
  },
  errorText: {
    marginTop: 10,
    fontSize: THEME.SIZES.medium,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: THEME.COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backButtonText: {
    color: THEME.COLORS.light,
    fontWeight: 'bold',
  },
  imageContainer: {
    width: '100%',
    height: 250,
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    padding: 15,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 30,
  },
  placeStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  placeBadge: {
    backgroundColor: THEME.COLORS.secondary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  placeBadgeText: {
    color: THEME.COLORS.light,
    fontSize: THEME.SIZES.small,
    fontWeight: 'bold',
  },
  placePoints: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  placePointsText: {
    color: THEME.COLORS.light,
    fontSize: THEME.SIZES.small,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  infoSection: {
    marginBottom: 20,
  },
  title: {
    fontSize: THEME.SIZES.xxlarge,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  locationText: {
    fontSize: THEME.SIZES.medium,
    marginLeft: 8,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '70%',
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statText: {
    fontSize: THEME.SIZES.medium,
    marginLeft: 8,
    color: THEME.COLORS.gray,
  },
  descriptionSection: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: THEME.SIZES.large,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  description: {
    fontSize: THEME.SIZES.medium,
    lineHeight: 22,
  },
  mapSection: {
    marginBottom: 20,
  },
  mapContainer: {
    height: 200,
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  actionsSection: {
    marginBottom: 20,
  },
  checkInButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.COLORS.primary,
    paddingVertical: 15,
    borderRadius: 8,
    marginBottom: 10,
  },
  checkInButtonText: {
    color: THEME.COLORS.light,
    fontWeight: 'bold',
    fontSize: THEME.SIZES.medium,
    marginLeft: 10,
  },
  planButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: THEME.COLORS.light,
    paddingVertical: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.COLORS.primary,
  },
  planButtonText: {
    color: THEME.COLORS.primary,
    fontWeight: 'bold',
    fontSize: THEME.SIZES.medium,
    marginLeft: 10,
  },
});
