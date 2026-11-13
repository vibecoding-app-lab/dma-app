import { Pill } from '@/components/ui';
import { type Booking, STATUS_LABEL } from '@/lib/booking';
import { lessonState } from '@/lib/progress';

/** Status label that follows the clock: In progress, Done, Confirmed, ... */
export function LessonStatePill({ lesson }: { lesson: Booking }) {
  const state = lessonState(lesson);
  if (state === 'in_progress') return <Pill label="● In progress" tone="good" />;
  if (state === 'done') return <Pill label="Done" tone="good" />;
  const tone = state === 'pending' ? 'waiting' : state === 'confirmed' ? 'good' : state === 'declined' ? 'bad' : 'neutral';
  return <Pill label={STATUS_LABEL[state]} tone={tone} />;
}
