import React, { useEffect, useState } from 'react';
import { StyleSheet, View, ScrollView, Image, TouchableOpacity, ActivityIndicator, Dimensions, Alert, Share, Platform, RefreshControl } from 'react-native';
import Toast from 'react-native-toast-message';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { Stack, useLocalSearchParams, router } from 'expo-router';
import { FontAwesome5 } from '@expo/vector-icons';
import { supabase } from '@/lib/supabase';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ChallengeRequirementItem } from '@/components/ChallengeRequirementItem';
import { Challenge } from '@/types';
import { challengesService } from '@/services/challengesService';

import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { THEME } from '@/constants/Theme'; // For static colors like error, success

const { width } = Dimensions.get('window');

export default function ChallengeDetailScreen() {
  const theme = useColorScheme() ?? 'light';
  const styles = getDynamicStyles(theme);

  const { id } = useLocalSearchParams<{ id: string }>();
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [hasJoined, setHasJoined] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const loadChallengeAndStatus = async () => {
      if (id) {
        await fetchChallengeDetails();
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

  const handleRequirementCompleted = async (requirementId: string) => {
    if (!id) return;
    await fetchChallengeDetails();
  };

  const fetchChallengeDetails = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      const foundChallenge = await challengesService.getChallengeDetails(id, userId);
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

  const formatDeadline = (validUntil: string | undefined, deadline: string | undefined) => {
    if (validUntil) {
      const deadlineDate = new Date(validUntil);
      const now = new Date();
      const diffTime = deadlineDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays <= 0) return 'Bugün son gün';
      if (diffDays === 1) return '1 gün kaldı';
      if (diffDays < 7) return `${diffDays} gün kaldı`;
      if (diffDays < 30) return `${Math.floor(diffDays / 7)} hafta kaldı`;
      return `${Math.floor(diffDays / 30)} ay kaldı`;
    }
    return deadline || 'Süresiz';
  };

  const getChallengeType = (challengeData: Challenge) => {
    const title = challengeData.title.toLowerCase();
    const description = challengeData.description.toLowerCase();
    if (title.includes('doğa') || description.includes('doğa') || title.includes('park') || description.includes('park')) return 'Doğa';
    if (title.includes('kültür') || description.includes('kültür') || title.includes('müze') || description.includes('müze') || title.includes('tarihi') || description.includes('tarihi')) return 'Kültür';
    if (title.includes('yemek') || description.includes('yemek') || title.includes('restoran') || description.includes('restoran') || title.includes('lezzet') || description.includes('lezzet')) return 'Gastronomi';
    if (title.includes('macera') || description.includes('macera') || title.includes('ekstrem') || description.includes('ekstrem')) return 'Macera';
    return 'Genel';
  };

  const handleJoinChallenge = async () => {
    if (!challenge) return;
    try {
      setIsJoining(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { 
        Toast.show({ type: 'error', text1: 'Giriş Gerekli', text2: 'Bu işlemi yapabilmek için giriş yapmalısınız.' });
        router.push('/auth/login'); 
        return; 
      }
      if (hasJoined) {
        await challengesService.leaveChallenge(challenge.id, user.id);
        setHasJoined(false); 
        Toast.show({ type: 'success', text1: 'Başarılı', text2: 'Görevden ayrıldınız.' });
      } else {
        await challengesService.joinChallenge(user.id, challenge.id);
        setHasJoined(true); 
        Toast.show({ type: 'success', text1: 'Başarılı!', text2: 'Göreve katıldınız. Gereksinimleri tamamlayarak puanları kazanabilirsiniz.' });
        await fetchChallengeDetails(); // Refresh details to get requirement progress
      }
    } catch (err) {
      console.error('Error joining/leaving challenge:', err);
      Toast.show({ type: 'error', text1: 'Hata', text2: 'Bir sorun oluştu. Lütfen tekrar deneyin.' });
    } finally {
      setIsJoining(false);
    }
  };

  const handleShareChallenge = async () => {
    if (!challenge) { 
      Toast.show({ type: 'info', text1: 'Bekleyin', text2: 'Görev bilgileri henüz yüklenmedi.'});
      return; 
    }
    try {
      const result = await Share.share({
        message: `TravelPoints uygulamasındaki bu harika göreve göz at: "${challenge.title}"! Bence seveceksin.`,
        title: `Görevi Paylaş: ${challenge.title}`
      });
      if (result.action === Share.sharedAction) {
        Toast.show({type: 'success', text1: 'Paylaşıldı!', text2: `"${challenge.title}" görevi paylaşıldı.`});
      } else if (result.action === Share.dismissedAction) {
        console.log('Paylaşım ekranı kapatıldı');
      }
    } catch (error: any) {
      Toast.show({ type: 'error', text1: 'Paylaşım Hatası', text2: 'Görev paylaşılırken bir sorun oluştu.' });
      console.error('Görev paylaşma hatası:', error.message);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Görev Detayı', headerShadowVisible: false, headerStyle: styles.headerStyle }} />
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors[theme].primary} />
            <ThemedText style={[styles.loadingText, { color: Colors[theme].primary }]}>Görev Detayları Yükleniyor...</ThemedText>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  if (error || !challenge) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={{ title: 'Görev Detayı', headerShadowVisible: false, headerStyle: styles.headerStyle }} />
        <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
        <SafeAreaView style={styles.safeArea} edges={['bottom', 'left', 'right']}>
          <View style={styles.errorContainer}>
            <FontAwesome5 name="exclamation-circle" size={50} color={THEME.COLORS.error} />
            <ThemedText style={styles.errorText}>{error || 'Görev bilgileri bulunamadı'}</ThemedText>
            <TouchableOpacity style={styles.returnButton} onPress={() => router.back()}>
              <ThemedText style={styles.returnButtonText}>Geri Dön</ThemedText>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: challenge.title, headerShadowVisible: false, headerStyle: styles.headerStyle }} />
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
      <ScrollView 
        showsVerticalScrollIndicator={false} 
        contentContainerStyle={styles.scrollContent} 
        refreshControl={
          <RefreshControl 
            refreshing={refreshing} 
            onRefresh={fetchChallengeDetails} 
            tintColor={Colors[theme].primary} 
            colors={[Colors[theme].primary]} 
          />
        }>
        <Image source={{ uri: challenge.image_url || challenge.image || 'https://images.unsplash.com/photo-1466781783364-36c955e42a7f' }} style={styles.heroImage} contentFit="cover"/>
        <View style={styles.badgeContainer}>
          <View style={styles.typeBadge}><ThemedText style={styles.typeBadgeText}>{challenge.category ? challenge.category.charAt(0).toUpperCase() + challenge.category.slice(1) : getChallengeType(challenge)}</ThemedText></View>
        </View>
        <SafeAreaView style={styles.safeAreaContent} edges={['left', 'right']}>
          <View style={styles.titleContainer}>
            <ThemedText style={styles.title}>{challenge.title}</ThemedText>
            <View style={styles.pointsContainer}><FontAwesome5 name="star" size={18} color={Colors[theme].accent} /><ThemedText style={styles.points}>{challenge.points} Puan</ThemedText></View>
          </View>
          <View style={styles.metaContainer}>
            <View style={styles.metaItem}><FontAwesome5 name="clock" size={16} color={Colors[theme].primary} /><ThemedText style={styles.metaText}>{formatDeadline(challenge.valid_until, challenge.deadline)}</ThemedText></View>
            <View style={styles.metaSeparator} />
            <View style={styles.metaItem}><FontAwesome5 name="users" size={16} color={Colors[theme].primary} /><ThemedText style={styles.metaText}>{challenge.participation_count || 0} Katılımcı</ThemedText></View>
          </View>
          <ThemedView lightColor={Colors.light.card} darkColor={Colors.dark.card} style={styles.descriptionContainer}>
            <ThemedText style={styles.sectionTitle}>Görev Açıklaması</ThemedText>
            <ThemedText style={styles.description}>{challenge.description}</ThemedText>
          </ThemedView>
          <ThemedView lightColor={Colors.light.card} darkColor={Colors.dark.card} style={styles.requirementsContainer}>
            <ThemedText style={styles.sectionTitle}>Görev Gereklilikleri</ThemedText>
            {challenge.requirements && challenge.requirements.length > 0 ? (
              challenge.requirements.map((req, index) => (
                <ChallengeRequirementItem key={req.id || index} requirement={req} challengeId={challenge.id} onCheckIn={handleRequirementCompleted} />
              ))
            ) : (<ThemedText style={styles.emptyStateText}>Bu görev için gereksinimler belirtilmemiş.</ThemedText>)}
          </ThemedView>
          <ThemedView lightColor={Colors.light.card} darkColor={Colors.dark.card} style={styles.participationContainer}>
            <ThemedText style={styles.sectionTitle}>Katılım Durumu</ThemedText>
            <View style={styles.statusContainer}>
              <FontAwesome5 
                name={hasJoined ? "check-circle" : "info-circle"} 
                size={20} 
                color={hasJoined ? THEME.COLORS.success : Colors[theme].primary} 
                solid={hasJoined}
              />
              <ThemedText style={styles.statusText}>{hasJoined ? 'Bu göreve katıldınız! Görevi tamamlamak için gereklilikleri yerine getirin.' : 'Bu göreve henüz katılmadınız. Göreve katılmak için aşağıdaki butona tıklayın.'}</ThemedText>
            </View>
          </ThemedView>
        </SafeAreaView>
      </ScrollView>
      <SafeAreaView style={styles.bottomSafeArea} edges={['bottom', 'left', 'right']}>
        <View style={styles.buttonsContainer}>
          <TouchableOpacity style={[styles.participateButton, hasJoined && styles.leaveButton]} onPress={handleJoinChallenge} disabled={isJoining}>
            {isJoining ? <ActivityIndicator color={Colors.dark.text} /> : (<><FontAwesome5 name={hasJoined ? "times" : "play"} size={16} color={Colors.dark.text} /><ThemedText style={styles.participateButtonText}>{hasJoined ? 'Görevden Ayrıl' : 'Göreve Katıl'}</ThemedText></>)}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
      <TouchableOpacity style={styles.shareButtonFloat} onPress={handleShareChallenge}><FontAwesome5 name="share-alt" size={20} color={Colors.dark.text} /></TouchableOpacity>
    </View>
  );
}

