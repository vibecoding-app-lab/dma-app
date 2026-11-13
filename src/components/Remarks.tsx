import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';

import { SectionLabel, colors } from '@/components/ui';
import type { Booking } from '@/lib/booking';
import { LEVELS, type RemarkItem, SKILL_GROUPS, type SkillLevel } from '@/lib/skills';

/** How remarks look to the student (and in the instructor's history). */
export function RemarksView({ lesson }: { lesson: Booking }) {
  const items = lesson.remarks_items ?? [];
  if (!items.length && !lesson.remarks) return null;
  return (
    <View style={{ backgroundColor: '#F3F7FF', borderRadius: 10, padding: 10, gap: 6 }}>
      <Text style={{ fontSize: 12, fontWeight: '700', color: '#174EA6' }}>INSTRUCTOR'S REMARKS</Text>
      {items.map((i) => {
        const level = LEVELS.find((l) => l.value === i.level);
        return (
          <View key={i.skill} style={{ gap: 2 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={{ fontSize: 15, fontWeight: '600' }}>{i.skill}</Text>
              {level ? (
                <View style={{ backgroundColor: level.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 }}>
                  <Text style={{ color: level.fg, fontSize: 12, fontWeight: '700' }}>{level.label}</Text>
                </View>
              ) : null}
            </View>
            {i.note ? <Text style={{ fontSize: 14, color: colors.ink }}>{i.note}</Text> : null}
          </View>
        );
      })}
      {lesson.remarks ? <Text style={{ fontSize: 15, color: colors.ink }}>{lesson.remarks}</Text> : null}
    </View>
  );
}

/**
 * Instructor picks the skills worked on, rates each one, adds an optional
 * note under it, and can write general comments.
 */
export function RemarksEditor({
  items,
  onItems,
  comments,
  onComments,
}: {
  items: RemarkItem[];
  onItems: (items: RemarkItem[]) => void;
  comments: string;
  onComments: (v: string) => void;
}) {
  const [custom, setCustom] = useState('');
  const chosen = new Set(items.map((i) => i.skill));

  function toggle(skill: string) {
    onItems(chosen.has(skill) ? items.filter((i) => i.skill !== skill) : [...items, { skill, level: null, note: null }]);
  }
  function update(skill: string, change: Partial<RemarkItem>) {
    onItems(items.map((i) => (i.skill === skill ? { ...i, ...change } : i)));
  }
  function addCustom() {
    const skill = custom.trim();
    if (skill && !chosen.has(skill)) onItems([...items, { skill, level: null, note: null }]);
    setCustom('');
  }

  return (
    <View style={{ gap: 14 }}>
      <Text style={{ fontSize: 15, color: colors.muted }}>Tap the skills you worked on in this lesson.</Text>
      {SKILL_GROUPS.map((g) => (
        <View key={g.title} style={{ gap: 6 }}>
          <SectionLabel>{g.title.toUpperCase()}</SectionLabel>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {g.skills.map((skill) => {
              const on = chosen.has(skill);
              return (
                <Pressable
                  key={skill}
                  onPress={() => toggle(skill)}
                  accessibilityState={{ selected: on }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: on ? colors.brand : colors.border,
                    backgroundColor: on ? colors.brand : '#fff',
                  }}
                >
                  <Text style={{ color: on ? '#fff' : colors.ink, fontSize: 14, fontWeight: on ? '700' : '500' }}>
                    {on ? '✓ ' : ''}
                    {skill}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}

      <View style={{ flexDirection: 'row', gap: 8 }}>
        <TextInput
          value={custom}
          onChangeText={setCustom}
          onSubmitEditing={addCustom}
          placeholder="Another skill (type and press Add)"
          placeholderTextColor={colors.muted}
          style={{ flex: 1, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: '#fff' }}
        />
        <Pressable
          onPress={addCustom}
          style={{ borderWidth: 1, borderColor: colors.brand, borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' }}
        >
          <Text style={{ color: colors.brand, fontWeight: '700' }}>Add</Text>
        </Pressable>
      </View>

      {items.length ? (
        <View style={{ gap: 10 }}>
          <SectionLabel>HOW DID EACH ONE GO?</SectionLabel>
          {items.map((i) => (
            <View key={i.skill} style={{ gap: 6, padding: 10, borderRadius: 10, backgroundColor: '#FAFAFA', borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ flex: 1, fontSize: 15, fontWeight: '700' }}>{i.skill}</Text>
                <Pressable onPress={() => toggle(i.skill)} hitSlop={10} accessibilityLabel={`Remove ${i.skill}`}>
                  <Text style={{ fontSize: 18, color: colors.muted }}>×</Text>
                </Pressable>
              </View>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {LEVELS.map((l) => {
                  const on = i.level === l.value;
                  return (
                    <Pressable
                      key={l.value}
                      onPress={() => update(i.skill, { level: on ? null : (l.value as SkillLevel) })}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        paddingVertical: 7,
                        borderRadius: 8,
                        borderWidth: 1,
                        borderColor: on ? l.fg : colors.border,
                        backgroundColor: on ? l.bg : '#fff',
                      }}
                    >
                      <Text style={{ color: on ? l.fg : colors.ink, fontWeight: on ? '700' : '500', fontSize: 13 }}>{l.label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                value={i.note ?? ''}
                onChangeText={(note) => update(i.skill, { note })}
                placeholder="Note (optional)"
                placeholderTextColor={colors.muted}
                multiline
                maxLength={300}
                style={{ borderWidth: 1, borderColor: colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15, backgroundColor: '#fff' }}
              />
            </View>
          ))}
        </View>
      ) : null}

      <View style={{ gap: 6 }}>
        <SectionLabel>GENERAL COMMENTS (OPTIONAL)</SectionLabel>
        <TextInput
          value={comments}
          onChangeText={onComments}
          multiline
          maxLength={2000}
          placeholder="e.g. Great progress today. Next lesson: highway driving."
          placeholderTextColor={colors.muted}
          style={{ minHeight: 70, borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, backgroundColor: '#fff' }}
        />
      </View>
    </View>
  );
}
