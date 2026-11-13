import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { colors } from '@/components/ui';

/** Anything that can sit on the calendar. */
export type CalendarItem = {
  id: string;
  title: string;
  subtitle?: string;
  start: Date;
  end: Date;
  allDay?: boolean;
  kind: 'google' | 'lesson' | 'request' | 'free';
  onPress?: () => void;
};

export type CalendarMode = 1 | 3 | 7;

/** Working hours by weekday (0 = Sunday), as "HH:MM" pairs. */
export type WorkingHours = Record<number, { start: string; end: string }[]>;

const toHours = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h + m / 60;
};

const HOUR = 52; // pixels per hour
const GUTTER = 44; // width of the hour labels
const STYLE = {
  google: { bg: '#E8F0FE', border: '#4285F4', fg: '#174EA6' },
  lesson: { bg: colors.brand, border: colors.brandDark, fg: '#FFFFFF' },
  request: { bg: '#FFF4D6', border: '#E0A200', fg: '#6B4500' },
  free: { bg: '#F1F3F4', border: '#BDC1C6', fg: '#5F6368' },
};

export function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

/** Monday of the week containing d. */
export function startOfWeek(d: Date) {
  const x = startOfDay(d);
  return addDays(x, -((x.getDay() + 6) % 7));
}

function sameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

function hourLabel(h: number) {
  const d = new Date(2000, 0, 1, h);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
}

function timeRange(a: Date, b: Date) {
  const f = (d: Date) => d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  return `${f(a)} to ${f(b)}`;
}

/** Side-by-side lanes for overlapping items, like Google Calendar. */
function layout(items: CalendarItem[]) {
  const sorted = [...items].sort((a, b) => +a.start - +b.start || +b.end - +a.end);
  const out: { item: CalendarItem; lane: number; lanes: number }[] = [];
  let group: { item: CalendarItem; lane: number }[] = [];
  let groupEnd = 0;
  const flush = () => {
    const lanes = Math.max(1, ...group.map((g) => g.lane + 1));
    for (const g of group) out.push({ ...g, lanes });
    group = [];
  };
  for (const item of sorted) {
    if (group.length && +item.start >= groupEnd) flush();
    const used = new Set(group.filter((g) => +g.item.end > +item.start).map((g) => g.lane));
    let lane = 0;
    while (used.has(lane)) lane++;
    group.push({ item, lane });
    groupEnd = Math.max(groupEnd, +item.end);
  }
  flush();
  return out;
}

