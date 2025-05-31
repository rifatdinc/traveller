// Theme and UI constants for TravelPoints app
// Some colors have been moved to constants/Colors.ts for dynamic theming
export const THEME = {
  COLORS: {
    success: '#4CD964',
    info: '#5AC8FA',
    warning: '#FF9500',
    danger: '#FF3B30',
    error: '#FF3B30',
    light: '#F8F9FA',
    dark: '#212529',
    gray: '#6C757D',
    white: '#FFFFFF',
    notification: '#FF3B30',
    primary: '#007AFF',
    secondary: '#5856D6',
    text: '#000000',
    background: '#FFFFFF',
    card: '#FFFFFF',
    border: '#E5E5EA',
    shadowColor: '#000',
    // Removed: primary, secondary, accent, background, card, text, border, shadowColor, textLight
    // These are now in constants/Colors.ts for light/dark mode variants
  },
  SIZES: {
    base: 8,
    small: 12,
    font: 14,
    medium: 16,
    large: 18,
    xlarge: 20,
    xxlarge: 24,
    xxxlarge: 30,
  },
  FONTS: {
    regular: 'SpaceMono-Regular',
    medium: 'SpaceMono-Regular',
    light: 'SpaceMono-Regular',
    bold: 'SpaceMono-Regular',
  },
  SHADOWS: {
    small: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 2,
      },
      shadowOpacity: 0.25,
      shadowRadius: 3.84,
      elevation: 2,
    },
    medium: {
      shadowColor: '#000',
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.30,
      shadowRadius: 4.65,
      elevation: 8,
    },
  }
};
