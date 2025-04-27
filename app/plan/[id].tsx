import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, ScrollView, ActivityIndicator, Image, TouchableOpacity, Dimensions, Alert, RefreshControl } from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import * as Location from 'expo-location';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { plannerService } from '@/services/plannerService';
import { Place, TripPlan } from '@/types';
import { THEME } from '@/constants/Theme';
import { supabase } from '@/lib/supabase';

const { width } = Dimensions.get('window');

export default function PlanDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [plan, setPlan] = useState<TripPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [updatingPlace, setUpdatingPlace] = useState<string | null>(null);
  const [locationTracking, setLocationTracking] = useState(false);
  const locationTrackerId = useRef<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    
    if (id) {
      fetchPlanDetails(id);
    } else {
      setError('Plan ID bulunamadı.');
      setLoading(false);
    }

    // Start location tracking when component mounts
    startLocationTracking();

    // Clean up when component unmounts
    return () => {
      stopLocationTracking();
    };
  }, [id]);

  const handleToggleVisitStatus = async (placeId: string, newStatus: 'visited' | 'not_visited') => {
    if (!plan || !id) return;
    
    try {
      setUpdatingPlace(placeId);
      
      // Sadece ziyaret edildi olarak işaretleme durumunda konum kontrolü yap
      if (newStatus === 'visited') {
        try {
          // Konum izni kontrolü
          const { status } = await Location.requestForegroundPermissionsAsync();
          if (status !== 'granted') {
            Alert.alert(
              "Konum İzni Gerekli",
              "Ziyaret etmek için konum izni vermeniz gerekmektedir.",
              [{ text: "Tamam" }]
            );
            setUpdatingPlace(null);
            return;
          }

          // Kullanıcının konumunu al
          const locationResult = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High
          });

          // Veritabanından yer bilgilerini doğrudan getir
          const { data: placeData, error: placeError } = await supabase
            .from('places')
            .select('location, name')
            .eq('id', placeId)
            .single();

          if (placeError || !placeData || !placeData.location) {
            console.error("Yer konum bilgisi alınamadı:", placeError);
            Alert.alert(
              "Konum Bilgisi Yok",
              "Bu yerin konum bilgileri eksik olduğu için ziyaret kontrolü yapılamıyor.",
              [{ text: "Tamam" }]
            );
            setUpdatingPlace(null);
            return;
          }

          // Konum verisini alıp mesafe hesapla
          const placeLocation = placeData.location;
          console.log("Yer konum verileri:", JSON.stringify(placeLocation));
          
          // Location verisi farklı formatlarda gelebilir, kontrol et
          let placeLat, placeLng;
          
          // Farklı konum formatlarını işle
          if (placeLocation && typeof placeLocation === 'object' && placeLocation.coordinates && Array.isArray(placeLocation.coordinates)) {
            // PostGIS formatı: [longitude, latitude]
            placeLng = placeLocation.coordinates[0];
            placeLat = placeLocation.coordinates[1];
          } else if (placeLocation && typeof placeLocation === 'object' && placeLocation.latitude !== undefined && placeLocation.longitude !== undefined) {
            // Düz obje formatı
            placeLat = placeLocation.latitude;
            placeLng = placeLocation.longitude;
          } else if (typeof placeLocation === 'string') {
            // WKB formatı veya diğer string formatlar için
            // WKB formatı genellikle "0101000020E610000004172B6A306D414065564A2AAE564340" şeklinde görünür
            
            // Önce GeoJSON olma ihtimalini dene
            let isJsonString = false;
            if (placeLocation.startsWith('{') || placeLocation.startsWith('[')) {
              try {
                const locationObj = JSON.parse(placeLocation);
                if (locationObj.coordinates && Array.isArray(locationObj.coordinates)) {
                  placeLng = locationObj.coordinates[0];
                  placeLat = locationObj.coordinates[1];
                  isJsonString = true;
                }
              } catch (e) {
                // JSON olarak parse edilemedi, bu normal - sessizce devam et
              }
            }
            
            // JSON değilse, muhtemelen WKB formatıdır
            if (!isJsonString) {
              try {
                // Bu noktada doğrudan supabase ile koordinatları almayı deneyelim
                console.log("WKB formatında konum algılandı, alternatif sorgulama yapılıyor...");
                
                // Ayrı bir sorgu ile koordinatları doğrudan ST_X ve ST_Y fonksiyonlarını kullanarak alalım
                const { data: coordData, error: coordError } = await supabase.rpc('get_place_coordinates', { 
                  place_id: placeId 
                });
                
                if (coordError || !coordData) {
                  console.error("Koordinat dönüşümü hatası:", coordError);
                  throw new Error("Koordinat dönüşümü yapılamadı");
                }
                
                console.log("Dönüştürülen koordinatlar:", coordData);
                
                if (coordData.lat && coordData.lng) {
                  placeLat = parseFloat(coordData.lat);
                  placeLng = parseFloat(coordData.lng);
                } else {
                  throw new Error("Geçerli koordinat verisi alınamadı");
                }
              } catch (wkbError) {
                console.error("WKB format işleme hatası:", wkbError);
                throw new Error("Konum verisi hiçbir bilinen formatta işlenemedi");
              }
            }
          }
          
          // Eğer hala konum bilgisi bulunamadıysa
          if (placeLat === undefined || placeLng === undefined) {
            throw new Error("Konum bilgileri okunamadı");
          }
          
          const distance = calculateDistance(
            locationResult.coords.latitude,
            locationResult.coords.longitude,
            placeLat,
            placeLng
          );

          console.log(`Mesafe kontrolü: ${distance} km (${Math.round(distance * 1000)} metre)`);
          console.log(`Konum: Kullanıcı (${locationResult.coords.latitude}, ${locationResult.coords.longitude}), Yer (${placeLat}, ${placeLng})`);

          // Eğer 200 metreden uzaktaysa izin verme
          if (distance > 0.2) { // 0.2 km = 200 metre
            Alert.alert(
              "Uzaktasınız",
              `${placeData.name} yerine ziyaret etmek için en az 200 metre yakınında olmalısınız. Şu anki mesafeniz: ${Math.round(distance * 1000)} metre.`,
              [{ text: "Tamam" }]
            );
            setUpdatingPlace(null);
            return;
          }

          console.log("Konum kontrolü başarılı! Yakınlık onaylandı.");
        } catch (locationErr) {
          console.error("Konum alınamadı:", locationErr);
          Alert.alert(
            "Konum Hatası",
            "Konumunuz alınamadığı için işlem gerçekleştirilemedi. Konum servislerinin açık olduğundan emin olun.",
            [{ text: "Tamam" }]
          );
          setUpdatingPlace(null);
          return;
        }
      }
      
      // Konum kontrolü geçildi, durumu güncelle
      const success = await plannerService.updatePlaceVisitStatus(id, placeId, newStatus);
      
      if (success) {
        console.log(`Yer durumu başarıyla güncellendi: ${newStatus}`);
        fetchPlanDetails(id);
      } else {
        Alert.alert("Hata", "Yer durumu güncellenirken bir sorun oluştu.");
      }
    } catch (err: any) {
      console.error('Error updating place status:', err);
      Alert.alert("Hata", "Yer durumu güncellenirken bir sorun oluştu.");
    } finally {
      setUpdatingPlace(null);
    }
  };
  
  // İki nokta arasındaki mesafeyi km cinsinden hesaplar (Haversine formülü)
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371; // Dünya yarıçapı (km)
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Kilometre cinsinden mesafe
    return distance;
  };

  const fetchPlanDetails = async (planId: string) => {
    setLoading(true);
    setError(null);
    try {
      const fetchedPlan = await plannerService.getTripPlanById(planId);
      if (fetchedPlan) {
        setPlan(fetchedPlan);
      } else {
        setError('Plan bulunamadı.');
      }
    } catch (err: any) {
      console.error('Error fetching plan details:', err);
      setError(err.message || 'Plan detayları yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleCancelPlan = () => {
    if (!plan || !id) return;
    
    Alert.alert(
      "Planı İptal Et",
      "Bu planı iptal etmek istediğinize emin misiniz? Bu işlem geri alınamaz.",
      [
        { 
          text: "Vazgeç", 
          style: "cancel" 
        },
        { 
          text: "İptal Et", 
          style: "destructive",
          onPress: async () => {
            try {
              setCancelling(true);
              // Planı iptal et (status'u "cancelled" olarak güncelle)
              const updated = await plannerService.updateTripPlan(id, { status: 'cancelled' });
              if (updated) {
                // Güncellenen planı göster
                setPlan({...plan, status: 'cancelled'});
                Alert.alert(
                  "Başarılı",
                  "Plan başarıyla iptal edildi.",
                  [{ text: "Tamam", onPress: () => router.back() }]
                );
              }
            } catch (err: any) {
              console.error('Error cancelling plan:', err);
              Alert.alert("Hata", "Plan iptal edilirken bir sorun oluştu.");
            } finally {
              setCancelling(false);
            }
          } 
        }
      ]
    );
  };

  // Konum takibini başlat
  const startLocationTracking = async () => {
    try {
      // Konum izni iste
      const { status } = await Location.requestForegroundPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          "İzin Gerekli", 
          "Otomatik yer ziyareti için konum izni gereklidir. Ayarlardan uygulamaya konum izni verebilirsiniz.",
          [{ text: "Tamam" }]
        );
        return;
      }
      
      setLocationTracking(true);
      
      // Konum değişikliklerini 1 dakikada bir kontrol et (batarya tasarrufu için)
      locationTrackerId.current = setInterval(async () => {
        if (!id) return;
        
        try {
          // Mevcut konumu al
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced
          });
          
          // Yakındaki yerleri kontrol et ve ziyaret durumunu güncelle
          const updated = await plannerService.checkLocationBasedVisit(id, {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude
          });
          
          // Eğer bir yer ziyaret edildiyse planı yeniden yükle
          if (updated) {
            fetchPlanDetails(id);
            
            // Bildirim göster
            Alert.alert(
              "Yeni Yer Ziyaret Edildi!",
              "Yakınında olduğunuz yer(ler) otomatik olarak ziyaret edildi olarak işaretlendi.",
              [{ text: "Harika!" }]
            );
          }
        } catch (err) {
          console.error("Konum takibi hatası:", err);
        }
      }, 60000); // 60 saniye = 1 dakika
    } catch (err) {
      console.error("Konum takibi başlatma hatası:", err);
    }
  };
  
  // Konum takibini durdur
  const stopLocationTracking = () => {
    if (locationTrackerId.current) {
      clearInterval(locationTrackerId.current);
      locationTrackerId.current = null;
    }
    setLocationTracking(false);
  };

  const onRefresh = useCallback(async () => {
    if (id) {
      setRefreshing(true);
      await fetchPlanDetails(id);
      setRefreshing(false);
    }
  }, [id]);

  if (loading) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ActivityIndicator size="large" color={THEME.COLORS.primary} />
        <ThemedText style={styles.loadingText}>Plan detayları yükleniyor...</ThemedText>
      </ThemedView>
    );
  }

  if (error) {
    return (
      <ThemedView style={styles.centerContainer}>
        <FontAwesome5 name="exclamation-circle" size={50} color={THEME.COLORS.error} style={styles.errorIcon} />
        <ThemedText style={styles.errorText}>{error}</ThemedText>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ThemedText style={styles.backButtonText}>Geri Dön</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  if (!plan) {
    return (
      <ThemedView style={styles.centerContainer}>
        <ThemedText>Plan bilgileri yüklenemedi.</ThemedText>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <ThemedText style={styles.backButtonText}>Geri Dön</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    );
  }

  return (
    <>
      <Stack.Screen options={{ 
        title: plan.title || 'Plan Detayı',
        headerShown: true,
      }} />
      
      <ScrollView 
        style={styles.container}
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={onRefresh} 
            colors={[THEME.COLORS.primary]}
            tintColor={THEME.COLORS.primary}
          />
        }
      >
        <Image 
          source={{ uri: plan.image_url || 'https://via.placeholder.com/800x400' }} 
          style={styles.headerImage}
          resizeMode="cover"
        />
        
        <View style={styles.header}>
          <View style={styles.titleContainer}>
            <ThemedText style={styles.title}>{plan.title}</ThemedText>
            {plan.status && (
              <View style={[
                styles.statusBadge, 
                plan.status === 'completed' ? styles.completedBadge : 
                plan.status === 'cancelled' ? styles.cancelledBadge : 
                styles.pendingBadge
              ]}>
                <ThemedText style={styles.statusText}>
                  {plan.status === 'completed' ? 'Tamamlandı' : 
                   plan.status === 'cancelled' ? 'İptal Edildi' : 
                   plan.status === 'ongoing' ? 'Devam Ediyor' : 'Beklemede'}
                </ThemedText>
              </View>
            )}
          </View>
          <View style={styles.metaContainer}>
            <View style={styles.metaItem}>
              <FontAwesome5 name="calendar-alt" size={14} color={THEME.COLORS.primary} />
              <ThemedText style={styles.metaText}>{plan.duration}</ThemedText>
            </View>
            <View style={styles.metaItem}>
              <FontAwesome5 name="wallet" size={14} color={THEME.COLORS.primary} />
              <ThemedText style={styles.metaText}>{plan.budget}</ThemedText>
            </View>
            <View style={styles.metaItem}>
              <FontAwesome5 name="tags" size={14} color={THEME.COLORS.primary} />
              <ThemedText style={styles.metaText}>{plan.category}</ThemedText>
            </View>
          </View>
          {plan.description && (
            <ThemedText style={styles.description}>{plan.description}</ThemedText>
          )}
        </View>

        <View style={styles.routeSection}>
          <View style={styles.sectionHeader}>
            <FontAwesome5 name="route" size={20} color={THEME.COLORS.primary} />
            <ThemedText style={styles.sectionTitle}>Gezi Rotası</ThemedText>
          </View>
          
          <View style={styles.routeContainer}>
            <View style={styles.routeVisual}>
              {plan.places && plan.places.length > 0 ? (
                plan.places.map((place, index) => (
                  <View key={place.id} style={styles.routePointContainer}>
                    <View style={[
                      styles.routePointNumber,
                      place.status === 'visited' && styles.visitedRoutePoint
                    ]}>
                      {place.status === 'visited' ? (
                        <FontAwesome5 name="check" size={14} color={THEME.COLORS.white} />
                      ) : (
                        <ThemedText style={styles.routePointNumberText}>{index + 1}</ThemedText>
                      )}
                    </View>
                    
                    {index < (plan.places?.length || 0) - 1 && (
                      <View style={styles.routeLine} />
                    )}
                    
                    <View style={styles.routePointInfo}>
                      <ThemedText style={styles.routePointName}>{place.name}</ThemedText>
                      
                      <TouchableOpacity 
                        style={[
                          styles.visitStatusBadge,
                          place.status === 'visited' ? styles.visitedBadge : styles.notVisitedBadge
                        ]}
                        disabled={updatingPlace === place.id || plan.status === 'cancelled' || plan.status === 'completed'}
                        onPress={() => handleToggleVisitStatus(place.id, place.status === 'visited' ? 'not_visited' : 'visited')}
                      >
                        {updatingPlace === place.id ? (
                          <ActivityIndicator size="small" color={THEME.COLORS.white} />
                        ) : (
                          <FontAwesome5 
                            name={place.status === 'visited' ? "check-circle" : "circle"} 
                            size={16} 
                            color={THEME.COLORS.white} 
                            solid={place.status === 'visited'}
                          />
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              ) : (
                <ThemedText style={styles.infoText}>Bu planda rotada yer bulunmuyor.</ThemedText>
              )}
            </View>
          </View>
        </View>

        <View style={styles.placesSection}>
          <View style={styles.sectionHeader}>
            <FontAwesome5 name="map-marker-alt" size={20} color={THEME.COLORS.primary} />
            <ThemedText style={styles.sectionTitle}>Ziyaret Edilecek Yerler</ThemedText>
          </View>
          
          {plan.places && plan.places.length > 0 ? (
            plan.places.map((place, index) => (
              <TouchableOpacity 
                key={place.id} 
                style={styles.placeItem}
                onPress={() => router.push(`/place/${place.id}`)}
              >
                <View style={styles.placeOrderContainer}>
                  <ThemedText style={styles.placeOrder}>{index + 1}</ThemedText>
                </View>
                
                <Image 
                  source={{ uri: place.image_url || place.image || 'https://via.placeholder.com/60x60' }} 
                  style={styles.placeImage}
                  resizeMode="cover"
                />
                
                <View style={styles.placeInfo}>
                  <ThemedText style={styles.placeName}>{place.name}</ThemedText>
                  <ThemedText style={styles.placeType}>{place.type}</ThemedText>
                  <ThemedText style={styles.placeDescription} numberOfLines={2}>
                    {place.description || `${place.name}, ${place.city || 'Türkiye'} bölgesinde popüler bir turistik yer.`}
                  </ThemedText>
                </View>
                <FontAwesome5 name="chevron-right" size={14} color={THEME.COLORS.gray} />
              </TouchableOpacity>
            ))
          ) : (
            <ThemedText style={styles.infoText}>Bu plana eklenmiş yer bulunmuyor.</ThemedText>
          )}
        </View>
        
        {/* Show Cancel Button if plan is not completed or cancelled */}
        {(!plan.status || plan.status === 'pending' || plan.status === 'ongoing') && (
          <View style={styles.actionSection}>
            <TouchableOpacity 
              style={styles.cancelButton}
              onPress={handleCancelPlan}
              disabled={cancelling}
            >
              {cancelling ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <FontAwesome5 name="times-circle" size={16} color="#fff" style={styles.buttonIcon} />
                  <ThemedText style={styles.cancelButtonText}>Planı İptal Et</ThemedText>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: THEME.COLORS.text,
  },
  errorIcon: {
    marginBottom: 16,
  },
  errorText: {
    color: THEME.COLORS.error,
    textAlign: 'center',
    fontSize: 16,
    marginBottom: 20,
  },
  backButton: {
    backgroundColor: THEME.COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 16,
  },
  backButtonText: {
    color: THEME.COLORS.light,
    fontWeight: 'bold',
  },
  headerImage: {
    width: '100%',
    height: 200,
  },
  header: {
    padding: 16,
    backgroundColor: THEME.COLORS.card,
    borderRadius: 12,
    margin: 16,
    marginTop: -30,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  titleContainer: {
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 12,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  completedBadge: {
    backgroundColor: '#4caf50',
  },
  cancelledBadge: {
    backgroundColor: '#f44336',
  },
  pendingBadge: {
    backgroundColor: '#ff9800',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  metaContainer: {
    flexDirection: 'row',
    marginBottom: 12,
    flexWrap: 'wrap',
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 16,
    marginBottom: 8,
  },
  metaText: {
    marginLeft: 6,
    fontSize: 14,
    color: THEME.COLORS.text,
  },
  description: {
    fontSize: 14,
    color: THEME.COLORS.text,
    lineHeight: 20,
  },
  routeSection: {
    margin: 16,
    marginTop: 0,
    padding: 16,
    backgroundColor: THEME.COLORS.card,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, 
    shadowRadius: 3,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginLeft: 8,
  },
  routeContainer: {
    padding: 10,
    backgroundColor: THEME.COLORS.background,
    borderRadius: 8,
  },
  routeVisual: {
    marginVertical: 10,
  },
  routePointContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    position: 'relative',
  },
  routePointNumber: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: THEME.COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  visitedRoutePoint: {
    backgroundColor: THEME.COLORS.success,
  },
  routePointNumberText: {
    color: THEME.COLORS.light,
    fontWeight: 'bold',
  },
  routeLine: {
    position: 'absolute',
    left: 15,
    top: 30,
    width: 2,
    height: 40,
    backgroundColor: THEME.COLORS.primary,
  },
  routePointInfo: {
    flex: 1, 
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  routePointName: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
  visitCheckbox: {
    backgroundColor: THEME.COLORS.gray,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visitedCheckbox: {
    backgroundColor: THEME.COLORS.success,
  },
  visitButtonText: {
    color: THEME.COLORS.white,
    fontSize: 12,
    fontWeight: 'bold',
  },
  visitStatusBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  visitedBadge: {
    backgroundColor: THEME.COLORS.success,
  },
  notVisitedBadge: {
    backgroundColor: THEME.COLORS.gray,
  },
  placesSection: {
    margin: 16,
    marginTop: 0,
    marginBottom: 8,
    padding: 16,
    backgroundColor: THEME.COLORS.card,
    borderRadius: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: THEME.COLORS.border,
    marginBottom: 10,
  },
  placeOrderContainer: {
    width: 30,
    height: 30,
    backgroundColor: THEME.COLORS.primary,
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  placeOrder: {
    color: THEME.COLORS.light,
    fontWeight: 'bold',
  },
  placeImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  placeType: {
    fontSize: 12,
    color: THEME.COLORS.gray,
    marginBottom: 4,
  },
  placeDescription: {
    fontSize: 12,
    color: THEME.COLORS.gray,
    lineHeight: 16,
  },
  infoText: {
    textAlign: 'center',
    color: THEME.COLORS.gray,
    padding: 10,
  },
  actionSection: {
    margin: 16,
    marginTop: 8,
    marginBottom: 32,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: THEME.COLORS.error,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    width: '80%',
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  buttonIcon: {
    marginRight: 8,
  }
});
