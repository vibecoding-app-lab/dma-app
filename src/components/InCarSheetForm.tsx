import { memo } from 'react';
import { Image, Pressable, TextInput, View } from 'react-native';

import { SheetChoice } from '@/components/SheetChoice';
import { type SheetField, LOGO_BOXES, PAGE_H, PAGE_IMAGES, PAGE_W, SHEET_FIELDS } from '@/lib/inCar';

const LOGO = require('../../assets/logo.png');

const ORIGIN = typeof window !== 'undefined' && window.location ? window.location.origin : '';

/**
 * The in-car sheet drawn exactly like the paper form: the page as a picture,
 * with a box on top of every fillable spot.
 */
export function InCarSheetForm({
  scale,
  value,
  onChange,
}: {
  scale: number;
  value: (f: SheetField) => string;
  onChange: (name: string, v: string) => void;
}) {
  return (
    <View style={{ gap: 12 }}>
      {PAGE_IMAGES.map((src, page) => (
        <View
          key={src}
          style={{ width: PAGE_W * scale, height: PAGE_H * scale, backgroundColor: '#fff', borderRadius: 4, overflow: 'hidden', borderWidth: 1, borderColor: '#DDD' }}
        >
          <Image source={{ uri: ORIGIN + src }} style={{ position: 'absolute', left: 0, top: 0, width: PAGE_W * scale, height: PAGE_H * scale }} />
          <Image
            source={LOGO}
            resizeMode="contain"
            style={{
              position: 'absolute',
              left: LOGO_BOXES[page][0] * scale,
              top: LOGO_BOXES[page][1] * scale,
              width: LOGO_BOXES[page][2] * scale,
              height: LOGO_BOXES[page][3] * scale,
              backgroundColor: '#fff',
            }}
          />
          {SHEET_FIELDS.filter((f) => f.p === page).map((f, i) => (
            <Box key={`${f.n}-${i}`} f={f} scale={scale} v={value(f)} onChange={onChange} />
          ))}
        </View>
      ))}
    </View>
  );
}

const Box = memo(function Box({
  f,
  scale,
  v,
  onChange,
}: {
  f: SheetField;
  scale: number;
  v: string;
  onChange: (name: string, v: string) => void;
}) {
  const [left, top, w, h] = f.r;
  const style = { position: 'absolute' as const, left: left * scale, top: top * scale, width: w * scale, height: h * scale };

  if (f.t === 'radio') {
    const on = v === f.s;
    return (
      <Pressable
        accessibilityRole="radio"
        accessibilityState={{ selected: on }}
        accessibilityLabel={f.n}
        onPress={() => onChange(f.n, on ? '' : f.s)}
        style={[style, { alignItems: 'center', justifyContent: 'center', borderRadius: 999, backgroundColor: on ? 'transparent' : 'rgba(66,133,244,0.12)' }]}
      >
        {on ? <View style={{ width: w * scale * 0.7, height: h * scale * 0.7, borderRadius: 999, backgroundColor: '#0B3D91' }} /> : null}
      </Pressable>
    );
  }

  const fontSize = Math.max(6, Math.min(h * 0.72, 11) * scale);
  if (f.t === 'ch') {
    return (
      <View style={style}>
        <SheetChoice label={f.n} value={v} options={f.o} fontSize={fontSize} onChange={(x) => onChange(f.n, x)} />
      </View>
    );
  }

  return (
    <TextInput
      accessibilityLabel={f.n}
      value={v}
      onChangeText={(x) => onChange(f.n, x)}
      multiline={!!f.ml}
      style={[
        style,
        {
          fontSize: f.ml ? Math.min(fontSize, 10 * scale) : fontSize,
          color: '#0B3D91',
          fontWeight: '600',
          paddingHorizontal: 2 * scale,
          paddingVertical: 0,
          backgroundColor: v ? 'rgba(66,133,244,0.06)' : 'rgba(66,133,244,0.12)',
          textAlignVertical: f.ml ? 'top' : 'center',
        },
      ]}
    />
  );
});