export function CalendarView({
  anchor,
  mode,
  items,
  onSelectDay,
  workingHours,
}: {
  workingHours?: WorkingHours;
  anchor: Date; // first day shown
  mode: CalendarMode;
  items: CalendarItem[];
  onSelectDay?: (day: Date) => void;
}) {
  const days = useMemo(() => Array.from({ length: mode }, (_, i) => addDays(startOfDay(anchor), i)), [anchor, mode]);
  const [now, setNow] = useState(new Date());
  const scroller = useRef<ScrollView>(null);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  // Show 7 AM to 9 PM, stretched to fit anything earlier or later.
  const timed = items.filter((i) => !i.allDay);
  const visible = timed.filter((i) => days.some((d) => sameDay(i.start, d)));
  const firstHour = Math.min(7, ...visible.map((i) => i.start.getHours()));
  const lastHour = Math.max(21, ...visible.map((i) => (sameDay(i.start, i.end) ? Math.ceil(i.end.getHours() + i.end.getMinutes() / 60) : 24)));
  const hours = Array.from({ length: lastHour - firstHour }, (_, i) => firstHour + i);

  useEffect(() => {
    // Open around 8 AM.
    scroller.current?.scrollTo({ y: Math.max(0, (8 - firstHour) * HOUR), animated: false });
  }, [firstHour, anchor]);

  const allDay = items.filter((i) => i.allDay);
  const top = (d: Date) => (d.getHours() + d.getMinutes() / 60 - firstHour) * HOUR;

  return (
    <View style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: '#fff', overflow: 'hidden' }}>
      {/* Day headers */}
      <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border }}>
        <View style={{ width: GUTTER }} />
        {days.map((d) => {
          const today = sameDay(d, now);
          return (
            <Pressable
              key={d.toISOString()}
              onPress={() => onSelectDay?.(d)}
              style={{ flex: 1, alignItems: 'center', paddingVertical: 6 }}
            >
              <Text style={{ fontSize: 11, fontWeight: '600', color: today ? colors.brand : colors.muted }}>
                {d.toLocaleDateString(undefined, { weekday: 'short' }).toUpperCase()}
              </Text>
              <View
                style={{
                  marginTop: 2,
                  width: mode === 7 ? 28 : 34,
                  height: mode === 7 ? 28 : 34,
                  borderRadius: 17,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: today ? colors.brand : 'transparent',
                }}
              >
                <Text style={{ fontSize: mode === 7 ? 15 : 20, color: today ? '#fff' : colors.ink }}>{d.getDate()}</Text>
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* All-day strip */}
      {days.some((d) => allDay.some((i) => +i.start < +addDays(d, 1) && +i.end > +d)) ? (
        <View style={{ flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.border, paddingVertical: 2 }}>
          <View style={{ width: GUTTER }} />
          {days.map((d) => (
            <View key={d.toISOString()} style={{ flex: 1, gap: 2, paddingHorizontal: 1 }}>
              {allDay
                .filter((i) => +i.start < +addDays(d, 1) && +i.end > +d)
                .map((i) => (
                  <View key={i.id} style={{ backgroundColor: STYLE[i.kind].border, borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2 }}>
                    <Text numberOfLines={1} style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
                      {i.title}
                    </Text>
                  </View>
                ))}
            </View>
          ))}
        </View>
      ) : null}

      {/* Time grid */}
      <ScrollView ref={scroller} style={{ maxHeight: 560 }} nestedScrollEnabled>
        <View style={{ flexDirection: 'row', height: hours.length * HOUR }}>
          <View style={{ width: GUTTER }}>
            {hours.map((h, i) => (
              <Text
                key={h}
                style={{ position: 'absolute', top: i * HOUR - 7, right: 6, fontSize: 10, color: colors.muted }}
              >
                {i === 0 ? '' : hourLabel(h)}
              </Text>
            ))}
          </View>
          {days.map((d) => {
            const placed = layout(visible.filter((i) => sameDay(i.start, d)));
            return (
              <View key={d.toISOString()} style={{ flex: 1, borderLeftWidth: 1, borderColor: colors.border }}>
                {hours.map((h, i) => (
                  <View
                    key={h}
                    style={{ position: 'absolute', top: i * HOUR, left: 0, right: 0, height: HOUR, borderTopWidth: i ? 1 : 0, borderColor: '#EFEFEF' }}
                  />
                ))}
                {workingHours
                  ? offHours(workingHours[d.getDay()] ?? [], firstHour, lastHour).map(([a, b]) => (
                      <View
                        key={`off-${a}`}
                        style={{ position: 'absolute', top: (a - firstHour) * HOUR, height: (b - a) * HOUR, left: 0, right: 0, backgroundColor: '#ECECEC' }}
                      />
                    ))
                  : null}
                {placed.map(({ item, lane, lanes }) => {
                  const end = sameDay(item.start, item.end) ? item.end : addDays(startOfDay(item.start), 1);
                  const height = Math.max(18, top(end) - top(item.start) - 2);
                  const s = STYLE[item.kind];
                  const width = 100 / lanes;
                  return (
                    <Pressable
                      key={item.id}
                      onPress={item.onPress}
                      disabled={!item.onPress}
                      style={{
                        position: 'absolute',
                        top: top(item.start) + 1,
                        height,
                        left: `${lane * width}%`,
                        width: `${width}%`,
                        paddingHorizontal: 1,
                      }}
                    >
                      <View
                        style={{
                          flex: 1,
                          backgroundColor: s.bg,
                          borderLeftWidth: 3,
                          borderColor: s.border,
                          borderStyle: item.kind === 'request' ? 'dashed' : 'solid',
                          borderRadius: 6,
                          paddingHorizontal: 4,
                          paddingVertical: 2,
                          overflow: 'hidden',
                        }}
                      >
                        <Text numberOfLines={height < 34 ? 1 : 2} style={{ color: s.fg, fontSize: mode === 7 ? 10 : 12, fontWeight: '700' }}>
                          {item.title}
                        </Text>
                        {height >= 40 && mode !== 7 ? (
                          <Text numberOfLines={1} style={{ color: s.fg, fontSize: 11, opacity: 0.9 }}>
                            {item.subtitle ?? timeRange(item.start, item.end)}
                          </Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
                {sameDay(d, now) && now.getHours() >= firstHour && now.getHours() < lastHour ? (
                  <View style={{ position: 'absolute', top: top(now), left: -4, right: 0, flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brand }} />
                    <View style={{ flex: 1, height: 2, backgroundColor: colors.brand }} />
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

/** The parts of the day outside working hours, as [from, to] in hours. */
function offHours(windows: { start: string; end: string }[], first: number, last: number): [number, number][] {
  const sorted = windows.map((w) => [toHours(w.start), toHours(w.end)] as [number, number]).sort((a, b) => a[0] - b[0]);
  const out: [number, number][] = [];
  let at = first;
  for (const [a, b] of sorted) {
    if (a > at) out.push([at, Math.min(a, last)]);
    at = Math.max(at, b);
  }
  if (at < last) out.push([at, last]);
  return out.filter(([a, b]) => b > a);
}

export function CalendarLegend() {
  const entries: [keyof typeof STYLE, string][] = [
    ['lesson', 'Lesson'],
    ['request', 'Request'],
    ['google', 'Google Calendar'],
  ];
  const off = (
    <View key="off" style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: '#ECECEC', borderWidth: 1, borderColor: '#D5D5D5' }} />
      <Text style={{ fontSize: 13, color: colors.muted }}>Outside working hours</Text>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
      {entries.map(([k, label]) => (
        <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: STYLE[k].bg, borderLeftWidth: 3, borderColor: STYLE[k].border }} />
          <Text style={{ fontSize: 13, color: colors.muted }}>{label}</Text>
        </View>
      ))}
      {off}
    </View>
  );
}
