import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useAuth } from '@/lib/auth';

const TEXT = require('../../assets/logo-text.png');
const CAR = require('../../assets/logo-car.png');
// Pieces of the 1200 x 258 logo, split where the car's speed lines begin.
const FULL_W = 1200;
const H = 258;
const TEXT_W = 790;
const CAR_W = FULL_W - TEXT_W;
const BRAND = '#C8102E';

/**
 * Plays once each time someone signs in or opens the app signed in:
 * the car drives in, the name appears, a red line sweeps under it, then it fades away.
 */
export function LoginSplash() {
  const { session, profile } = useAuth();
  const { width } = useWindowDimensions();
  const [visible, setVisible] = useState(false);
  const shownFor = useRef<string | null>(null);

  const car = useRef(new Animated.Value(0)).current;
  const text = useRef(new Animated.Value(0)).current;
  const line = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  const userId = session && profile ? profile.id : null;

  useEffect(() => {
    if (!userId) {
      shownFor.current = null; // signed out: play again on the next sign-in
      return;
    }
    if (shownFor.current === userId) return;
    shownFor.current = userId;
    car.setValue(0);
    text.setValue(0);
    line.setValue(0);
    fade.setValue(1);
    setVisible(true);
    const native = false; // works the same on the website and in the app
    Animated.sequence([
      Animated.timing(car, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: native }),
      Animated.parallel([
        Animated.timing(text, { toValue: 1, duration: 550, easing: Easing.out(Easing.quad), useNativeDriver: native }),
        Animated.timing(line, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
      ]),
      Animated.delay(1100),
      Animated.timing(fade, { toValue: 0, duration: 350, easing: Easing.in(Easing.quad), useNativeDriver: native }),
    ]).start(() => setVisible(false));
  }, [userId]);

  if (!visible) return null;

  const first = profile?.first_name || profile?.full_name?.trim().split(/\s+/)[0];
  const greeting = first ? `Welcome back, ${first}!` : 'Welcome to Drive Master Academy!';

  const logoW = Math.min(width - 48, 520);
  const k = logoW / FULL_W;
  const carStart = -(width / 2 + CAR_W * k); // fully off the left edge

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLabel="Drive Master Academy"
      style={[StyleSheet.absoluteFill, { zIndex: 1000, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', opacity: fade }]}
    >
      <View style={{ width: logoW, height: H * k }}>
        <Animated.Image
          source={TEXT}
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: TEXT_W * k,
            height: H * k,
            opacity: text,
            transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
          }}
        />
        <Animated.Image
          source={CAR}
          style={{
            position: 'absolute',
            left: TEXT_W * k,
            top: 0,
            width: CAR_W * k,
            height: H * k,
            opacity: car.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 1, 1] }),
            transform: [{ translateX: car.interpolate({ inputRange: [0, 1], outputRange: [carStart, 0] }) }],
          }}
        />
      </View>
      <Animated.Text
        style={{
          marginTop: 26,
          fontSize: 22,
          fontWeight: '700',
          color: '#1A1A1A',
          textAlign: 'center',
          paddingHorizontal: 24,
          opacity: text,
          transform: [{ translateY: text.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        }}
      >
        {greeting}
      </Animated.Text>
      <View style={{ width: logoW * 0.6, height: 3, marginTop: 16, borderRadius: 2, overflow: 'hidden', backgroundColor: '#F1D5D9' }}>
        <Animated.View style={{ height: 3, backgroundColor: BRAND, width: line.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }} />
      </View>
    </Animated.View>
  );
}

