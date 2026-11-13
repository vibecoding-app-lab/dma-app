import { useEffect, useState } from 'react';
import { Linking, Text } from 'react-native';

import { Button, Card, Screen, Subtitle, Title, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

export default function StudentHome() {
  const { profile, signOut } = useAuth();
  const [instructor, setInstructor] = useState<Profile | null>(null);

  useEffect(() => {
    if (!profile?.assigned_instructor_id) {
      setInstructor(null);
      return;
    }
    supabase
      .from('profiles')
      .select('*')
      .eq('id', profile.assigned_instructor_id)
      .single()
      .then(({ data }) => setInstructor(data ?? null));
  }, [profile?.assigned_instructor_id]);

  return (
    <Screen>
      <Title>Hi {profile?.full_name?.split(' ')[0] ?? 'there'}</Title>

      <Card>
        <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>MY INSTRUCTOR</Text>
        {instructor ? (
          <>
            <Text style={{ fontSize: 20, fontWeight: '600' }}>{instructor.full_name ?? instructor.email}</Text>
            {instructor.phone ? (
              <Button
                label={`Call ${instructor.phone}`}
                variant="secondary"
                onPress={() => Linking.openURL(`tel:${instructor.phone}`)}
              />
            ) : null}
          </>
        ) : (
          <Subtitle>
            You haven't been assigned an instructor yet. Drive Master Academy will assign one to you shortly.
          </Subtitle>
        )}
      </Card>

      <Card>
        <Text style={{ fontSize: 17, fontWeight: '600' }}>Book a lesson</Text>
        <Subtitle>Booking 1 or 2 hour lessons from your instructor's calendar is coming in the next update.</Subtitle>
      </Card>

      <Button label="Sign out" variant="secondary" onPress={signOut} />
    </Screen>
  );
}
