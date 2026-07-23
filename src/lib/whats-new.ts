import { ACTIVITY_BONUS_POINTS } from '@/lib/points-policy';

export type WhatsNewItem = {
  href: string;
  emoji: string;
  title: string;
  blurb: string;
  badge?: string;
  pointsHint?: string;
};

/** Featured new / easy-to-miss activities kids should discover. */
export const WHATS_NEW_ITEMS: WhatsNewItem[] = [
  {
    href: '/studio',
    emoji: '🎙️',
    title: 'Record & Earn',
    blurb: 'Record Quran, nasheeds, stories & hadith — click here and earn points',
    badge: 'NEW',
    pointsHint: '+20–40',
  },
  {
    href: '/create',
    emoji: '🎨',
    title: 'Create & Play',
    blurb: 'Colouring, draw, story adventure, dua & kindness hunt',
    badge: 'NEW',
  },
  {
    href: '/hadith',
    emoji: '📜',
    title: 'Daily Hadith',
    blurb: "Read today's 5 Hadiths, type what you learned, earn points",
    badge: 'NEW',
    pointsHint: `+${ACTIVITY_BONUS_POINTS}`,
  },
  {
    href: '/arabic',
    emoji: '📖',
    title: 'Arabic Learning',
    blurb: 'Family, cars, food & everyday English–Arabic words',
    badge: 'NEW',
  },
  {
    href: '/create/dua',
    emoji: '🤲',
    title: 'Dua of the Day',
    blurb: "Learn and say today's dua",
    badge: 'NEW',
  },
  {
    href: '/create/manners',
    emoji: '✨',
    title: 'Good Manners',
    blurb: 'Tick Islamic manners you practiced today',
    badge: 'NEW',
  },
  {
    href: '/games/wudu-steps',
    emoji: '💧',
    title: 'Wudu Steps',
    blurb: 'Put wudu steps in the right order',
    badge: 'NEW',
    pointsHint: `+${ACTIVITY_BONUS_POINTS}`,
  },
  {
    href: '/games/names-flashcards',
    emoji: '☪️',
    title: 'Names of Allah',
    blurb: 'Flashcards & match meanings',
    badge: 'NEW',
    pointsHint: `+${ACTIVITY_BONUS_POINTS}`,
  },
  {
    href: '/games/prophet-facts',
    emoji: '🌟',
    title: 'Prophet ﷺ Facts',
    blurb: 'Fun Seerah questions for kids',
    badge: 'NEW',
    pointsHint: `+${ACTIVITY_BONUS_POINTS}`,
  },
];

/** Extra earn / explore links shown on Quiz / Games / Pledge. */
export const EARN_MORE_LINKS: WhatsNewItem[] = [
  {
    href: '/studio',
    emoji: '🎙️',
    title: 'Record & Earn',
    blurb: 'Quran, nasheeds, stories & hadith',
    badge: 'NEW',
    pointsHint: '+20–40',
  },
  {
    href: '/create',
    emoji: '🎨',
    title: 'Create & Play',
    blurb: 'Colour, draw, hunt & more',
    badge: 'NEW',
  },
  {
    href: '/hadith',
    emoji: '📜',
    title: 'Daily Hadith',
    blurb: "Write about one of today's 5",
    badge: 'NEW',
    pointsHint: `+${ACTIVITY_BONUS_POINTS}`,
  },
  {
    href: '/arabic',
    emoji: '📖',
    title: 'Arabic Learning',
    blurb: 'Everyday words practice',
    badge: 'NEW',
  },
  {
    href: '/quiz',
    emoji: '🧠',
    title: 'Daily Quiz',
    blurb: 'Up to 2 quizzes a day',
    pointsHint: `+${ACTIVITY_BONUS_POINTS}`,
  },
  {
    href: '/games',
    emoji: '🎮',
    title: 'Games',
    blurb: 'Play and learn',
    pointsHint: `+${ACTIVITY_BONUS_POINTS}`,
  },
  {
    href: '/pledge',
    emoji: '📿',
    title: 'Pledge',
    blurb: 'Durood & Zikr',
    pointsHint: `+${ACTIVITY_BONUS_POINTS}`,
  },
  {
    href: '/salah',
    emoji: '🕌',
    title: 'Salah',
    blurb: 'Log all 5 prayers',
    pointsHint: `+${ACTIVITY_BONUS_POINTS}`,
  },
  {
    href: '/games/wudu-steps',
    emoji: '💧',
    title: 'Wudu Steps',
    blurb: 'Order the steps',
    badge: 'NEW',
    pointsHint: `+${ACTIVITY_BONUS_POINTS}`,
  },
  {
    href: '/games/prophet-facts',
    emoji: '🌟',
    title: 'Prophet ﷺ Facts',
    blurb: 'Seerah for kids',
    badge: 'NEW',
    pointsHint: `+${ACTIVITY_BONUS_POINTS}`,
  },
];
