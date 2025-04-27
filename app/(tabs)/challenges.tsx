import React, { useState, useEffect, useCallback } from 'react';
import { StyleSheet, View, ScrollView, TouchableOpacity, Image, Dimensions, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { router } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { challengesService } from '@/services/challengesService';
import { THEME } from '@/constants/Theme';
import { Challenge } from '@/types';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width - 40;

const categories = [
  { id: 'all', name: 'Tümü' },
  { id: 'nature', name: 'Doğa' },
  { id: 'culture', name: 'Kültür' },
  { id: 'gastronomy', name: 'Gastronomi' },
  { id: 'adventure', name: 'Macera' },
];

export default function ChallengesScreen() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchChallenges();
  }, []);

  const fetchChallenges = async () => {
    try {
      setIsLoading(true);
      const data = await challengesService.getAllChallenges();
      setChallenges(data);
      setError(null);
    } catch (err) {
      setError('Görevler yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
      console.error('Error fetching challenges:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Pull-to-refresh işlemi - sadece görev verilerini yeniler, header etkilenmez
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    
    try {
      // Sadece görev verilerini yeniliyoruz, header verilerini değil
      const data = await challengesService.getAllChallenges();
      if (data) {
        setChallenges(data);
        setError(null);
      }
    } catch (err) {
      setError('Görevler yüklenirken bir hata oluştu. Lütfen tekrar deneyin.');
      console.error('Error refreshing challenges:', err);
    } finally {
      setRefreshing(false);
    }
  }, [activeCategory]);

  // Get challenge type based on categories
  const getChallengeType = (challenge: Challenge) => {
    // In mock data, there was a 'type' field, but in our type definition we don't have it
    // Let's check if there's a property that indicates type, or default to a category based on title/description
    
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

  // Format deadline for display
  const formatDeadline = (validUntil: string | undefined) => {
    if (!validUntil) return 'Süresiz';
    
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
  };

  // Filter challenges based on category
  const filteredChallenges = challenges.filter(challenge => 
    activeCategory === 'all' || 
    (activeCategory === 'nature' && getChallengeType(challenge) === 'Doğa') ||
    (activeCategory === 'culture' && getChallengeType(challenge) === 'Kültür') ||
    (activeCategory === 'gastronomy' && getChallengeType(challenge) === 'Gastronomi') ||
    (activeCategory === 'adventure' && getChallengeType(challenge) === 'Macera')
  );

  // Show loading indicator while fetching data
  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={THEME.COLORS.primary} />
          <ThemedText style={styles.loadingText}>Görevler Yükleniyor...</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  // Show error if there's an issue fetching data
  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar style="auto" />
        <View style={styles.errorContainer}>
          <FontAwesome5 name="exclamation-circle" size={50} color={THEME.COLORS.error} />
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity style={styles.retryButton} onPress={fetchChallenges}>
            <ThemedText style={styles.retryButtonText}>Tekrar Dene</ThemedText>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header */}
      <View style={styles.header}>
        <ThemedText style={styles.title}>Görevler</ThemedText>
      </View>
      
      {/* Categories */}
      <View style={styles.categoriesContainer}>
        <ScrollView 
          horizontal 
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesList}
        >
          {categories.map(category => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryItem,
                activeCategory === category.id && styles.activeCategoryItem
              ]}
              onPress={() => setActiveCategory(category.id)}
            >
              <ThemedText 
                style={[
                  styles.categoryText,
                  activeCategory === category.id && styles.activeCategoryText
                ]}
              >
                {category.name}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
      
      {/* Achievement Progress */}
      <ThemedView style={styles.progressContainer}>
        <View style={styles.progressHeader}>
          <ThemedText style={styles.progressTitle}>Görev İlerlemen</ThemedText>
          <TouchableOpacity>
            <ThemedText style={styles.seeAllText}>Tümünü Gör</ThemedText>
          </TouchableOpacity>
        </View>
        
        <View style={styles.progressBar}>
          <View style={styles.progressFill} />
        </View>
        
        <View style={styles.progressStats}>
          <ThemedText style={styles.progressText}>2/5 Görev Tamamlandı</ThemedText>
          <ThemedText style={styles.bonusPoints}>+1000 Bonus Puan</ThemedText>
        </View>
      </ThemedView>
      
      {/* Challenges List */}
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.challengesList}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        <ThemedText style={styles.sectionTitle}>
          {activeCategory === 'all' ? 'Aktif Görevler' : `${categories.find(c => c.id === activeCategory)?.name} Görevleri`}
        </ThemedText>
        
        {filteredChallenges.length === 0 ? (
          <View style={styles.emptyState}>
            <FontAwesome5 name="tasks" size={40} color={THEME.COLORS.gray} />
            <ThemedText style={styles.emptyStateText}>Bu kategoride görev bulunamadı</ThemedText>
          </View>
        ) : (
          filteredChallenges.map(challenge => (
            <TouchableOpacity 
              key={challenge.id} 
              style={styles.challengeCard}
              onPress={() => router.push(`/challenge/${challenge.id}` as any)}
            >
              <Image 
                source={{ uri: challenge.image_url || challenge.image }}
                style={styles.challengeImage}
                resizeMode="cover"
              />
              <View style={styles.challengeContent}>
                <View style={styles.challengeHeader}>
                  <View style={styles.challengeTag}>
                    <ThemedText style={styles.challengeTagText}>{getChallengeType(challenge)}</ThemedText>
                  </View>
                  <View style={styles.challengeDeadline}>
                    <FontAwesome5 name="clock" size={12} color={THEME.COLORS.primary} />
                    <ThemedText style={styles.challengeDeadlineText}>
                      {formatDeadline(challenge.valid_until) || challenge.deadline}
                    </ThemedText>
                  </View>
                </View>
                
                <ThemedText style={styles.challengeTitle}>{challenge.title}</ThemedText>
                <ThemedText style={styles.challengeDescription}>{challenge.description}</ThemedText>
                
                <View style={styles.challengeFooter}>
                  <View style={styles.challengePoints}>
                    <FontAwesome5 name="star" size={16} color={THEME.COLORS.accent} />
                    <ThemedText style={styles.challengePointsText}>{challenge.points} Puan</ThemedText>
                  </View>
                  
                  <View style={styles.challengeParticipants}>
                    <FontAwesome5 name="users" size={14} color={THEME.COLORS.gray} />
                    <ThemedText style={styles.challengeParticipantsText}>
                      {challenge.participation_count || 0} Katılımcı
                    </ThemedText>
                  </View>
                </View>
                
                <TouchableOpacity style={styles.joinButton}>
                  <ThemedText style={styles.joinButtonText}>Göreve Katıl</ThemedText>
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          ))
        )}
        
        {/* Community Challenges Section */}
        <ThemedText style={[styles.sectionTitle, { marginTop: 20 }]}>
          Topluluk Görevleri
        </ThemedText>
        
        <TouchableOpacity style={styles.communityCard}>
          <View style={styles.communityCardContent}>
            <FontAwesome5 name="users" size={24} color={THEME.COLORS.secondary} />
            <ThemedText style={styles.communityCardTitle}>Grup Görevleri</ThemedText>
            <ThemedText style={styles.communityCardDescription}>
              Arkadaşlarınla birlikte görevlere katıl ve ekstra puanlar kazan!
            </ThemedText>
            <View style={styles.communityCardFooter}>
              <ThemedText style={styles.communityCardStats}>5 aktif görev</ThemedText>
              <FontAwesome5 name="arrow-right" size={16} color={THEME.COLORS.primary} />
            </View>
          </View>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.communityCard}>
          <View style={styles.communityCardContent}>
            <FontAwesome5 name="medal" size={24} color={THEME.COLORS.accent} />
            <ThemedText style={styles.communityCardTitle}>Haftalık Yarışma</ThemedText>
            <ThemedText style={styles.communityCardDescription}>
              Bu haftanın en aktif gezginleri arasına gir, özel ödüller kazan!
            </ThemedText>
            <View style={styles.communityCardFooter}>
              <ThemedText style={styles.communityCardStats}>3 gün kaldı</ThemedText>
              <FontAwesome5 name="arrow-right" size={16} color={THEME.COLORS.primary} />
            </View>
          </View>
        </TouchableOpacity>
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
  },
  errorText: {
    marginTop: 10,
    fontSize: THEME.SIZES.medium,
    textAlign: 'center',
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: THEME.COLORS.primary,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 10,
  },
  retryButtonText: {
    color: THEME.COLORS.light,
    fontWeight: 'bold',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 30,
  },
  emptyStateText: {
    marginTop: 10,
    fontSize: THEME.SIZES.medium,
    color: THEME.COLORS.gray,
    textAlign: 'center',
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
  categoriesContainer: {
    marginBottom: 15,
  },
  categoriesList: {
    paddingHorizontal: 15,
  },
  categoryItem: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginHorizontal: 5,
    backgroundColor: THEME.COLORS.card,
    borderRadius: 20,
    ...THEME.SHADOWS.small,
  },
  activeCategoryItem: {
    backgroundColor: THEME.COLORS.primary,
  },
  categoryText: {
    fontSize: THEME.SIZES.small,
    fontWeight: 'bold',
  },
  activeCategoryText: {
    color: THEME.COLORS.light,
  },
  progressContainer: {
    margin: 20,
    padding: 15,
    borderRadius: 15,
    ...THEME.SHADOWS.small,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  progressTitle: {
    fontSize: THEME.SIZES.medium,
    fontWeight: 'bold',
  },
  seeAllText: {
    color: THEME.COLORS.primary,
    fontWeight: 'bold',
    fontSize: THEME.SIZES.small,
  },
  progressBar: {
    height: 8,
    backgroundColor: THEME.COLORS.border,
    borderRadius: 4,
    marginBottom: 10,
  },
  progressFill: {
    width: '40%', // 2 out of 5 tasks completed
    height: '100%',
    backgroundColor: THEME.COLORS.success,
    borderRadius: 4,
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressText: {
    fontSize: THEME.SIZES.small,
  },
  bonusPoints: {
    fontSize: THEME.SIZES.small,
    color: THEME.COLORS.accent,
    fontWeight: 'bold',
  },
  challengesList: {
    padding: 20,
    paddingTop: 0,
  },
  sectionTitle: {
    fontSize: THEME.SIZES.large,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  challengeCard: {
    width: CARD_WIDTH,
    borderRadius: 15,
    backgroundColor: THEME.COLORS.card,
    marginBottom: 20,
    overflow: 'hidden',
    ...THEME.SHADOWS.medium,
  },
  challengeImage: {
    width: '100%',
    height: 150,
  },
  challengeContent: {
    padding: 15,
  },
  challengeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  challengeTag: {
    backgroundColor: THEME.COLORS.info,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 10,
  },
  challengeTagText: {
    color: THEME.COLORS.light,
    fontSize: THEME.SIZES.small,
    fontWeight: 'bold',
  },
  challengeDeadline: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  challengeDeadlineText: {
    marginLeft: 5,
    fontSize: THEME.SIZES.small,
    color: THEME.COLORS.gray,
  },
  challengeTitle: {
    fontSize: THEME.SIZES.large,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  challengeDescription: {
    fontSize: THEME.SIZES.medium,
    color: THEME.COLORS.gray,
    marginBottom: 15,
  },
  challengeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  challengePoints: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  challengePointsText: {
    marginLeft: 5,
    fontSize: THEME.SIZES.medium,
    color: THEME.COLORS.accent,
    fontWeight: 'bold',
  },
  challengeParticipants: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  challengeParticipantsText: {
    marginLeft: 5,
    fontSize: THEME.SIZES.small,
    color: THEME.COLORS.gray,
  },
  joinButton: {
    backgroundColor: THEME.COLORS.primary,
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  joinButtonText: {
    color: THEME.COLORS.light,
    fontWeight: 'bold',
    fontSize: THEME.SIZES.medium,
  },
  communityCard: {
    width: CARD_WIDTH,
    borderRadius: 15,
    backgroundColor: THEME.COLORS.card,
    marginBottom: 20,
    ...THEME.SHADOWS.small,
  },
  communityCardContent: {
    padding: 20,
  },
  communityCardTitle: {
    fontSize: THEME.SIZES.large,
    fontWeight: 'bold',
    marginTop: 10,
    marginBottom: 5,
  },
  communityCardDescription: {
    fontSize: THEME.SIZES.medium,
    color: THEME.COLORS.gray,
    marginBottom: 15,
  },
  communityCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  communityCardStats: {
    fontSize: THEME.SIZES.medium,
    color: THEME.COLORS.primary,
    fontWeight: 'bold',
  },
});
