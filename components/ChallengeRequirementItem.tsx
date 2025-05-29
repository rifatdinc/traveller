import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform, Linking } from 'react-native';
import Toast from 'react-native-toast-message';
import { FontAwesome5 } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';

import { ThemedText } from '@/components/ThemedText';
import { Colors } from '@/constants/Colors'; // Assuming Colors is set up for theming
import { useColorScheme } from '@/hooks/useColorScheme'; // Assuming hook for theme
import { ChallengeRequirement } from '@/types';
import { getCurrentLocation } from '@/lib/googleMapsService';
import { isWithinRadius, calculateDistance } from '@/helpers/location.helper';
import { checkinService } from '@/services/checkinService'; // For place-specific check-ins
import { challengesService } from '@/services/challengesService'; // For other requirement types
import { supabase } from '@/lib/supabase';
import { CONFIG } from '@/constants/Config';
import { THEME } from '@/constants/Theme'; // For static colors like success, error

interface ChallengeRequirementItemProps {
  requirement: ChallengeRequirement & {
    progress?: number; // For countable requirements not directly handled by this item
    is_completed?: boolean;
    current_count?: number; // For countable requirements handled by this item
  };
  challengeId: string; // Made mandatory as it's needed for most actions
  onCheckIn: (requirementId: string) => void; // Renamed to onActionComplete for clarity
}

