import Ionicons from '@expo/vector-icons/Ionicons';
import { Linking, Platform, Text, View } from 'react-native';


import type { RoadTest } from '@/lib/types';

export function roadTestWhen(t: RoadTest) {
  const d = new Date(t.starts_at);
  return `${d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })} at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}`;
}

/** The student's road test, shown at the top of their home screen until the day has passed. */
export function RoadTestCard({ test, title = 'YOUR ROAD TEST' }: { test: RoadTest; title?: string }) {
  const mapsUrl =
    Platform.OS === 'ios'
      ? `http://maps.apple.com/?q=${encodeURIComponent(test.location)}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(test.location)}`;
  return (
    <View style={{ backgroundColor: '#123B7A', borderRadius: 16, padding: 16, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Ionicons name="ribbon" size={20} color="#FFD43B" />
        <Text style={{ color: '#FFD43B', fontSize: 13, fontWeight: '800', letterSpacing: 0.5 }}>{title}</Text>
      </View>
      <Text style={{ color: '#FFFFFF', fontSize: 20, fontWeight: '700' }}>{roadTestWhen(test)}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 6 }}>
        <Ionicons name="location" size={18} color="#C9DAFB" style={{ marginTop: 1 }} />
        <Text style={{ color: '#FFFFFF', fontSize: 16, flex: 1, textDecorationLine: 'underline' }} onPress={() => Linking.openURL(mapsUrl)}>
          {test.location}
        </Text>
      </View>
      {test.notes ? <Text style={{ color: '#E6EEFF', fontSize: 15, fontStyle: 'italic' }}>"{test.notes}"</Text> : null}
      <Text style={{ color: '#C9DAFB', fontSize: 13 }}>Bring your licence. Your instructor will update this if anything changes.</Text>
    </View>
  );
}

/** Keep showing a test until the end of its day. */
export function roadTestStillAhead(t: RoadTest) {
  const end = new Date(t.starts_at);
  end.setHours(23, 59, 59, 999);
  return end.getTime() > Date.now();
}

