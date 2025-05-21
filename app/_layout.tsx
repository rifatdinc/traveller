import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/useColorScheme';
import { AuthProvider } from '@/hooks/useAuth';
import { LocationProvider } from '@/contexts/LocationContext';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return (
    <AuthProvider>
      <LocationProvider>
        <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
          <Stack
            screenOptions={{
            headerStyle: {
              backgroundColor: colorScheme === 'dark' ? '#1A1A1A' : '#F2F2F2',
            },
            headerTintColor: '#4A80F0',
            headerTitleStyle: {
              fontWeight: '600',
              fontSize: 18,
            },
            headerShadowVisible: true,
            headerBackTitle: 'Geri',
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen 
            name="(tabs)" 
            options={{
              headerShown: false, // Hide the stack header for (tabs), as tabs will have their own
            }} 
          />
          <Stack.Screen 
            name="route" 
            options={{
              headerTitle: 'Rota Oluşturucu',
            }} 
          />
          <Stack.Screen 
            name="+not-found"
            options={{
              headerShown: false
            }}
          />
        </Stack>
        <StatusBar style={colorScheme === 'dark' ? 'light' : 'dark'} />
      </ThemeProvider>
      </LocationProvider>
    </AuthProvider>
  );
}
