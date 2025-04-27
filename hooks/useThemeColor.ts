import { useColorScheme } from '@/hooks/useColorScheme';
import { THEME } from '@/constants/Theme';

export function useThemeColor(
  props: { light?: string; dark?: string },
  colorName: keyof typeof THEME.COLORS
) {
  const theme = useColorScheme();
  const colorFromProps = props[theme];

  if (colorFromProps) {
    return colorFromProps;
  } else {
    return THEME.COLORS[colorName];
  }
}
