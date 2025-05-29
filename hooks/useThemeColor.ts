import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof Colors.light & keyof typeof Colors.dark
) {
  const theme = useColorScheme() ?? 'light'; // Ensure theme is always 'light' or 'dark'
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    // Ensure colorName is a valid key for the current theme's Colors object
    // This check might be redundant if the type 'keyof typeof Colors.light & keyof typeof Colors.dark'
    // already guarantees that colorName exists in both light and dark palettes.
    // However, it's safer to have a fallback or ensure keys are consistent.
    if (Colors[theme] && colorName in Colors[theme]) {
      return Colors[theme][colorName];
    }
    // Fallback to a default color or handle error if colorName is not in the theme
    // For example, return a default text or background color from the light theme
    // or a specific error color. This case should ideally not be reached if types are correct.
    console.warn(`Color name "${String(colorName)}" not found in theme "${theme}". Falling back to default text color.`);
    return Colors.light.text; // Or some other sensible default
  }
}
