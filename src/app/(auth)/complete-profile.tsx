import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { DateInput } from '@/components/DateInput';
import { Button, Card, Choice, ErrorText, Field, Screen, SectionLabel, Subtitle, Title, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { LICENSE_CLASSES, isValidDay } from '@/lib/studentDetails';
import { supabase } from '@/lib/supabase';
import type { LicenseClass } from '@/lib/types';
import { cleanUsername, isValidUsername, USERNAME_RULES } from '@/lib/username';

/** Every new student fills this in once. All fields are required. */
export default function CompleteProfile() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [licenseNumber, setLicenseNumber] = useState(profile?.license_number ?? '');
  const [licenseExpiry, setLicenseExpiry] = useState(profile?.license_expiry ?? '');
  const [licenseClass, setLicenseClass] = useState<LicenseClass | null>(profile?.license_class ?? null);
  const needsUsername = !profile?.username;
  const [username, setUsername] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The profile can arrive after the screen opens: fill in anything already on file.
  useEffect(() => {
    if (!profile) return;
    setFullName((v) => v || profile.full_name || '');
    setPhone((v) => v || profile.phone || '');
    setAddress((v) => v || profile.address || '');
    setLicenseNumber((v) => v || profile.license_number || '');
    setLicenseExpiry((v) => v || profile.license_expiry || '');
    setLicenseClass((v) => v ?? profile.license_class ?? null);
  }, [profile?.id]);

  async function save() {
    if (!profile) return;
    const missing = [
      !fullName.trim() && 'full name',
      !phone.trim() && 'phone',
      !address.trim() && 'address',
      !licenseNumber.trim() && 'licence number',
      !licenseExpiry && 'licence expiry',
      !licenseClass && 'licence class',
    ].filter(Boolean);
    if (missing.length) return setError(`Please fill in: ${missing.join(', ')}.`);
    if (!isValidDay(licenseExpiry)) return setError('Please enter the licence expiry date as YYYY-MM-DD.');
    if (needsUsername && !isValidUsername(username)) return setError(`Choose a username: ${USERNAME_RULES}`);
    setBusy(true);
    setError(null);
    const { error: saveError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        license_number: licenseNumber.trim().toUpperCase(),
        license_expiry: licenseExpiry,
        license_class: licenseClass,
        ...(needsUsername ? { username: cleanUsername(username) } : {}),
      })
      .eq('id', profile.id);
    setBusy(false);
    if (saveError) {
      setError(saveError.code === '23505' ? 'That username is taken. Please choose another.' : saveError.message);
      return;
    }
    await refreshProfile();
    router.replace('/');
  }

  return (
    <Screen>
      <Title>About you</Title>
      <Subtitle>Drive Master Academy needs these details before your first lesson. All fields are required.</Subtitle>

      <Card>
        <SectionLabel>CONTACT</SectionLabel>
        <Field label="Full name" value={fullName} onChangeText={setFullName} autoComplete="name" />
        <Field label="Email" value={profile?.email ?? ''} editable={false} />
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
        <Field
          label="Home address"
          value={address}
          onChangeText={setAddress}
          placeholder="e.g. 12 King St, Toronto, ON"
          autoComplete="street-address"
        />
        {needsUsername ? (
          <>
            <Field
              label="Username"
              value={username}
              onChangeText={setUsername}
              placeholder="e.g. sara_k"
              autoCapitalize="none"
              autoComplete="username-new"
            />
            <Subtitle>You can sign in with this instead of your email. {USERNAME_RULES}</Subtitle>
          </>
        ) : null}
      </Card>

      <Card>
        <SectionLabel>DRIVER'S LICENCE</SectionLabel>
        <Field
          label="Licence number"
          value={licenseNumber}
          onChangeText={setLicenseNumber}
          autoCapitalize="characters"
          placeholder="e.g. A1234-56789-01234"
        />
        <DateInput label="Licence expiry" value={licenseExpiry} onChange={setLicenseExpiry} />
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>Licence class</Text>
        <Choice options={LICENSE_CLASSES} value={licenseClass} onChange={setLicenseClass} />
      </Card>

      <Button label="Continue" onPress={save} loading={busy} />
      <ErrorText message={error} />
    </Screen>
  );
}
