import { useColorScheme as useNativeColorScheme } from 'react-native';

/**
 * Kullanıcının cihaz tema tercihini döndüren hook (dark/light)
 * React Native'in native useColorScheme fonksiyonunu kullanır
 */
export function useColorScheme(): 'dark' | 'light' {
  // useNativeColorScheme() null dönebilir, bu durumda 'light' varsayılanını döndürürüz
  return useNativeColorScheme() ?? 'light';
}
