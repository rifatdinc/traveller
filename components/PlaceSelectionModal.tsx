import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator,
  Image
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { THEME } from '@/constants/Theme';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { debounce } from 'lodash';
import * as Location from 'expo-location';

export function PlaceSelectionModal({ visible, onClose, onSelectPlace }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [places, setPlaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyPlaces, setNearbyPlaces] = useState([]);
  const [userLocation, setUserLocation] = useState(null);

  useEffect(() => {
    if (visible) {
      fetchNearbyPlaces();
    }
  }, [visible]);

  // Get the user's current location
  const fetchNearbyPlaces = async () => {
    setNearbyLoading(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        console.log('Permission to access location was denied');
        setNearbyLoading(false);
        return;
      }

      const location = await Location.getCurrentPositionAsync({});
      setUserLocation({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude
      });

      // Fetch places near the user's location
      const { data, error } = await supabase.rpc('nearby_places', {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        radius: 10000 // 10km radius
      });

      if (error) {
        throw error;
      }

      setNearbyPlaces(data || []);
    } catch (error) {
      console.error('Error fetching nearby places:', error);
    } finally {
      setNearbyLoading(false);
    }
  };

  // Debounced search function
  const debouncedSearch = debounce(async (term) => {
    if (!term || term.length < 2) {
      setPlaces([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('places')
        .select('*')
        .ilike('name', `%${term}%`)
        .limit(10);

      if (error) {
        throw error;
      }

      setPlaces(data || []);
    } catch (error) {
      console.error('Error searching places:', error);
    } finally {
      setLoading(false);
    }
  }, 500);

  // Handle search input change
  const handleSearchChange = (text) => {
    setSearchTerm(text);
    if (text.length >= 2) {
      setLoading(true);
      debouncedSearch(text);
    } else {
      setPlaces([]);
    }
  };

  // Calculate distance between two coordinates
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // Earth's radius in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = R * c; // Distance in km
    return distance.toFixed(1);
  };

  const deg2rad = (deg) => {
    return deg * (Math.PI / 180);
  };

  // Render each place item
  const renderPlaceItem = ({ item }) => {
    const distance = userLocation
      ? calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          item.latitude,
          item.longitude
        )
      : null;

    return (
      <TouchableOpacity 
        style={styles.placeItem}
        onPress={() => onSelectPlace(item)}
      >
        <Image 
          source={{ uri: item.image_url || 'https://via.placeholder.com/60' }} 
          style={styles.placeImage} 
        />
        <View style={styles.placeInfo}>
          <ThemedText type="subtitle">{item.name}</ThemedText>
          <ThemedText style={styles.placeType}>{item.type}</ThemedText>
          <View style={styles.placeDetails}>
            <ThemedText style={styles.placeLocation}>
              <FontAwesome5 name="map-marker-alt" size={12} /> {item.city}
            </ThemedText>
            {distance && (
              <ThemedText style={styles.placeDistance}>
                <FontAwesome5 name="walking" size={12} /> {distance} km
              </ThemedText>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <ThemedText type="title">Yer Seçin</ThemedText>
            <TouchableOpacity onPress={onClose}>
              <FontAwesome5 name="times" size={24} color={THEME.COLORS.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <FontAwesome5 name="search" size={16} color={THEME.COLORS.gray} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="Yer adı ara..."
              value={searchTerm}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
            />
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={THEME.COLORS.primary} />
              <ThemedText style={styles.loadingText}>Yerler aranıyor...</ThemedText>
            </View>
          ) : (
            <FlatList
              data={places.length > 0 ? places : nearbyPlaces}
              renderItem={renderPlaceItem}
              keyExtractor={item => item.id}
              ListHeaderComponent={
                places.length === 0 && (
                  <View style={styles.sectionHeader}>
                    <ThemedText type="subtitle">
                      {nearbyLoading ? 'Yakınlardaki yerler bulunuyor...' : 'Yakınlardaki Yerler'}
                    </ThemedText>
                  </View>
                )
              }
              ListEmptyComponent={
                nearbyLoading ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={THEME.COLORS.primary} />
                    <ThemedText style={styles.loadingText}>Yakınlardaki yerler yükleniyor...</ThemedText>
                  </View>
                ) : (
                  <View style={styles.emptyContainer}>
                    <FontAwesome5 name="map-marked-alt" size={50} color={THEME.COLORS.gray} />
                    <ThemedText style={styles.emptyText}>
                      Yakınlarda yer bulunamadı.
                    </ThemedText>
                    <ThemedText style={styles.emptySubtext}>
                      Başka bir konum arayabilir veya daha sonra tekrar deneyebilirsiniz.
                    </ThemedText>
                  </View>
                )
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// Default export ekle
export default PlaceSelectionModal;

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: THEME.COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    height: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    paddingHorizontal: 12,
    marginBottom: 16,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    height: 50,
    fontSize: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: THEME.COLORS.gray,
  },
  sectionHeader: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
    marginBottom: 8,
  },
  placeItem: {
    flexDirection: 'row',
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
  },
  placeImage: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginRight: 12,
  },
  placeInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  placeType: {
    fontSize: 14,
    color: THEME.COLORS.gray,
    marginTop: 2,
  },
  placeDetails: {
    flexDirection: 'row',
    marginTop: 6,
    alignItems: 'center',
  },
  placeLocation: {
    fontSize: 12,
    color: THEME.COLORS.gray,
    marginRight: 12,
  },
  placeDistance: {
    fontSize: 12,
    color: THEME.COLORS.gray,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    marginTop: 16,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: 14,
    marginTop: 8,
    textAlign: 'center',
    color: THEME.COLORS.gray,
  },
});
