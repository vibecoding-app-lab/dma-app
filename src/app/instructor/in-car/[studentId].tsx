import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';

import { InCarSheetForm } from '@/components/InCarSheetForm';
import { Button, Card, Loading, Screen, Subtitle, Title, colors } from '@/components/ui';
import { useAuth } from '@/lib/auth';
import type { Booking } from '@/lib/booking';
import { type Answers, type SheetField, PAGE_W, SHEET_FIELDS, autoFill, downloadSheetPdf, valueOf } from '@/lib/inCar';
import { notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';

type SaveState = 'saved' | 'saving' | 'unsaved' | 'error';

/** The student's in-car sheet. Instructors only: students can't open or read it. */
export default function InCarSheet() {
  const { studentId } = useLocalSearchParams<{ studentId: string }>();
  const { profile } = useAuth();
  const { width } = useWindowDimensions();
  const [student, setStudent] = useState<Profile | null>(null);
  const [lessons, setLessons] = useState<Booking[]>([]);
  const [saved, setSaved] = useState<Answers | null>(null);
  // On a phone, start zoomed in so the boxes are big enough to tap.
  const [zoom, setZoom] = useState(() => (width < 700 ? 2 : 1));
  const [state, setState] = useState<SaveState>('saved');
  const [downloading, setDownloading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Answers>({});

  useEffect(() => {
    (async () => {
      const [{ data: s }, { data: b }, { data: sheet, error }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', studentId).single(),
        supabase.from('bookings').select('*').eq('student_id', studentId).in('status', ['confirmed', 'completed']),
        supabase.from('in_car_sheets').select('answers').eq('student_id', studentId).maybeSingle(),
      ]);
      if (error) setProblem(error.message.includes('in_car_sheets') ? 'The database update for in-car sheets has not been run yet.' : error.message);
      setStudent((s as Profile) ?? null);
      setLessons((b as Booking[]) ?? []);
      const answers = ((sheet?.answers as Answers) ?? {}) as Answers;
      latest.current = answers;
      setSaved(answers);
    })();
  }, [studentId]);

  const auto = useMemo(() => (student ? autoFill(student, profile ?? null, lessons) : {}), [student, profile, lessons]);

  const persist = useCallback(async () => {
    if (!profile) return;
    setState('saving');
    const { error } = await supabase
      .from('in_car_sheets')
      .upsert({ student_id: studentId, answers: latest.current, updated_at: new Date().toISOString(), updated_by: profile.id });
    setState(error ? 'error' : 'saved');
    if (error) setProblem(error.message);
  }, [studentId, profile?.id]);

  const onChange = useCallback(
    (name: string, v: string) => {
      latest.current = { ...latest.current, [name]: v };
      setSaved(latest.current);
      setState('unsaved');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(persist, 1200);
    },
    [persist],
  );

  // Save straight away when leaving the page.
  useEffect(() => () => {
    if (timer.current) {
      clearTimeout(timer.current);
      persist();
    }
  }, [persist]);

  const value = useCallback((f: SheetField) => valueOf(f.n, saved ?? {}, auto, f.d), [saved, auto]);

  if (!student || !saved) return <Loading />;
  const name = student.full_name ?? student.email;
  const fit = Math.min(width - 40, 900) / PAGE_W;
  const scale = fit * zoom;

  async function download() {
    setDownloading(true);
    try {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
        await persist();
      }
      const all: Answers = {};
      for (const f of SHEET_FIELDS) all[f.n] = value(f);
      await downloadSheetPdf(all, `In-car sheet - ${name}.pdf`);
    } catch (e) {
      notify('Could not make the PDF', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setDownloading(false);
    }
  }

  function resetToAuto() {
    // Clear the student and instructor boxes the instructor typed over, so the app fills them again.
    const keep: Answers = {};
    for (const [k, v] of Object.entries(latest.current)) if (!(k in auto)) keep[k] = v;
    latest.current = keep;
    setSaved(keep);
    persist();
  }

  const status =
    state === 'saving' ? 'Saving…' : state === 'unsaved' ? 'Changes not saved yet' : state === 'error' ? 'Could not save. Check your connection.' : 'All changes saved';

  return (
    <Screen>
      <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace(`/instructor/student/${studentId}`))}>
        <Text style={{ color: colors.brand, fontSize: 16 }}>‹ {name}</Text>
      </Pressable>
      <Title>In-car sheet</Title>
      <Subtitle>
        Student and instructor details, and the dates and times of finished lessons, are filled in for you. Tap any box to fill in or change it. Only
        instructors can see this sheet.
      </Subtitle>
      {problem ? (
        <Card>
          <Text style={{ color: colors.brand, fontWeight: '600' }}>{problem}</Text>
        </Card>
      ) : null}

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {Platform.OS === 'web' ? (
          <View style={{ flexGrow: 1, minWidth: 180 }}>
            <Button label="Download PDF" onPress={download} loading={downloading} />
          </View>
        ) : null}
        <ZoomButton label="−" onPress={() => setZoom((z) => Math.max(1, +(z - 0.5).toFixed(1)))} disabled={zoom <= 1} />
        <Text style={{ fontSize: 14, color: colors.muted, minWidth: 44, textAlign: 'center' }}>{Math.round(zoom * 100)}%</Text>
        <ZoomButton label="+" onPress={() => setZoom((z) => Math.min(3, +(z + 0.5).toFixed(1)))} disabled={zoom >= 3} />
      </View>
      <Text style={{ fontSize: 13, color: state === 'error' ? colors.brand : colors.muted }}>{status}</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ paddingBottom: 8 }}>
        <InCarSheetForm scale={scale} value={value} onChange={onChange} />
      </ScrollView>

      <Button label="Refill student and instructor details" variant="secondary" onPress={resetToAuto} />
    </Screen>
  );
}

function ZoomButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label === '+' ? 'Zoom in' : 'Zoom out'}
      style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : 1 }}
    >
      <Text style={{ fontSize: 22, fontWeight: '700', color: colors.ink }}>{label}</Text>
    </Pressable>
  );
}
