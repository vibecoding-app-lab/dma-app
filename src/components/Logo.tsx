import { Image, type ImageStyle, type StyleProp } from 'react-native';

const LOGO = require('../../assets/logo.png');
const RATIO = 1200 / 258;

/** The Drive Master Academy logo at a given width. */
export function Logo({ width = 220, style }: { width?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={LOGO}
      accessibilityLabel="Drive Master Academy Driving School"
      resizeMode="contain"
      style={[{ width, height: width / RATIO }, style]}
    />
  );
}
