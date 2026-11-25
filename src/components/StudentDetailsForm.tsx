import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import { DateInput } from '@/components/DateInput';
import { TermsCheckbox } from '@/components/TermsCheckbox';
import { Button, Card, Choice, ErrorText, Field, Screen, SectionLabel, Subtitle, Title, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { LICENSE_CLASSES, cleanPostalCode, isValidDay } from '@/lib/studentDetails';
import { notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import { TERMS_VERSION } from '@/lib/terms';
import type { LicenseClass } from '@/lib/types';
import { cleanUsername, isValidUsername, USERNAME_RULES } from '@/lib/username';

/**
 * A student's details. In 'setup' every new student fills it in once (with the
 * Terms and Conditions); in 'edit' it's their My profile page.
 */
export function StudentDetailsForm({ mode }: { mode: 'setup' | 'edit' }) {
  const { profile, session, refreshProfile } = useAuth();
  const editing = mode === 'edit';
  // Terms: accepted on the sign-up form (saved with the account), or ticked here.
  const hasTermsColumn = !!profile && 'terms_accepted_at' in profile;
  const needsTerms = !editing && hasTermsColumn && !profile?.terms_accepted_at;
  const signUpTerms = session?.user?.user_metadata as { terms_accepted_at?: string; terms_version?: string } | undefined;
  const askTerms = needsTerms && !signUpTerms?.terms_accepted_at;
  const [agreed, setAgreed] = useState(false);
  const [firstName, setFirstName] = useState(profile?.first_name ?? '');
  const [lastName, setLastName] = useState(profile?.last_name ?? '');
  const [postalCode, setPostalCode] = useState(profile?.postal_code ?? '');
  const [licenseIssue, setLicenseIssue] = useState(profile?.license_issue_date ?? '');
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
    const [first, ...rest] = (profile.full_name ?? '').trim().split(/\s+/);
    setFirstName((v) => v || profile.first_name || first || '');
    setLastName((v) => v || profile.last_name || rest.join(' ') || '');
    setPostalCode((v) => v || profile.postal_code || '');
    setLicenseIssue((v) => v || profile.license_issue_date || '');
    setPhone((v) => v || profile.phone || '');
    setAddress((v) => v || profile.address || '');
    setLicenseNumber((v) => v || profile.license_number || '');
    setLicenseExpiry((v) => v || profile.license_expiry || '');
    setLicenseClass((v) => v ?? profile.license_class ?? null);
  }, [profile?.id]);

  async function save() {
    if (!profile) return;
    const missing = [
      !firstName.trim() && 'first name',
      !lastName.trim() && 'last name',
      !phone.trim() && 'phone',
      !address.trim() && 'address',
      !postalCode.trim() && 'postal code',
      !licenseNumber.trim() && 'licence number',
      !licenseIssue && 'licence issue date',
      !licenseExpiry && 'licence expiry date',
      !licenseClass && 'licence class',
    ].filter(Boolean);
    if (missing.length) return setError(`Please fill in: ${missing.join(', ')}.`);
    if (!isValidDay(licenseIssue)) return setError('Please enter the licence issue date as YYYY-MM-DD.');
    if (!isValidDay(licenseExpiry)) return setError('Please enter the licence expiry date as YYYY-MM-DD.');
    if (licenseExpiry <= licenseIssue) return setError('The licence expiry date must be after the issue date.');
    if (needsUsername && !isValidUsername(username)) return setError(`Choose a username: ${USERNAME_RULES}`);
    if (askTerms && !agreed) return setError('Please read and accept the Terms and Conditions.');
    setBusy(true);
    setError(null);
    const { error: saveError } = await supabase
      .from('profiles')
      .update({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        full_name: `${firstName.trim()} ${lastName.trim()}`,
        postal_code: cleanPostalCode(postalCode),
        license_issue_date: licenseIssue,
        phone: phone.trim(),
        address: address.trim(),
        license_number: licenseNumber.trim().toUpperCase(),
        license_expiry: licenseExpiry,
        license_class: licenseClass,
        ...(needsUsername ? { username: cleanUsername(username) } : {}),
        ...(needsTerms
          ? {
              terms_accepted_at: askTerms ? new Date().toISOString() : signUpTerms!.terms_accepted_at,
              terms_version: askTerms ? TERMS_VERSION : signUpTerms?.terms_version ?? TERMS_VERSION,
            }
          : {}),
      })
      .eq('id', profile.id);
    setBusy(false);
    if (saveError) {
      setError(saveError.code === '23505' ? 'That username is taken. Please choose another.' : saveError.message);
      return;
    }
    await refreshProfile();
    if (editing) notify('Saved', 'Your profile has been updated.');
    else router.replace('/');
  }

  return (
    <Screen>
      <Title>{editing ? 'My profile' : 'About you'}</Title>
      <Subtitle>
        {editing
          ? 'Keep your details up to date. Your instructor uses them for lessons, your in-car sheet and your road test.'
          : 'Drive Master Academy needs these details before your first lesson. All fields are required.'}
      </Subtitle>

      <Card>
        <SectionLabel>CONTACT</SectionLabel>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <Field label="First name" value={firstName} onChangeText={setFirstName} autoComplete="given-name" />
          </View>
          <View style={{ flex: 1 }}>
            <Field label="Last name" value={lastName} onChangeText={setLastName} autoComplete="family-name" />
          </View>
        </View>
        <Field label="Phone number" value={phone} onChangeText={setPhone} keyboardType="phone-pad" autoComplete="tel" />
        <Field label="Email address" value={profile?.email ?? ''} editable={false} />
        <Field
          label="Home address"
          value={address}
          onChangeText={setAddress}
          placeholder="e.g. 12 King St, Toronto, ON"
          autoComplete="street-address"
        />
        <Field
          label="Postal code"
          value={postalCode}
          onChangeText={setPostalCode}
          onBlur={() => setPostalCode((v) => (v ? cleanPostalCode(v) : v))}
          autoCapitalize="characters"
          autoComplete="postal-code"
          placeholder="e.g. M5V 2T6"
        />
        {editing && profile?.username ? <Field label="Username" value={`@${profile.username}`} editable={false} /> : null}
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
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <DateInput label="Issue date" value={licenseIssue} onChange={setLicenseIssue} />
          </View>
          <View style={{ flex: 1 }}>
            <DateInput label="Expiry date" value={licenseExpiry} onChange={setLicenseExpiry} />
          </View>
        </View>
        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.ink }}>Licence class</Text>
        <Choice options={LICENSE_CLASSES} value={licenseClass} onChange={setLicenseClass} />
      </Card>

      {askTerms ? (
        <Card>
          <TermsCheckbox checked={agreed} onChange={setAgreed} />
        </Card>
      ) : null}
      {editing && profile?.terms_accepted_at ? (
        <Text style={{ fontSize: 14, color: colors.muted }}>
          You accepted the{' '}
          <Text style={{ color: colors.brand, textDecorationLine: 'underline' }} onPress={() => router.push('/terms')}>
            Terms and Conditions
          </Text>{' '}
          on {new Date(profile.terms_accepted_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}.
        </Text>
      ) : null}

      <Button label={editing ? 'Save changes' : 'Continue'} onPress={save} loading={busy} disabled={askTerms && !agreed} />
      <ErrorText message={error} />
    </Screen>
  );
}
