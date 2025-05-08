import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, Platform, Linking } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { THEME } from '@/constants/Theme';
import { ChallengeRequirement } from '@/types';
import { getCurrentLocation } from '@/lib/googleMapsService';
import { isWithinRadius, calculateDistance } from '@/helpers/location.helper';
import { checkinService } from '@/services/checkinService';
import { supabase } from '@/lib/supabase';
import { CONFIG } from '@/constants/Config';

interface ChallengeRequirementItemProps {
  requirement: ChallengeRequirement & {
    progress?: number;
    is_completed?: boolean;
    current_count?: number;
  };
  challengeId?: string;
  onCheckIn?: (requirementId: string) => void;
}

export const ChallengeRequirementItem = ({ requirement, challengeId, onCheckIn }: ChallengeRequirementItemProps) => {
  const [isChecking, setIsChecking] = useState(false);
  
  const getIconName = () => {
    switch (requirement.type) {
      case 'visit_place':
        return 'map-marker-alt';
      case 'take_photo':
        return 'camera';
      case 'check_in':
        return 'check-circle';
      case 'post_content':
        return 'edit';
      case 'visit_category':
        return 'tags';
      case 'rate_place':
        return 'star';
      default:
        return 'tasks';
    }
  };
  
  // Handle check-in to a place
  const handleCheckIn = async () => {
    try {
      setIsChecking(true);
      
      // Step 1: Check if the user is authenticated
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Oturum gerekli', 'Check-in yapmak için önce giriş yapmalısınız.');
        setIsChecking(false);
        return;
      }
      
      // Step 2: Get the user's current location
      const location = await getCurrentLocation();
      if (!location) {
        Alert.alert('Konum alınamadı', 'Konumunuza erişemiyoruz. Lütfen konum servislerinin açık olduğundan emin olun.');
        setIsChecking(false);
        return;
      }
      
      // Step 3: If this is a place-specific requirement, check if user is near the place
      if (requirement.type === 'visit_place' && requirement.target_id) {
        // Get place details from the DB
        const { data: place, error } = await supabase
          .from('places')
          .select('latitude, longitude, name')
          .eq('id', requirement.target_id)
          .single();
          
        if (error || !place) {
          Alert.alert('Yer bilgisi alınamadı', 'Bu yerin konum bilgisini alamadık.');
          setIsChecking(false);
          return;
        }
        
        // Check if place has valid coordinates
        if (!place.latitude || !place.longitude) {
          Alert.alert('Konum bilgisi eksik', 'Bu yer için konum bilgisi eksik veya hatalı.');
          setIsChecking(false);
          return;
        }
        
        // Check if user is within 300 meters of the place
        const isNearPlace = CONFIG.DEBUG_BYPASS_LOCATION_CHECK || isWithinRadius(
          location.latitude, 
          location.longitude, 
          place.latitude, 
          place.longitude, 
          CONFIG.DEFAULT_CHECKIN_RADIUS
        );
        
        if (!isNearPlace) {
          // Calculate the distance for better user feedback
          const distance = Math.floor(calculateDistance(
            location.latitude, 
            location.longitude, 
            place.latitude, 
            place.longitude
          ));
          
          Alert.alert(
            'Check-in başarısız', 
            `${place.name} mekanına check-in yapmak için ${CONFIG.DEFAULT_CHECKIN_RADIUS} metre içerisinde olmalısınız. Şu anda yaklaşık ${distance} metre uzaktasınız.`,
            [
              { 
                text: 'Haritada Göster', 
                onPress: () => {
                  // Open maps with directions
                  const url = Platform.select({
                    ios: `maps://app?daddr=${place.latitude},${place.longitude}`,
                    android: `google.navigation:q=${place.latitude},${place.longitude}`
                  });
                  Linking.openURL(url as string);
                }
              },
              { text: 'Tamam', style: 'cancel' }
            ]
          );
          setIsChecking(false);
          return;
        }
        
        // Proceed with check-in
        const checkInResult = await checkinService.checkInToPlace(
          user.id,
          requirement.target_id,
          { 
            location: { 
              latitude: location.latitude, 
              longitude: location.longitude 
            } 
          }
        );
        
        if (!checkInResult) {
          Alert.alert('Check-in başarısız', 'Check-in işlemi sırasında bir hata oluştu.');
          setIsChecking(false);
          return;
        }
        
        // Get place details for a better success message
        const { data: fullPlace } = await supabase
          .from('places')
          .select('name, points, type')
          .eq('id', requirement.target_id)
          .single();
        
        const pointsEarned = fullPlace?.points || 0;
        
        // Mark requirement as completed
        if (challengeId) {
          await supabase
            .from('user_challenge_progress')
            .upsert({
              user_id: user.id,
              challenge_id: challengeId,
              requirement_id: requirement.id,
              completed: true,
              completed_at: new Date().toISOString(),
            });
        }
        
        // Call the callback to refresh
        if (onCheckIn) {
          onCheckIn(requirement.id);
        }
        
        Alert.alert(
          'Check-in başarılı', 
          `${place.name} mekanına başarıyla check-in yaptınız!\n\n${pointsEarned} puan kazandınız.${challengeId ? '\n\nGörev gereksinimi tamamlandı!' : ''}`,
          [{ text: 'Harika!', style: 'default' }]
        );
      } else {
        // For other requirement types, simply mark as in progress
        Alert.alert('Check-in özelliği', 'Bu gereksinim türü için check-in özelliği henüz desteklenmiyor.');
      }
    } catch (error) {
      console.error('Check-in error:', error);
      Alert.alert('Hata', 'Check-in sırasında bir hata oluştu.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <View style={styles.requirementItem}>
      <View style={styles.iconContainer}>
        <FontAwesome5
          name={getIconName()}
          size={18}
          color={requirement.is_completed ? THEME.COLORS.success : THEME.COLORS.text}
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
                  {
                    width: `${Math.min(100, ((requirement.current_count || 0) / requirement.count) * 100)}%`
                  }
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
        <FontAwesome5 name="check" size={16} color={THEME.COLORS.success} />
      ) : (
        requirement.type === 'visit_place' && requirement.target_id && (
          <TouchableOpacity 
            style={styles.checkInButton}
            onPress={handleCheckIn}
            disabled={isChecking}
          >
            {isChecking ? (
              <ActivityIndicator size="small" color={THEME.COLORS.light} />
            ) : (
              <ThemedText style={styles.checkInButtonText}>
                Check-in
              </ThemedText>
            )}
          </TouchableOpacity>
        )
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: THEME.COLORS.border,
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
  },
  completedText: {
    fontWeight: 'bold',
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  progressBar: {
    flex: 1,
    height: 6,
    backgroundColor: THEME.COLORS.border,
    borderRadius: 3,
    marginRight: 8,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: THEME.COLORS.success,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: THEME.COLORS.textLight,
    width: 40,
    textAlign: 'right',
  },
  checkInButton: {
    backgroundColor: THEME.COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    marginLeft: 8,
  },
  checkInButtonText: {
    color: THEME.COLORS.light,
    fontSize: 12,
    fontWeight: 'bold',
  }
});
