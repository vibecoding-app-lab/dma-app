import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import { Choice, ErrorText, SectionLabel, Subtitle, colors } from '@/components/ui';
import { type Slot, dayLabel, fetchSlots, timeLabel } from '@/lib/booking';

/**
 * Lesson length, then a day, then a start time, from the instructor's open
 * slots. Used by students booking and instructors moving a lesson.
 */
export function SlotPicker({
  hours,
  onHours,
  selected,
  onSelect,
  excludeBookingId,
}: {
  hours: 1 | 2;
  onHours: (h: 1 | 2) => void;
  selected: string | null;
  onSelect: (start: string | null) => void;
  excludeBookingId?: string;
}) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    setSlots(null);
    setError(null);
    onSelect(null);
    fetchSlots(hours, excludeBookingId)
      .then((r) => live && setSlots(r.slots))
      .catch((e) => live && setError(e instanceof Error ? e.message : 'Could not load times.'));
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hours, excludeBookingId]);

  // Group slots by local day.
  const byDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots ?? []) {
      const key = new Date(s.start).toDateString();
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return map;
  }, [slots]);

  useEffect(() => {
    if (!day || !byDay.has(day)) setDay(byDay.keys().next().value ?? null);
  }, [byDay, day]);

  const daySlots = day ? (byDay.get(day) ?? []) : [];

  return (
    <View style={{ gap: 12 }}>
      <SectionLabel>LESSON LENGTH</SectionLabel>
      <Choice
        options={[
          { value: 1, label: '1 hour' },
          { value: 2, label: '2 hours' },
        ]}
        value={hours}
        onChange={(h) => onHours(h as 1 | 2)}
      />

      <ErrorText message={error} />
      {!slots && !error ? <ActivityIndicator color={colors.brand} /> : null}

      {slots && slots.length === 0 ? (
        <Subtitle>No open times in the next 3 weeks. Please check back later or call your instructor.</Subtitle>
      ) : null}

      {slots && slots.length > 0 ? (
        <>
          <SectionLabel>DAY</SectionLabel>
          <Choice
            options={[...byDay.entries()].map(([key, list]) => ({ value: key, label: dayLabel(list[0].start) }))}
            value={day}
            onChange={(d) => {
              setDay(d);
              onSelect(null);
            }}
          />
          <SectionLabel>START TIME</SectionLabel>
          <Choice
            options={daySlots.map((s) => ({ value: s.start, label: timeLabel(s.start) }))}
            value={selected}
            onChange={onSelect}
          />
          {selected ? (
            <Text style={{ fontSize: 15, color: colors.ink }}>
              {dayLabel(selected)}, {timeLabel(selected)} to{' '}
              {timeLabel(new Date(Date.parse(selected) + hours * 3_600_000).toISOString())}
            </Text>
          ) : null}
        </>
      ) : null}
    </View>
  );
}
