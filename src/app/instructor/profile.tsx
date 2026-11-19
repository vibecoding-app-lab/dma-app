import { router } from 'expo-router';
import { useState } from 'react';

import { Button, Card, ErrorText, Field, Screen, SectionLabel, Subtitle, Title } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import { cleanUsername, isValidUsername, USERNAME_RULES, usernameAvailable } from '@/lib/username';

/** Instructor's name, phone and username. Students see all three. */
export default function InstructorProfile() {
  const { profile, refreshProfile } = useAuth();
  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [username, setUsername] = useState(profile?.username ?? '');
  const [diNumber, setDiNumber] = useState(profile?.di_number ?? '');
  const [diYear, setDiYear] = useState(profile?.di_licence_expiry_year ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!profile) return;
    const name = cleanUsername(username);
    if (!fullName.trim()) return setError('Please enter your name.');
    if (!isValidUsername(name)) return setError(`Username: ${USERNAME_RULES}`);
    setSaving(true);
    setError(null);
    try {
      if (name !== profile.username && !(await usernameAvailable(name))) {
        setError('That username is taken. Please choose another.');
        return;
      }
      const { error: saveError } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          phone: phone.trim() || null,
          username: name,
          ...('di_number' in profile ? { di_number: diNumber.trim() || null, di_licence_expiry_year: diYear.trim() || null } : {}),
        })
        .eq('id', profile.id);
      if (saveError) {
        setError(saveError.code === '23505' ? 'That username is taken. Please choose another.' : saveError.message);
        return;
      }
      await refreshProfile();
      notify('Saved', `Your students will see you as ${fullName.trim()} (@${name}).`);
      (router.canGoBack() ? router.back() : router.replace('/instructor'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <Title>My profile</Title>
      <Subtitle>Your students see your name, username and phone number on their home screen.</Subtitle>
      <Card>
        <Field label="Full name" value={fullName} onChangeText={setFullName} />
        <Field
          label="Username"
          value={username}
          onChangeText={setUsername}
          autoCapitalize="none"
          autoCorrect={false}
          placeholder="e.g. coach.hammad"
        />
        <Subtitle>{USERNAME_RULES}</Subtitle>
        <Field label="Phone" value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
      </Card>
      <Card>
        <SectionLabel>FOR THE IN-CAR SHEET</SectionLabel>
        <Subtitle>These are filled in automatically on every student's in-car sheet.</Subtitle>
        <Field label="Driving instructor licence #" value={diNumber} onChangeText={setDiNumber} autoCapitalize="characters" />
        <Field
          label="DI licence expiry year (03/31/20__)"
          value={diYear}
          onChangeText={(v) => setDiYear(v.replace(/\D/g, '').slice(-2))}
          placeholder="e.g. 27"
          inputMode="numeric"
          maxLength={4}
        />
      </Card>
      <ErrorText message={error} />
      <Button label="Save" onPress={save} loading={saving} />
      <Button label="Back" variant="secondary" onPress={() => (router.canGoBack() ? router.back() : router.replace('/instructor'))} />
    </Screen>
  );
}
