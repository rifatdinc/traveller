import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ThemedText } from '@/components/ThemedText';
import { THEME } from '@/constants/Theme';

interface UserChallengeCardProps {
  challenge: {
    id: string;
    title: string;
    description: string;
    points: number;
    image_url?: string;
    image?: string;
    progress?: number;
    progress_percentage?: number;
    completed?: boolean;
  };
}

export const UserChallengeCard = ({ challenge }: UserChallengeCardProps) => {
  const progressPercentage = challenge.progress_percentage || 0;
  const isCompleted = challenge.completed || false;

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={() => router.push(`/challenge/${challenge.id}`)}
    >
      <Image
        source={{ uri: challenge.image_url || challenge.image || 'https://picsum.photos/300/200' }}
        style={styles.image}
        contentFit="cover"
        transition={200}
      />

      {isCompleted && (
        <View style={styles.completedBadge}>
          <FontAwesome5 name="check-circle" size={16} color="#fff" solid />
        </View>
      )}

      <View style={styles.content}>
        <ThemedText style={styles.title} numberOfLines={1}>
          {challenge.title}
        </ThemedText>
        
        <View style={styles.pointsContainer}>
          <FontAwesome5 name="star" size={12} color={THEME.COLORS.warning} />
          <ThemedText style={styles.points}>{challenge.points}</ThemedText>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View 
              style={[
                styles.progressFill,
                { width: `${progressPercentage}%` },
                isCompleted && styles.progressCompleted
              ]} 
            />
          </View>
          <ThemedText style={styles.progressText}>{progressPercentage}%</ThemedText>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: THEME.COLORS.card,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    margin: 5,
    width: 160,
  },
  image: {
    width: '100%',
    height: 100,
  },
  completedBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: THEME.COLORS.success,
    borderRadius: 12,
    width: 24,
    height: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 10,
  },
  title: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  pointsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  points: {
    fontSize: 12,
    marginLeft: 4,
    color: THEME.COLORS.textLight,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: THEME.COLORS.border,
    borderRadius: 2,
    marginRight: 5,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: THEME.COLORS.primary,
    borderRadius: 2,
  },
  progressCompleted: {
    backgroundColor: THEME.COLORS.success,
  },
  progressText: {
    fontSize: 10,
    color: THEME.COLORS.textLight,
    width: 30,
  },
});
