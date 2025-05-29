/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 */

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

export const Colors = {
  light: {
    text: '#11181C', // Retained from original Colors.ts
    background: '#FFFFFF', // Standard white, preferred over THEME.COLORS.background '#F0F0F0'
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,
    primary: '#4F74E3',     // From THEME.COLORS
    secondary: '#6C63FF',   // From THEME.COLORS
    accent: '#FF7B5A',      // From THEME.COLORS
    card: '#FFFFFF',        // From THEME.COLORS
    border: '#E1E1E1',      // From THEME.COLORS
    shadowColor: '#000000', // From THEME.COLORS
    textLight: '#6C757D',   // From THEME.COLORS (value of gray/textLight)
  },
  dark: {
    text: '#ECEDEE', // Retained from original Colors.ts
    background: '#151718', // Retained from original Colors.ts
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,
    primary: '#7090f0',     // New dark variant
    secondary: '#8c86ff',   // New dark variant
    accent: '#ff9c80',      // New dark variant
    card: '#2C2C2E',        // New dark variant for cards
    border: '#3A3A3C',      // New dark variant for borders
    shadowColor: '#000000', // Shadows often remain black; components control opacity
    textLight: '#AEAEB2',   // New dark variant for lighter text
  },
};
