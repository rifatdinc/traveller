import React from 'react';
import { Text, View } from 'react-native';
import { THEME } from '@/constants/Theme';

export default function TestScreen() {
  return (
    <View style={{ backgroundColor: THEME.COLORS.background, flex: 1 }}>
      <Text>Test Screen</Text>
    </View>
  );
}