export const ChallengeRequirementItem = ({ requirement, challengeId, onCheckIn: onActionComplete }: ChallengeRequirementItemProps) => {
  const theme = useColorScheme() ?? 'light';
  const [isLoading, setIsLoading] = useState(false);

  const getIconName = () => {
    switch (requirement.type) {
      case 'visit_place': return 'map-marker-alt';
      case 'take_photo': return 'camera';
      case 'check_in': return 'map-pin'; // Generic check-in
      case 'post_content': return 'edit';
      case 'visit_category': return 'tags';
      case 'rate_place': return 'star';
      default: return 'tasks';
    }
  };
  
  const handleRequirementAction = async () => {
    setIsLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      Toast.show({ type: 'error', text1: 'Authentication Error', text2: 'Please login to complete requirements.' });
      setIsLoading(false);
      return;
    }

    try {
      switch (requirement.type) {
        case 'visit_place': // Specific place check-in (existing logic)
          if (!requirement.target_id) {
            Toast.show({ type: 'error', text1: 'Error', text2: 'Target place ID is missing for this requirement.' });
            setIsLoading(false); return;
          }
          // This specific type uses the old checkinService flow as per original code
          // For a full refactor, checkinService.checkInToPlace would also use updateUserChallengeRequirementProgress
          const location = await getCurrentLocation();
          if (!location) {
            Alert.alert('Konum alınamadı', 'Konumunuza erişemiyoruz. Lütfen konum servislerinin açık olduğundan emin olun.');
            setIsLoading(false); return;
          }
          const { data: place, error: placeError } = await supabase.from('places').select('latitude, longitude, name, points').eq('id', requirement.target_id).single();
          if (placeError || !place) { Alert.alert('Yer bilgisi alınamadı', 'Bu yerin konum bilgisini alamadık.'); setIsLoading(false); return; }
          if (!place.latitude || !place.longitude) { Alert.alert('Konum bilgisi eksik', 'Bu yer için konum bilgisi eksik veya hatalı.'); setIsLoading(false); return; }
          
          const isNearPlace = CONFIG.DEBUG_BYPASS_LOCATION_CHECK || isWithinRadius(location.latitude, location.longitude, place.latitude, place.longitude, CONFIG.DEFAULT_CHECKIN_RADIUS);
          if (!isNearPlace) {
            const distance = Math.floor(calculateDistance(location.latitude, location.longitude, place.latitude, place.longitude));
            Alert.alert('Check-in başarısız', `${place.name} mekanına check-in yapmak için ${CONFIG.DEFAULT_CHECKIN_RADIUS}m içerisinde olmalısınız. Şu anda yaklaşık ${distance}m uzaktasınız.`, [{ text: 'Haritada Göster', onPress: () => Linking.openURL(Platform.select({ios: `maps://app?daddr=${place.latitude},${place.longitude}`, android: `google.navigation:q=${place.latitude},${place.longitude}`}) as string)}, { text: 'Tamam', style: 'cancel' }]);
            setIsLoading(false); return;
          }
          
          const checkInResult = await checkinService.checkInToPlace(user.id, requirement.target_id, { location });
          if (!checkInResult) { Toast.show({ type: 'error', text1: 'Check-in Başarısız', text2: 'Check-in işlemi sırasında bir hata oluştu.' }); setIsLoading(false); return; }
          
          // Manually update progress here for visit_place as it uses old service
           await challengesService.updateUserChallengeRequirementProgress(user.id, challengeId, requirement.id, 1, true, { location });

          Toast.show({ type: 'success', text1: 'Check-in Başarılı!', text2: `${place.name} mekanına başarıyla check-in yaptınız. ${place.points || 0} puan kazandınız.`});
          if (onActionComplete) onActionComplete(requirement.id);
          break;

        case 'take_photo':
          const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
          if (permissionResult.granted === false) {
            Toast.show({ type: 'error', text1: 'Permission Denied', text2: 'Photo library access is required!'});
            setIsLoading(false); return;
          }
          const pickerResult = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5 });
          if (pickerResult.canceled || !pickerResult.assets || pickerResult.assets.length === 0) {
            setIsLoading(false); return;
          }
          // For now, just mark as complete and store a placeholder. Actual upload is a separate task.
          await challengesService.updateUserChallengeRequirementProgress(user.id, challengeId, requirement.id, 0, true, { photoUri: pickerResult.assets[0].uri });
          Toast.show({ type: 'success', text1: 'Photo Selected', text2: 'Photo marked for completion.'});
          if (onActionComplete) onActionComplete(requirement.id);
          break;

        case 'check_in': // Generic check-in (no target_id)
          const genericLocation = await getCurrentLocation();
          if (!genericLocation) { Toast.show({ type: 'error', text1: 'Location Error', text2: 'Could not get current location.' }); setIsLoading(false); return; }
          await challengesService.updateUserChallengeRequirementProgress(user.id, challengeId, requirement.id, 0, true, { location: { latitude: genericLocation.latitude, longitude: genericLocation.longitude } });
          Toast.show({ type: 'success', text1: 'Checked-in!', text2: 'Requirement marked as complete.'});
          if (onActionComplete) onActionComplete(requirement.id);
          break;

        case 'post_content':
        case 'rate_place':
        case 'custom':
          await challengesService.updateUserChallengeRequirementProgress(user.id, challengeId, requirement.id, 0, true);
          Toast.show({ type: 'success', text1: 'Requirement Complete!', text2: `'${requirement.description}' marked as complete.`});
          if (onActionComplete) onActionComplete(requirement.id);
          break;
        
        default:
          Toast.show({ type: 'info', text1: 'Info', text2: 'This requirement type does not have a specific action.' });
          setIsLoading(false);
          return; // Do not proceed further if no action defined
      }
    } catch (error: any) {
      console.error('Requirement action error:', error);
      Toast.show({ type: 'error', text1: 'Error', text2: error.message || 'Failed to complete requirement action.' });
    } finally {
      setIsLoading(false);
    }
  };
  
  const styles = getDynamicStyles(theme); // Get styles based on theme

  return (
    <View style={styles.requirementItem}>
      <View style={styles.iconContainer}>
        <FontAwesome5
          name={getIconName()}
          size={18}
          color={requirement.is_completed ? Colors[theme].success : Colors[theme].text}
          solid={requirement.is_completed}
        />
      </View>
      <View style={styles.contentContainer}>
        <ThemedText style={[
          styles.requirementText,
          requirement.is_completed && styles.completedText
        ]}>
          {requirement.description}
        </ThemedText>
        
        {(requirement.count && requirement.count > 1) && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View 
                style={[
                  styles.progressFill, 
                  { width: `${Math.min(100, ((requirement.current_count || 0) / requirement.count) * 100)}%` }
                ]} 
              />
            </View>
            <ThemedText style={styles.progressText}>
              {requirement.current_count || 0}/{requirement.count}
            </ThemedText>
          </View>
        )}
      </View>
      
      {requirement.is_completed ? (
        <FontAwesome5 name="check" size={16} color={Colors[theme].success} />
      ) : (
        (requirement.type === 'visit_place' && requirement.target_id) || 
        requirement.type === 'take_photo' || 
        requirement.type === 'check_in' || // Generic check-in
        requirement.type === 'post_content' || 
        requirement.type === 'rate_place' || 
        requirement.type === 'custom'
         ? (
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={handleRequirementAction}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="small" color={Colors.dark.text} />
            ) : (
              <ThemedText style={styles.actionButtonText}>
                {requirement.type === 'visit_place' ? 'Check-in' : 
                 requirement.type === 'take_photo' ? 'Upload' :
                 requirement.type === 'check_in' ? 'Check-in Here' :
                 'Complete'}
              </ThemedText>
            )}
          </TouchableOpacity>
        ) : null
      )}
    </View>
  );
};

const getDynamicStyles = (theme: 'light' | 'dark') => StyleSheet.create({
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors[theme].border,
  },
  iconContainer: {
    width: 40,
    alignItems: 'center',
  },
  contentContainer: {
    flex: 1,
    marginLeft: 8,
  },
  requirementText: {
    fontSize: 16,
    // color will be handled by ThemedText default
  },
  completedText: {
    fontWeight: 'bold',
    // color will be handled by ThemedText default, can be overridden if needed
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: Colors[theme].border,
    borderRadius: 3,
    marginRight: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors[theme].success, // Using theme's success color
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: Colors[theme].textLight,
    width: 40, // Keep fixed width for alignment
    textAlign: 'right',
  },
  actionButton: { // Renamed from checkInButton for generic use
    backgroundColor: Colors[theme].primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  actionButtonText: { // Renamed from checkInButtonText
    color: Colors.dark.text, // Assuming primary buttons have light text
    fontSize: 12,
    fontWeight: 'bold',
  }
});
