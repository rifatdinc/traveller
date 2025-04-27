import { Stack } from 'expo-router';
import { THEME } from '@/constants/Theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: THEME.COLORS.background }
      }}
    />
  );
}
