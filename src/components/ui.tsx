import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export const colors = {
  brand: '#C8102E',
  brandDark: '#8E0B20',
  ink: '#1A1A1A',
  muted: '#6B6B6B',
  border: '#E2E2E2',
  surface: '#FFFFFF',
  background: '#F6F6F6',
  success: '#1E7F4F',
};

export function Screen({ children, scroll = true }: { children: ReactNode; scroll?: boolean }) {
  const body = <View style={styles.screenBody}>{children}</View>;
  return (
    <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
      {scroll ? <ScrollView keyboardShouldPersistTaps="handled">{body}</ScrollView> : body}
    </SafeAreaView>
  );
}

export function Title({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

export function Subtitle({ children }: { children: ReactNode }) {
  return <Text style={styles.subtitle}>{children}</Text>;
}

export function Card({ children }: { children: ReactNode }) {
  return <View style={styles.card}>{children}</View>;
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary';
  loading?: boolean;
  disabled?: boolean;
}) {
  const primary = variant === 'primary';
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        primary ? styles.buttonPrimary : styles.buttonSecondary,
        (pressed || disabled) && { opacity: 0.7 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={primary ? '#fff' : colors.brand} />
      ) : (
        <Text style={[styles.buttonLabel, { color: primary ? '#fff' : colors.brand }]}>{label}</Text>
      )}
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput placeholderTextColor={colors.muted} style={styles.input} {...props} />
    </View>
  );
}

export function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <Text style={styles.error}>{message}</Text>;
}

export function Loading() {
  return (
    <View style={[styles.screen, styles.center]}>
      <ActivityIndicator size="large" color={colors.brand} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  screenBody: { padding: 20, gap: 16 },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 26, fontWeight: '700', color: colors.ink },
  subtitle: { fontSize: 15, color: colors.muted, lineHeight: 21 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 8,
  },
  button: {
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  buttonPrimary: { backgroundColor: colors.brand },
  buttonSecondary: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.brand },
  buttonLabel: { fontSize: 16, fontWeight: '600' },
  field: { gap: 6 },
  fieldLabel: { fontSize: 14, fontWeight: '600', color: colors.ink },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.ink,
  },
  error: { color: colors.brandDark, fontSize: 14 },
});
