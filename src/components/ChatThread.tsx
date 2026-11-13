import { useCallback, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/components/ui';
import { type ChatMessage, loadChat, markChatRead, sendMessage } from '@/lib/chat';
import { notify } from '@/lib/notify';
import { supabase } from '@/lib/supabase';
import { useLiveRefresh } from '@/lib/useLiveRefresh';

function dayHeading(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** A chat between one student and their instructor, newest at the bottom. */
export function ChatThread({
  studentId,
  instructorId,
  myId,
  title,
  subtitle,
  onBack,
}: {
  studentId: string;
  instructorId: string;
  myId: string;
  title: string;
  subtitle?: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const scroller = useRef<ScrollView>(null);

  const refresh = useCallback(async () => {
    const list = await loadChat(studentId, instructorId);
    setMessages(list);
    if (list.some((m) => !m.read_at && m.sender_id !== myId)) await markChatRead(studentId, instructorId);
  }, [studentId, instructorId, myId]);

  // Checks every 5 seconds, plus instant updates when realtime is available.
  useLiveRefresh(refresh, 5_000);
  useEffect(() => {
    const channel = supabase
      .channel(`chat-${studentId}-${instructorId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `student_id=eq.${studentId}` },
        () => refresh(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [studentId, instructorId, refresh]);

  async function send() {
    const body = draft.trim();
    if (!body) return;
    setSending(true);
    try {
      const sent = await sendMessage(studentId, instructorId, myId, body);
      setDraft('');
      setMessages((list) => (list.some((m) => m.id === sent.id) ? list : [...list, sent]));
    } catch (e) {
      notify('Message not sent', e instanceof Error ? e.message : 'Please try again.');
    } finally {
      setSending(false);
    }
  }

  let lastDay = '';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: '#fff', borderBottomWidth: 1, borderColor: colors.border }}>
        <Pressable onPress={onBack} accessibilityLabel="Back" hitSlop={10}>
          <Text style={{ fontSize: 26, color: colors.brand, lineHeight: 28 }}>‹</Text>
        </Pressable>
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: colors.brand, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 16 }}>{title.slice(0, 1).toUpperCase()}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '700' }}>{title}</Text>
          {subtitle ? <Text style={{ fontSize: 13, color: colors.muted }}>{subtitle}</Text> : null}
        </View>
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroller}
          style={{ flex: 1 }}
          contentContainerStyle={{ padding: 14, gap: 6 }}
          onContentSizeChange={() => scroller.current?.scrollToEnd({ animated: false })}
        >
          {messages.length === 0 ? (
            <Text style={{ textAlign: 'center', color: colors.muted, marginTop: 40 }}>No messages yet. Say hello!</Text>
          ) : null}
          {messages.map((m) => {
            const mine = m.sender_id === myId;
            const day = dayHeading(m.created_at);
            const showDay = day !== lastDay;
            lastDay = day;
            return (
              <View key={m.id}>
                {showDay ? (
                  <Text style={{ textAlign: 'center', fontSize: 12, color: colors.muted, marginVertical: 8 }}>{day}</Text>
                ) : null}
                <View
                  style={{
                    alignSelf: mine ? 'flex-end' : 'flex-start',
                    maxWidth: '80%',
                    backgroundColor: mine ? colors.brand : '#fff',
                    borderWidth: mine ? 0 : 1,
                    borderColor: colors.border,
                    borderRadius: 16,
                    borderBottomRightRadius: mine ? 4 : 16,
                    borderBottomLeftRadius: mine ? 16 : 4,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                  }}
                >
                  <Text style={{ color: mine ? '#fff' : colors.ink, fontSize: 16 }}>{m.body}</Text>
                  <Text style={{ color: mine ? '#FFD9DE' : colors.muted, fontSize: 11, alignSelf: 'flex-end', marginTop: 2 }}>
                    {clock(m.created_at)}
                    {mine ? (m.read_at ? '  Seen' : '  Sent') : ''}
                  </Text>
                </View>
              </View>
            );
          })}
        </ScrollView>

        <View style={{ flexDirection: 'row', gap: 8, padding: 10, backgroundColor: '#fff', borderTopWidth: 1, borderColor: colors.border, alignItems: 'flex-end' }}>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a message"
            placeholderTextColor={colors.muted}
            multiline
            maxLength={2000}
            onKeyPress={(e) => {
              // On a computer, Enter sends and Shift+Enter makes a new line.
              const ev = e.nativeEvent as unknown as { key: string; shiftKey?: boolean };
              if (Platform.OS === 'web' && ev.key === 'Enter' && !ev.shiftKey) {
                (e as unknown as { preventDefault: () => void }).preventDefault();
                send();
              }
            }}
            style={{ flex: 1, maxHeight: 120, borderWidth: 1, borderColor: colors.border, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, fontSize: 16 }}
          />
          <Pressable
            onPress={send}
            disabled={sending || !draft.trim()}
            accessibilityLabel="Send"
            style={{ backgroundColor: draft.trim() ? colors.brand : '#E0B4BB', borderRadius: 20, paddingHorizontal: 16, paddingVertical: 11 }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Send</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
