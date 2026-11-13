import { supabase } from './supabase';

export type ChatMessage = {
  id: string;
  student_id: string;
  instructor_id: string;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
};

export async function loadChat(studentId: string, instructorId: string): Promise<ChatMessage[]> {
  const { data } = await supabase
    .from('messages')
    .select('*')
    .eq('student_id', studentId)
    .eq('instructor_id', instructorId)
    .order('created_at', { ascending: true })
    .limit(500);
  return (data as ChatMessage[]) ?? [];
}

export async function sendMessage(studentId: string, instructorId: string, senderId: string, body: string) {
  const { data, error } = await supabase
    .from('messages')
    .insert({ student_id: studentId, instructor_id: instructorId, sender_id: senderId, body: body.trim() })
    .select()
    .single();
  if (error) throw error;
  return data as ChatMessage;
}

export async function markChatRead(studentId: string, instructorId: string) {
  await supabase.rpc('mark_chat_read', { p_student_id: studentId, p_instructor_id: instructorId });
}

/** Unread messages sent to me, counted per chat partner. */
export async function unreadCounts(myId: string): Promise<Record<string, number>> {
  const { data } = await supabase
    .from('messages')
    .select('student_id, instructor_id, sender_id')
    .is('read_at', null)
    .neq('sender_id', myId)
    .limit(1000);
  const counts: Record<string, number> = {};
  for (const m of data ?? []) {
    const other = m.sender_id;
    counts[other] = (counts[other] ?? 0) + 1;
  }
  return counts;
}