const getDynamicStyles = (theme: 'light' | 'dark') => StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors[theme].background },
  headerStyle: { backgroundColor: Colors[theme].background, elevation: 0, shadowOpacity: 0, borderBottomWidth: 0 },
  safeArea: { backgroundColor: Colors[theme].background }, // For loading/error states
  safeAreaContent: { backgroundColor: Colors[theme].background }, // For main content
  bottomSafeArea: { backgroundColor: Colors[theme].background, borderTopWidth: 1, borderTopColor: Colors[theme].border, ...THEME.SHADOWS.medium },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  loadingText: { marginTop: 15, fontSize: THEME.SIZES.medium }, // color set inline
  errorContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  errorText: { marginTop: 15, marginBottom: 20, fontSize: THEME.SIZES.medium, textAlign: 'center' },
  returnButton: { backgroundColor: Colors[theme].primary, paddingHorizontal: 25, paddingVertical: 12, borderRadius: 10 },
  returnButtonText: { color: Colors.dark.text, fontWeight: 'bold', fontSize: THEME.SIZES.medium },
  scrollContent: { paddingBottom: 100 },
  heroImage: { width: width, height: width * 0.65, marginTop: 0 },
  badgeContainer: { position: 'absolute', top: width * 0.65 - 30, left: 15, zIndex: 5 },
  typeBadge: { backgroundColor: Colors[theme].info, paddingHorizontal: 15, paddingVertical: 6, borderRadius: 20, ...THEME.SHADOWS.small }, // Using static THEME.COLORS.info
  typeBadgeText: { color: Colors.dark.text, fontWeight: 'bold', fontSize: THEME.SIZES.small },
  titleContainer: { padding: 20, paddingTop: 15, paddingBottom: 15 },
  title: { fontSize: THEME.SIZES.xlarge, fontWeight: 'bold', marginBottom: 10 }, // color from ThemedText
  pointsContainer: { flexDirection: 'row', alignItems: 'center' },
  points: { marginLeft: 8, fontSize: THEME.SIZES.medium, fontWeight: 'bold', color: Colors[theme].accent },
  metaContainer: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 20 },
  metaItem: { flexDirection: 'row', alignItems: 'center' },
  metaSeparator: { width: 1, height: 20, backgroundColor: Colors[theme].border, marginHorizontal: 15 },
  metaText: { marginLeft: 8, fontSize: THEME.SIZES.medium, color: Colors[theme].textLight },
  descriptionContainer: { marginHorizontal: 20, padding: 15, borderRadius: 10, marginBottom: 15, ...THEME.SHADOWS.small }, // bg from ThemedView
  sectionTitle: { fontSize: THEME.SIZES.large, fontWeight: 'bold', marginBottom: 10 }, // color from ThemedText
  description: { fontSize: THEME.SIZES.medium, lineHeight: 22 }, // color from ThemedText
  requirementsContainer: { marginHorizontal: 20, padding: 15, borderRadius: 10, marginBottom: 15, ...THEME.SHADOWS.small }, // bg from ThemedView
  participationContainer: { marginHorizontal: 20, padding: 15, borderRadius: 10, marginBottom: 25, ...THEME.SHADOWS.small }, // bg from ThemedView
  statusContainer: { flexDirection: 'row', alignItems: 'flex-start', backgroundColor: Colors[theme].info + '20', padding: 10, borderRadius: 8 }, // Using static THEME.COLORS.info for tint
  statusText: { marginLeft: 10, flex: 1, fontSize: THEME.SIZES.medium }, // color from ThemedText
  buttonsContainer: { padding: 20, paddingBottom: Platform.OS === 'ios' ? 20 : 25 }, // Added more padding for Android
  participateButton: { backgroundColor: Colors[theme].primary, borderRadius: 15, paddingVertical: 15, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', ...THEME.SHADOWS.small },
  participateButtonText: { color: Colors.dark.text, fontWeight: 'bold', fontSize: THEME.SIZES.medium, marginLeft: 8 },
  shareButtonFloat: { position: 'absolute', bottom: Platform.OS === 'ios' ? 110 : 120, right: 20, backgroundColor: Colors[theme].accent, width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center', ...THEME.SHADOWS.medium, zIndex: 10 },
  leaveButton: { backgroundColor: THEME.COLORS.error }, // Using static error color
  emptyStateText: { fontSize: THEME.SIZES.medium, color: Colors[theme].textLight, textAlign: 'center', marginVertical: 10 },
});
