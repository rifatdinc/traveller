// Theme and UI constants for TravelPoints app
// Some colors have been moved to constants/Colors.ts for dynamic theming
export const THEME = {
  COLORS: {
    success: '#4CD964',
    info: '#5AC8FA',
    warning: '#FF9500',
    danger: '#FF3B30',
    error: '#FF3B30', // Hata mesajları için kırmızı renk ekledim
    light: '#F8F9FA', // This 'light' is a general light color, not theme-specific text/bg
    dark: '#212529',  // This 'dark' is a general dark color, not theme-specific text/bg
    gray: '#6C757D',
    white: '#FFFFFF', // Added for visit status UI
    notification: '#FF3B30',
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
