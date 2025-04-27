import React, { useEffect, useMemo, useState } from 'react';
import { 
  Modal, 
  View, 
  StyleSheet, 
  TouchableOpacity, 
  ActivityIndicator, 
  Alert,
  SectionList
} from 'react-native';
import { Image } from 'expo-image';
import { FontAwesome5 } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { THEME } from '@/constants/Theme';
import { Place } from '@/types';

// Section data interface for the SectionList
interface PlaceSection {
  title: string;
  data: Place[];
}

interface PlaceSelectionModalProps {
  isVisible: boolean;
  setIsVisible: (visible: boolean) => void;
  loading: boolean;
  error: string | null;
  nearbyPlaces: Place[];
  selectedPlaces: Place[];
  setSelectedPlaces: React.Dispatch<React.SetStateAction<Place[]>>;
  destination: string;
  duration: string;
  budget: string;
  selectedInterests: string[];
  userId: string;
  onCreatePlan: (
    title: string,
    description: string,
    category: string,
    budget: string,
    duration: string,
    image_url: string,
    created_by: string,
    place_ids: string[]
  ) => Promise<any>;
  onClose: () => void;
}

export const PlaceSelectionModal = ({
  isVisible,
  setIsVisible,
  loading,
  error,
  nearbyPlaces,
  selectedPlaces,
  setSelectedPlaces,
  destination,
  duration,
  budget,
  selectedInterests,
  userId,
  onCreatePlan,
  onClose
}: PlaceSelectionModalProps) => {
  
  // Modal görünürlük değiştiğinde log
  useEffect(() => {
    console.log('Modal visibility changed to:', isVisible);
  }, [isVisible]);

  // Yerleri gruplandır
  const placeSections = useMemo(() => {
    if (!nearbyPlaces || nearbyPlaces.length === 0) return [];

    // Önce yerleri tipine göre gruplandır
    const placesByType: Record<string, Place[]> = {};
    
    nearbyPlaces.forEach(place => {
      if (!placesByType[place.type]) {
        placesByType[place.type] = [];
      }
      placesByType[place.type].push(place);
    });
    
    // Kullanıcının interests'lerine göre tavsiye edilen yerleri belirle
    // Eğer selectedInterests varsa ve dolu ise, bu ilgi alanlarına uyan yer tiplerini önceliklendir
    const preferredTypes = selectedInterests && selectedInterests.length > 0 
      ? selectedInterests.map(interest => {
          // İlgi alanlarını yer tiplerine dönüştür (basitleştirilmiş eşleştirme)
          switch(interest.toLowerCase()) {
            case 'yemek': return 'Restoran';
            case 'tarih': return 'Müze';
            case 'doğa': return 'Park';
            case 'eğlence': return 'Eğlence Merkezi';
            default: return interest;
          }
        })
      : [];

    // Öncelikli tavsiye edilecek yer tiplerini belirle
    const recommendedTypes = preferredTypes.length > 0 
      ? preferredTypes 
      : Object.keys(placesByType);
    
    // Tavsiye edilecek yerleri topla
    let recommendedPlaces: Place[] = [];
    
    // Öncelikle kullanıcının tercih ettiği tiplerden en iyi yerleri al
    recommendedTypes.forEach(type => {
      if (placesByType[type]) {
        const bestPlacesOfType = [...placesByType[type]]
          .sort((a, b) => {
            // Önce puana göre sırala (yüksek puan önce)
            const ratingDiff = (b.rating || 0) - (a.rating || 0);
            if (ratingDiff !== 0) return ratingDiff;
            
            // Eğer puanlar eşitse, ziyaret sayısına göre sırala
            return (b.visited_by || 0) - (a.visited_by || 0);
          })
          .slice(0, 1); // Her tipten en iyi 1 yer
        
        recommendedPlaces.push(...bestPlacesOfType);
      }
    });
    
    // Eğer kullanıcının ilgi alanlarına uygun yeterli yer bulunamadıysa, 
    // diğer yerlerden de ekle
    if (recommendedPlaces.length < 3) {
      const otherTypes = Object.keys(placesByType).filter(type => !recommendedTypes.includes(type));
      
      otherTypes.forEach(type => {
        if (recommendedPlaces.length < 3 && placesByType[type]) {
          const bestPlacesOfType = [...placesByType[type]]
            .sort((a, b) => {
              const ratingDiff = (b.rating || 0) - (a.rating || 0);
              if (ratingDiff !== 0) return ratingDiff;
              return (b.visited_by || 0) - (a.visited_by || 0);
            })
            .slice(0, 1);
          
          recommendedPlaces.push(...bestPlacesOfType);
        }
      });
    }
    
    // Sonuçları sınırlandır (en fazla 3 önerilen yer göster)
    const topRecommended = recommendedPlaces.slice(0, 3);
    
    // Bölümleri oluştur
    const sections: PlaceSection[] = [
      {
        title: '✨ Tavsiye Edilen Yerler',
        data: topRecommended
      }
    ];
    
    // Diğer tip gruplarını ekle
    Object.keys(placesByType).forEach(type => {
      sections.push({
        title: type,
        data: placesByType[type].sort((a, b) => (b.rating || 0) - (a.rating || 0)) // Her grubu kendi içinde puana göre sırala
      });
    });
    
    return sections;
  }, [nearbyPlaces]);

  if (!isVisible) return null;

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={true}
      onRequestClose={() => {
        console.log('Modal closed via back button/gesture');
        setIsVisible(false);
      }}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.modalContentWrapper}>
          <View style={styles.modalContent}>
            <ThemedText style={styles.modalTitle}>Ziyaret Edilecek Yerleri Seçin</ThemedText>
            
            {loading ? (
              <ActivityIndicator size="large" color={THEME.COLORS.primary} />
            ) : error ? (
              <ThemedText style={styles.errorText}>{error}</ThemedText>
            ) : (
              <SectionList
                sections={placeSections}
                keyExtractor={(item) => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.placeItem,
                      selectedPlaces.some(p => p.id === item.id) && styles.selectedPlaceItem
                    ]}
                    activeOpacity={0.7}
                    onPress={() => {
                      console.log('Place item pressed:', item.name);
                      // Seçimi güncelle
                      if (selectedPlaces.some(p => p.id === item.id)) {
                        setSelectedPlaces(prev => prev.filter(p => p.id !== item.id));
                      } else {
                        setSelectedPlaces(prev => [...prev, item]);
                      }
                    }}
                  >
                    <Image
                      source={{ uri: item.image || item.image_url }}
                      style={styles.placeImage}
                    />
                    <View style={styles.placeInfo}>
                      <ThemedText style={styles.placeName}>{item.name}</ThemedText>
                      <View style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4}}>
                        <FontAwesome5 name="star" size={12} color="#FFD700" />
                        <ThemedText style={{fontSize: 12, marginLeft: 4, fontWeight: '500'}}>{item.rating ? item.rating.toFixed(1) : '4.0'}</ThemedText>
                      </View>
                      <ThemedText style={styles.placeType}>{item.type}</ThemedText>
                      <ThemedText style={{fontSize: 12, color: THEME.COLORS.gray, marginTop: 4}} numberOfLines={2}>
                        {item.description || `${item.name}, ${item.city} bölgesinde popüler bir turistik yer.`}
                      </ThemedText>
                    </View>
                    {selectedPlaces.some(p => p.id === item.id) && (
                      <FontAwesome5 name="check-circle" size={20} color={THEME.COLORS.primary} />
                    )}
                  </TouchableOpacity>
                )}
                renderSectionHeader={({ section }) => (
                  <View style={styles.sectionHeader}>
                    <ThemedText style={styles.sectionTitle}>{section.title}</ThemedText>
                  </View>
                )}
                stickySectionHeadersEnabled={true}
                style={styles.placesList}
                contentContainerStyle={{paddingBottom: 20}}
              />
            )}
            
            <View style={styles.selectedCountContainer}>
              <ThemedText style={styles.selectedCountText}>
                {selectedPlaces.length} yer seçildi
              </ThemedText>
            </View>
            
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                activeOpacity={0.7}
                onPress={() => {
                  console.log('Cancel button pressed');
                  onClose();
                  setIsVisible(false);
                }}
              >
                <ThemedText style={styles.modalButtonText}>İptal</ThemedText>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                activeOpacity={0.7}
                onPress={async () => {
                  console.log('Confirm button pressed');
                  if (selectedPlaces.length === 0) {
                    Alert.alert('Hata', 'Lütfen en az bir yer seçin');
                    return;
                  }

                  try {
                    // Yeni plan oluştur
                    await onCreatePlan(
                      `${destination} Gezi Planı`,
                      `${duration} günlük ${destination} gezi planı`,
                      selectedInterests[0],
                      `${budget}₺`,
                      `${duration} Gün`,
                      selectedPlaces[0].image_url || selectedPlaces[0].image || 'https://via.placeholder.com/300',
                      userId,
                      selectedPlaces.map(p => p.id)
                    );

                    // Modalı kapat
                    setIsVisible(false);
                    onClose();
                    
                    Alert.alert('Başarılı', 'Gezi planınız oluşturuldu!');
                  } catch (error: any) {
                    Alert.alert('Hata', error.message || 'Plan oluşturulurken bir hata oluştu');
                  }
                }}
              >
                <ThemedText style={styles.modalButtonText}>Plan Oluştur</ThemedText>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
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
  modalContent: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    height: '100%',
  },
  modalTitle: {
    fontSize: THEME.SIZES.large,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  placesList: {
    flex: 1,
  },
  sectionHeader: {
    backgroundColor: THEME.COLORS.background,
    paddingVertical: 8,
    paddingHorizontal: 5,
    borderBottomWidth: 1,
    borderBottomColor: THEME.COLORS.border,
    marginBottom: 5,
  },
  sectionTitle: {
    fontSize: THEME.SIZES.medium,
    fontWeight: 'bold',
    color: THEME.COLORS.primary,
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
  selectedCountContainer: {
    padding: 8,
    backgroundColor: THEME.COLORS.gray + '20',
    borderRadius: 8,
    marginVertical: 10,
    alignItems: 'center',
  },
  selectedCountText: {
    fontSize: THEME.SIZES.small,
    fontWeight: '500',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
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
});
