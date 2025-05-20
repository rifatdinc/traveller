import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, Image, TouchableOpacity, ActivityIndicator, Dimensions, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';
import { socialSharingService } from '@/services/socialSharingService'; // Added
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { challengesService } from '@/services/challengesService';
import { ChallengeRequirementItem } from '@/components/ChallengeRequirementItem';
import { THEME } from '@/constants/Theme';
import { Challenge } from '@/types';

const { width } = Dimensions.get('window');
const CONTENT_WIDTH = width - 40;

export default function ChallengeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleShareChallenge = async () => {
    if (challenge) {
      const success = await socialSharingService.shareChallenge(challenge);
      if (!success) {
        Alert.alert('Hata', 'Görev paylaşılırken bir sorun oluştu.');
      }
    } else {
      Alert.alert('Hata', 'Paylaşılacak görev bilgisi bulunamadı.');
    }
  };

  useEffect(() => {
    const loadChallengeAndStatus = async () => {
      if (id) {
        await fetchChallengeDetails();
        // Katılım durumunu kontrol et
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const participation = await challengesService.checkChallengeParticipation(id, user.id);
          setHasJoined(!!participation);
        } catch (err) {
          console.error('Error checking participation:', err);
        }
      }
    };
    
    loadChallengeAndStatus();
  }, [id]);
  
  // Handle refresh after a requirement is completed
  const handleRequirementCompleted = async (requirementId: string) => {
    if (!id) return;
    
    // Refresh challenge details to update requirements status
    await fetchChallengeDetails();
  };

  const fetchChallengeDetails = async () => {
    try {
      setIsLoading(true);
      // Use the enhanced getChallengeById function from challengesService
      const foundChallenge = await challengesService.getChallengeById(id);
      
      if (foundChallenge) {
        setChallenge(foundChallenge);
        setError(null);
      } else {
        setError('Görev bulunamadı');
      }
    } catch (err) {
      setError('Görev detayları yüklenirken bir hata oluştu');
      console.error('Error fetching challenge details:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Format deadline for display
  const formatDeadline = (validUntil: string | undefined, deadline: string | undefined) => {
    if (validUntil) {
      const deadlineDate = new Date(validUntil);
      const now = new Date();
      
      const diffTime = deadlineDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays <= 0) {
        return 'Bugün son gün';
      } else if (diffDays === 1) {
        return '1 gün kaldı';
      } else if (diffDays < 7) {
        return `${diffDays} gün kaldı`;
      } else if (diffDays < 30) {
        const weeks = Math.floor(diffDays / 7);
        return `${weeks} hafta kaldı`;
      } else {
        const months = Math.floor(diffDays / 30);
        return `${months} ay kaldı`;
      }
    }
    
    return deadline || 'Süresiz';
  };

  // Get challenge type
  const getChallengeType = (challenge: Challenge) => {
    const title = challenge.title.toLowerCase();
    const description = challenge.description.toLowerCase();
    
    if (title.includes('doğa') || description.includes('doğa') || 
        title.includes('park') || description.includes('park')) {
      return 'Doğa';
    } else if (title.includes('kültür') || description.includes('kültür') || 
        title.includes('müze') || description.includes('müze') || 
        title.includes('tarihi') || description.includes('tarihi')) {
      return 'Kültür';
    } else if (title.includes('yemek') || description.includes('yemek') || 
        title.includes('restoran') || description.includes('restoran') ||
        title.includes('lezzet') || description.includes('lezzet')) {
      return 'Gastronomi';
    } else if (title.includes('macera') || description.includes('macera') || 
        title.includes('ekstrem') || description.includes('ekstrem')) {
      return 'Macera';
    }
    
    return 'Genel';
  };

  const handleJoinChallenge = async () => {
    try {
      setIsJoining(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Hata', 'Giriş yapmanız gerekiyor');
        router.push('/auth/login');
        return;
      }
      
      if (hasJoined) {
        // Leave challenge
        await challengesService.leaveChallenge(challenge!.id, user.id);
        setHasJoined(false);
        Alert.alert('Başarılı', 'Görevden ayrıldınız');
      } else {
        // Join challenge
        await challengesService.joinChallenge(user.id, challenge!.id);
        setHasJoined(true);
        Alert.alert('Başarılı', 'Göreve katıldınız! Görev gereksinimlerini tamamlayarak puanları kazanabilirsiniz.');
      }
    } catch (err) {
      console.error('Error joining/leaving challenge:', err);
      Alert.alert('Hata', 'Bir sorun oluştu. Lütfen tekrar deneyin.');
    } finally {
      setIsJoining(false);
    }
  };

  // Show loading spinner
  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen 
          options={{
            title: 'Görev Detayı',
            headerShadowVisible: false,
            headerStyle: {
              backgroundColor: THEME.COLORS.background,
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 0,
            },
          }}
        />
        <StatusBar style="auto" />
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={THEME.COLORS.primary} />
            <ThemedText style={styles.loadingText}>Görev Detayları Yükleniyor...</ThemedText>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Show error message
  if (error || !challenge) {
    return (
      <View style={styles.container}>
        <Stack.Screen 
          options={{
            title: 'Görev Detayı',
            headerShadowVisible: false,
            headerStyle: {
              backgroundColor: THEME.COLORS.background,
              elevation: 0,
              shadowOpacity: 0,
              borderBottomWidth: 0,
            },
          }}
        />
        <StatusBar style="auto" />
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
          <View style={styles.errorContainer}>
            <FontAwesome5 name="exclamation-circle" size={50} color={THEME.COLORS.error} />
            <ThemedText style={styles.errorText}>
              {error || 'Görev bilgileri bulunamadı'}
            </ThemedText>
            <TouchableOpacity style={styles.returnButton} onPress={() => router.back()}>
              <ThemedText style={styles.returnButtonText}>Geri Dön</ThemedText>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  // Show challenge details
  return (
    <View style={styles.container}>
      <Stack.Screen 
        options={{
          title: challenge.title,
          headerShadowVisible: false,
          headerStyle: {
            backgroundColor: THEME.COLORS.background,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 0,
          },
        }}
      />
      <StatusBar style="auto" />
      
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Hero image */}
        <Image 
          source={{ uri: challenge.image_url || challenge.image || 'https://images.unsplash.com/photo-1466781783364-36c955e42a7f' }} 
          style={styles.heroImage}
          contentFit="cover"
        />
          
        {/* Badge positioning */}
        <View style={styles.badgeContainer}>
          <View style={styles.typeBadge}>
            <ThemedText style={styles.typeBadgeText}>
              {challenge.category ? challenge.category.charAt(0).toUpperCase() + challenge.category.slice(1) : getChallengeType(challenge)}
            </ThemedText>
          </View>
        </View>
        
        <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
          {/* Challenge Title and Points */}
          <View style={styles.titleContainer}>
            <ThemedText style={styles.title}>{challenge.title}</ThemedText>
            <View style={styles.pointsContainer}>
              <FontAwesome5 name="star" size={18} color={THEME.COLORS.accent} />
              <ThemedText style={styles.points}>{challenge.points} Puan</ThemedText>
            </View>
          </View>
          
          {/* Timing and Participants */}
          <View style={styles.metaContainer}>
            <View style={styles.metaItem}>
              <FontAwesome5 name="clock" size={16} color={THEME.COLORS.primary} />
              <ThemedText style={styles.metaText}>
                {formatDeadline(challenge.valid_until, challenge.deadline)}
              </ThemedText>
            </View>
            
            <View style={styles.metaSeparator} />
            
            <View style={styles.metaItem}>
              <FontAwesome5 name="users" size={16} color={THEME.COLORS.primary} />
              <ThemedText style={styles.metaText}>
                {challenge.participation_count || 0} Katılımcı
              </ThemedText>
            </View>
          </View>
          
          {/* Challenge Description */}
          <ThemedView style={styles.descriptionContainer}>
            <ThemedText style={styles.sectionTitle}>Görev Açıklaması</ThemedText>
            <ThemedText style={styles.description}>{challenge.description}</ThemedText>
          </ThemedView>
          
          {/* Requirements */}
          <ThemedView style={styles.requirementsContainer}>
            <ThemedText style={styles.sectionTitle}>Görev Gereklilikleri</ThemedText>
            
            {challenge.requirements && challenge.requirements.length > 0 ? (
              challenge.requirements.map((req, index) => (
                <ChallengeRequirementItem 
                  key={req.id || index} 
                  requirement={req} 
                  challengeId={challenge.id}
                  onCheckIn={handleRequirementCompleted}
                />
              ))
            ) : (
              <ThemedText style={styles.emptyStateText}>
                Bu görev için gereksinimler belirtilmemiş.
              </ThemedText>
            )}
          </ThemedView>
          
          {/* Participation */}
          <ThemedView style={styles.participationContainer}>
            <ThemedText style={styles.sectionTitle}>Katılım Durumu</ThemedText>
            
            <View style={styles.statusContainer}>
              <FontAwesome5 
                name={hasJoined ? "check-circle" : "info-circle"} 
                size={20} 
                color={hasJoined ? THEME.COLORS.success : THEME.COLORS.info} 
                solid={hasJoined}
              />
              <ThemedText style={styles.statusText}>
                {hasJoined 
                  ? 'Bu göreve katıldınız! Görevi tamamlamak için gereklilikleri yerine getirin.'
                  : 'Bu göreve henüz katılmadınız. Göreve katılmak için aşağıdaki butona tıklayın.'}
              </ThemedText>
            </View>
          </ThemedView>
        </SafeAreaView>
      </ScrollView>
      
      {/* Bottom buttons with SafeArea */}
      <SafeAreaView style={styles.bottomSafeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.buttonsContainer}>
          <TouchableOpacity 
            style={[
              styles.participateButton,
              hasJoined && styles.leaveButton
            ]} 
            onPress={handleJoinChallenge} 
            disabled={isJoining}
          >
            {isJoining ? (
              <ActivityIndicator color={THEME.COLORS.light} />
            ) : (
              <>
                <FontAwesome5 
                  name={hasJoined ? "times" : "play"} 
                  size={16} 
                  color={THEME.COLORS.light} 
                />
                <ThemedText style={styles.participateButtonText}>
                  {hasJoined ? 'Görevden Ayrıl' : 'Göreve Katıl'}
                </ThemedText>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      
      <TouchableOpacity style={styles.shareButtonFloat} onPress={handleShareChallenge}>
        <FontAwesome5 name="share-alt" size={20} color={THEME.COLORS.light} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.COLORS.background,
  },
  safeArea: {
    backgroundColor: THEME.COLORS.background,
  },
  bottomSafeArea: {
    backgroundColor: THEME.COLORS.background,
    borderTopWidth: 1,
    borderTopColor: THEME.COLORS.border,
    ...THEME.SHADOWS.medium,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 15,
    fontSize: THEME.SIZES.medium,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorText: {
    marginTop: 15,
    marginBottom: 20,
    fontSize: THEME.SIZES.medium,
    textAlign: 'center',
  },
  returnButton: {
    backgroundColor: THEME.COLORS.primary,
    paddingHorizontal: 25,
    paddingVertical: 12,
    borderRadius: 10,
  },
  returnButtonText: {
    color: THEME.COLORS.light,
    fontWeight: 'bold',
    fontSize: THEME.SIZES.medium,
  },
  scrollContent: {
    paddingBottom: 100, // Space for bottom buttons
  },
  heroImage: {
    width: width,
    height: width * 0.65,
    marginTop: 0,
  },
  badgeContainer: {
    position: 'absolute',
    top: width * 0.65 - 30,
    left: 15,
    zIndex: 5,
  },
  typeBadge: {
    backgroundColor: THEME.COLORS.info,
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 20,
    ...THEME.SHADOWS.small,
  },
  typeBadgeText: {
    color: THEME.COLORS.light,
    fontWeight: 'bold',
    fontSize: THEME.SIZES.small,
  },
  titleContainer: {
    padding: 20,
    paddingTop: 15,
    paddingBottom: 15,
  },
  title: {
    fontSize: THEME.SIZES.xlarge,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  points: {
    marginLeft: 8,
    fontSize: THEME.SIZES.medium,
    fontWeight: 'bold',
    color: THEME.COLORS.accent,
  },
  metaContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  metaSeparator: {
    width: 1,
    height: 20,
    backgroundColor: THEME.COLORS.border,
    marginHorizontal: 15,
  },
  metaText: {
    marginLeft: 8,
    fontSize: THEME.SIZES.medium,
    color: THEME.COLORS.gray,
  },
  descriptionContainer: {
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    ...THEME.SHADOWS.small,
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
  requirementsContainer: {
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    ...THEME.SHADOWS.small,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  requirementText: {
    marginLeft: 10,
    fontSize: THEME.SIZES.medium,
  },
  requirementContent: {
    flex: 1,
    marginLeft: 10,
  },
  requirementIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: THEME.COLORS.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  requirementProgress: {
    fontSize: THEME.SIZES.small,
    color: THEME.COLORS.gray,
    marginTop: 2,
  },
  participationContainer: {
    marginHorizontal: 20,
    padding: 15,
    borderRadius: 10,
    marginBottom: 25,
    ...THEME.SHADOWS.small,
  },
  participationInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  participationText: {
    marginLeft: 10,
    fontSize: THEME.SIZES.medium,
    color: THEME.COLORS.gray,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: THEME.COLORS.info + '20',
    padding: 10,
    borderRadius: 8,
  },
  statusText: {
    marginLeft: 10,
    flex: 1,
    fontSize: THEME.SIZES.medium,
  },
  buttonsContainer: {
    padding: 20,
    paddingBottom: 20,
  },
  participateButton: {
    backgroundColor: THEME.COLORS.primary,
    borderRadius: 15,
    paddingVertical: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.SHADOWS.small,
  },
  participateButtonText: {
    color: THEME.COLORS.light,
    fontWeight: 'bold',
    fontSize: THEME.SIZES.medium,
    marginLeft: 8,
  },
  shareButtonFloat: {
    position: 'absolute',
    bottom: 110,
    right: 20,
    backgroundColor: THEME.COLORS.accent,
    width: 50,
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    ...THEME.SHADOWS.medium,
    zIndex: 10,
  },
  leaveButton: {
    backgroundColor: THEME.COLORS.error,
  },
  emptyStateText: {
    fontSize: THEME.SIZES.medium,
    color: THEME.COLORS.gray,
    textAlign: 'center',
    marginVertical: 10,
  },
  requirementsTitle: {
    fontSize: THEME.SIZES.large,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  joinButton: {
    backgroundColor: THEME.COLORS.primary,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 15,
    ...THEME.SHADOWS.small,
  },
  joinedButton: {
    backgroundColor: THEME.COLORS.error,
  },
  joinButtonText: {
    color: THEME.COLORS.light,
    fontSize: THEME.SIZES.medium,
  },
  emptyText: {
    fontSize: THEME.SIZES.medium,
    color: THEME.COLORS.gray,
    textAlign: 'center',
    marginVertical: 10,
  },
});
