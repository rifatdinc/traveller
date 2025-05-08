import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  FlatList,
  ActivityIndicator
} from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { THEME } from '@/constants/Theme';
import { FontAwesome5 } from '@expo/vector-icons';
import { debounce } from 'lodash';

// List of Turkish cities
const TURKISH_CITIES = [
  'Adana', 'Adıyaman', 'Afyonkarahisar', 'Ağrı', 'Amasya', 'Ankara', 'Antalya', 'Artvin',
  'Aydın', 'Balıkesir', 'Bilecik', 'Bingöl', 'Bitlis', 'Bolu', 'Burdur', 'Bursa', 'Çanakkale',
  'Çankırı', 'Çorum', 'Denizli', 'Diyarbakır', 'Edirne', 'Elazığ', 'Erzincan', 'Erzurum',
  'Eskişehir', 'Gaziantep', 'Giresun', 'Gümüşhane', 'Hakkari', 'Hatay', 'Isparta', 'Mersin',
  'İstanbul', 'İzmir', 'Kars', 'Kastamonu', 'Kayseri', 'Kırklareli', 'Kırşehir', 'Kocaeli',
  'Konya', 'Kütahya', 'Malatya', 'Manisa', 'Kahramanmaraş', 'Mardin', 'Muğla', 'Muş', 'Nevşehir',
  'Niğde', 'Ordu', 'Rize', 'Sakarya', 'Samsun', 'Siirt', 'Sinop', 'Sivas', 'Tekirdağ', 'Tokat',
  'Trabzon', 'Tunceli', 'Şanlıurfa', 'Uşak', 'Van', 'Yozgat', 'Zonguldak', 'Aksaray', 'Bayburt',
  'Karaman', 'Kırıkkale', 'Batman', 'Şırnak', 'Bartın', 'Ardahan', 'Iğdır', 'Yalova', 'Karabük',
  'Kilis', 'Osmaniye', 'Düzce'
];

// Also include some popular European and world cities
const POPULAR_CITIES = [
  'Londra', 'Paris', 'Berlin', 'Madrid', 'Roma', 'Amsterdam', 'Barselona', 'Viyana', 'Atina', 
  'Prag', 'Budapeşte', 'Venedik', 'Milano', 'Brüksel', 'Zürih', 'Münih', 'Kopenhag', 'Stockholm',
  'Oslo', 'Dublin', 'Lizbon', 'New York', 'Dubai', 'Tokyo', 'Moskova', 'Pekin', 'Sydney'
];

// Combine all cities
const ALL_CITIES = [...TURKISH_CITIES, ...POPULAR_CITIES].sort();

// Define props interface for the component
interface CitySelectionModalProps {
  visible: boolean;
  onClose: () => void;
  onSelectCity: (city: string) => void;
  placeholder?: string;
}

export function CitySelectionModal({ 
  visible, 
  onClose, 
  onSelectCity, 
  placeholder 
}: CitySelectionModalProps) {
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [cities, setCities] = useState<string[]>(ALL_CITIES);
  const [loading, setLoading] = useState<boolean>(false);

  // Reset search when modal is opened
  useEffect(() => {
    if (visible) {
      setSearchTerm('');
      setCities(ALL_CITIES);
    }
  }, [visible]);

  // Debounced search function
  const debouncedSearch = debounce((term: string) => {
    setLoading(true);
    
    if (!term || term.length < 2) {
      setCities(ALL_CITIES);
      setLoading(false);
      return;
    }

    const filteredCities = ALL_CITIES.filter(city => 
      city.toLowerCase().includes(term.toLowerCase())
    );
    
    setCities(filteredCities);
    setLoading(false);
  }, 300);

  // Handle search input change
  const handleSearchChange = (text: string) => {
    setSearchTerm(text);
    debouncedSearch(text);
  };

  // Render each city item
  const renderCityItem = ({ item }: { item: string }) => {
    return (
      <TouchableOpacity 
        style={styles.cityItem}
        onPress={() => onSelectCity(item)}
      >
        <FontAwesome5 name="city" size={16} color={THEME.COLORS.gray} style={styles.cityIcon} />
        <ThemedText>{item}</ThemedText>
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
            <ThemedText type="title">Şehir Seçin</ThemedText>
            <TouchableOpacity onPress={onClose}>
              <FontAwesome5 name="times" size={24} color={THEME.COLORS.text} />
            </TouchableOpacity>
          </View>
          
          <View style={styles.searchContainer}>
            <FontAwesome5 name="search" size={16} color={THEME.COLORS.gray} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder={placeholder || "Şehir ara..."}
              value={searchTerm}
              onChangeText={handleSearchChange}
              autoCapitalize="none"
            />
          </View>
          
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={THEME.COLORS.primary} />
              <ThemedText style={styles.loadingText}>Şehirler aranıyor...</ThemedText>
            </View>
          ) : (
            <FlatList
              data={cities}
              renderItem={renderCityItem}
              keyExtractor={(item) => item}
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <FontAwesome5 name="map-marked-alt" size={50} color={THEME.COLORS.gray} />
                  <ThemedText style={styles.emptyText}>
                    Aranan şehir bulunamadı.
                  </ThemedText>
                  <ThemedText style={styles.emptySubtext}>
                    Farklı bir şehir ismi arayabilirsiniz.
                  </ThemedText>
                </View>
              }
              initialNumToRender={20}
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

// Default export
export default CitySelectionModal;

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
  cityIcon: {
    marginRight: 12,
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
  cityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E5E5',
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
