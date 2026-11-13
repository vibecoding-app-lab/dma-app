/** Skills an instructor can pick when writing lesson remarks (Ontario G2 / G road tests). */
export const SKILL_GROUPS: { title: string; skills: string[] }[] = [
  {
    title: 'Basics',
    skills: [
      'Pre-drive checks (seat, mirrors, belt)',
      'Starting and stopping smoothly',
      'Steering control',
      'Speed control',
      'Mirror and blind-spot checks',
      'Signalling',
      'Driving along (straight road)',
      'Following distance',
    ],
  },
  {
    title: 'Turns and intersections',
    skills: [
      'Residential left turns',
      'Residential right turns',
      'Major intersection left turns',
      'Major intersection right turns',
      'Stop signs and full stops',
      'Traffic lights and advanced greens',
      'Yielding and right of way',
      'Pedestrian crossings and school zones',
      'Railway crossings',
      'Roundabouts',
    ],
  },
  {
    title: 'Lanes and highway',
    skills: [
      'Lane changes',
      'Merging',
      'Highway entering',
      'Highway exiting',
      'Highway lane changes',
      'Passing and being passed',
    ],
  },
  {
    title: 'Manoeuvres and parking',
    skills: [
      'Three-point turn',
      'Reverse parking',
      'Parallel parking',
      'Forward / angle parking',
      'Roadside stop and moving off',
      'Reversing in a straight line',
      'Parking on a hill',
    ],
  },
  {
    title: 'Road test',
    skills: [
      'Hazard awareness and defensive driving',
      'Emergency vehicles',
      'Night or bad-weather driving',
      'Road test route practice',
      'Mock road test',
    ],
  },
];

export type SkillLevel = 'needs_work' | 'improving' | 'good';

export type RemarkItem = { skill: string; level: SkillLevel | null; note: string | null };

export const LEVELS: { value: SkillLevel; label: string; bg: string; fg: string }[] = [
  { value: 'needs_work', label: 'Needs work', bg: '#FBE4E7', fg: '#8E0B20' },
  { value: 'improving', label: 'Improving', bg: '#FFF4D6', fg: '#8A5A00' },
  { value: 'good', label: 'Good', bg: '#E3F3EA', fg: '#1E7F4F' },
];
