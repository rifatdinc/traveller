import { SymbolView, SymbolWeight } from 'expo-symbols';
import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { IconSymbolName } from './IconSymbol';

export function IconSymbol({ // Named export
  name,
  size = 24,
  color, // Type simplified to string
  style,
  weight,
}: {
  name: IconSymbolName;
  size?: number;
  color: string; // Changed type to just string
  style?: StyleProp<ViewStyle>;
  weight?: SymbolWeight;
}) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color} // Now the type matches
      weight={weight}
      style={style}
    />
  );
}
