// Theme and UI constants for TravelPoints app
export const THEME = {
  COLORS: {
    primary: '#4F74E3',
    secondary: '#6C63FF',
    accent: '#FF7B5A',
    success: '#4CD964',
    info: '#5AC8FA',
    warning: '#FF9500',
    danger: '#FF3B30',
    error: '#FF3B30', // Hata mesajları için kırmızı renk ekledim
    light: '#F8F9FA',
    dark: '#212529',
    gray: '#6C757D',
    background: '#F0F0F0',
    card: '#FFFFFF',
    white: '#FFFFFF', // Added for visit status UI
    text: '#212529',
    border: '#E1E1E1',
    notification: '#FF3B30',
    shadowColor: '#000000',
    textLight: '#6C757D',
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
