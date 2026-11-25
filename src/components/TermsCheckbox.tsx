import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';

import { colors } from '@/components/ui';

/** "I agree to the Terms and Conditions", with a link that opens them. */
export function TermsCheckbox({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
      <Pressable
        onPress={() => onChange(!checked)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked }}
        accessibilityLabel="I agree to the Terms and Conditions"
        hitSlop={8}
        style={{
          width: 24,
          height: 24,
          borderRadius: 6,
          borderWidth: 2,
          borderColor: checked ? colors.brand : '#9A9A9A',
          backgroundColor: checked ? colors.brand : '#FFFFFF',
          alignItems: 'center',
          justifyContent: 'center',
          marginTop: 1,
        }}
      >
        {checked ? <Ionicons name="checkmark" size={18} color="#FFFFFF" /> : null}
      </Pressable>
      <Text style={{ flex: 1, fontSize: 15, lineHeight: 22, color: colors.ink }} onPress={() => onChange(!checked)}>
        I have read and agree to the{' '}
        <Text style={{ color: colors.brand, fontWeight: '700', textDecorationLine: 'underline' }} onPress={() => router.push('/terms')}>
          Terms and Conditions
        </Text>
        .
      </Text>
    </View>
  );
}
