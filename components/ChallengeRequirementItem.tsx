import React from 'react';
import { View, StyleSheet } from 'react-native';
import { FontAwesome5 } from '@expo/vector-icons';
import { ThemedText } from '@/components/ThemedText';
import { THEME } from '@/constants/Theme';
import { ChallengeRequirement } from '@/types';

interface ChallengeRequirementItemProps {
  requirement: ChallengeRequirement & {
    progress?: number;
    is_completed?: boolean;
    current_count?: number;
  };
}

export const ChallengeRequirementItem = ({ requirement }: ChallengeRequirementItemProps) => {
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
      {requirement.is_completed && (
        <FontAwesome5 name="check" size={16} color={THEME.COLORS.success} />
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
  }
});
