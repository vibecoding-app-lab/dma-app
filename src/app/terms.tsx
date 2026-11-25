import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { Logo } from '@/components/Logo';
import { Card, Screen, Subtitle, Title, colors } from '@/components/ui';
import { TERMS_SECTIONS, TERMS_TITLE, TERMS_VERSION } from '@/lib/terms';

/** The Terms and Conditions page. Anyone can open it, signed in or not. */
export default function Terms() {
  return (
    <Screen>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}>
        <Text style={{ color: colors.brand, fontSize: 16 }}>‹ Back</Text>
      </Pressable>
      <Logo width={200} />
      <Title>{TERMS_TITLE}</Title>
      <Subtitle>Last updated {new Date(`${TERMS_VERSION}T12:00:00`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</Subtitle>
      <Card>
        {TERMS_SECTIONS.map((s) => (
          <View key={s.heading} style={{ gap: 4, marginBottom: 6 }}>
            <Text style={{ fontSize: 16, fontWeight: '700' }}>{s.heading}</Text>
            <Text style={{ fontSize: 15, lineHeight: 22, color: colors.ink }}>{s.body}</Text>
          </View>
        ))}
      </Card>
    </Screen>
  );
}
