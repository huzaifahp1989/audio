import {
  Home,
  BookOpen,
  Gamepad2,
  Heart,
  Trophy,
  Gift,
  CalendarDays,
  BookMarked,
  ScrollText,
  MessageCircle,
  HelpCircle,
  Coins,
  Languages,
  Palette,
  CalendarHeart,
  Sparkles,
  Mic,
  Footprints,
  type LucideIcon,
} from 'lucide-react';

export type NavGroupId = 'learn' | 'play' | 'track' | 'rewards';

export interface NavItem {
  href: string;
  /** Full label used on desktop / in menus. */
  label: string;
  /** Short label used in the compact mobile tab bar. */
  shortLabel: string;
  /** Kid-friendly one-liner shown in dropdowns and the menu sheet. */
  description: string;
  icon: LucideIcon;
  group: NavGroupId;
}

export interface NavGroup {
  id: NavGroupId;
  label: string;
  emoji: string;
  items: NavItem[];
}

/** Standalone links that sit outside the grouped dropdowns. */
export const HOME_ITEM: NavItem = {
  href: '/',
  label: 'Home',
  shortLabel: 'Home',
  description: 'Back to your dashboard',
  icon: Home,
  group: 'play',
};

export const CHAT_ITEM: NavItem = {
  href: '/chat',
  label: 'Chat',
  shortLabel: 'Chat',
  description: 'Ask us a question',
  icon: MessageCircle,
  group: 'track',
};

/**
 * Single source of truth for navigation. Both the desktop navbar and the
 * mobile bottom bar read from here so the two can never drift apart again.
 */
export const NAV_GROUPS: NavGroup[] = [
  {
    id: 'play',
    label: 'Play',
    emoji: '🎮',
    items: [
      {
        href: '/quiz',
        label: 'Daily Quiz',
        shortLabel: 'Quiz',
        description: 'Answer fun questions and earn points',
        icon: BookOpen,
        group: 'play',
      },
      {
        href: '/games',
        label: 'Games',
        shortLabel: 'Games',
        description: 'Play and learn at the same time',
        icon: Gamepad2,
        group: 'play',
      },
      {
        href: '/create',
        label: 'Create & Play',
        shortLabel: 'Create',
        description: 'Colouring, drawing, dua, kindness and more',
        icon: Palette,
        group: 'play',
      },
      {
        href: '/quiz-challenge',
        label: 'Quiz Challenge',
        shortLabel: 'Challenge',
        description: 'Quran Stories & Fiqh quizzes — one attempt each!',
        icon: Sparkles,
        group: 'play',
      },
      {
        href: '/audio-quiz',
        label: 'Audio Quiz',
        shortLabel: 'Audio',
        description: 'Listen and record your voice answer to win prizes!',
        icon: Mic,
        group: 'play',
      },
      {
        href: '/studio',
        label: 'Record & Earn',
        shortLabel: 'Record',
        description: 'Record Quran, nasheeds, stories & hadith for points',
        icon: Mic,
        group: 'play',
      },
    ],
  },
  {
    id: 'learn',
    label: 'Learn',
    emoji: '📖',
    items: [
      {
        href: '/quran/learn',
        label: 'Quran',
        shortLabel: 'Quran',
        description: 'Read Juz Amma with meanings',
        icon: BookOpen,
        group: 'learn',
      },
      {
        href: '/quran/surahs',
        label: 'Learn a Surah',
        shortLabel: 'Surahs',
        description: 'Lessons & quizzes for famous surahs',
        icon: BookOpen,
        group: 'learn',
      },
      {
        href: '/hifz',
        label: 'Hifz',
        shortLabel: 'Hifz',
        description: 'Track the surahs you memorise',
        icon: BookMarked,
        group: 'learn',
      },
      {
        href: '/seerah',
        label: 'Seerah',
        shortLabel: 'Seerah',
        description: 'The story of the Prophet ﷺ',
        icon: ScrollText,
        group: 'learn',
      },
      {
        href: '/stories',
        label: 'Stories',
        shortLabel: 'Stories',
        description: 'Beautiful Islamic stories',
        icon: BookOpen,
        group: 'learn',
      },
      {
        href: '/hadith',
        label: 'Daily Hadith',
        shortLabel: 'Hadith',
        description: "Read today's 5 Hadiths and write what you learned",
        icon: ScrollText,
        group: 'learn',
      },
      {
        href: '/arabic',
        label: 'Arabic Learning',
        shortLabel: 'Arabic',
        description: 'Learn everyday English–Arabic words',
        icon: Languages,
        group: 'learn',
      },
      {
        href: '/calendar',
        label: 'Islamic Calendar',
        shortLabel: 'Calendar',
        description: "Today's Islamic date and learn about each month",
        icon: CalendarHeart,
        group: 'learn',
      },
    ],
  },
  {
    id: 'track',
    label: 'My Deeds',
    emoji: '🌙',
    items: [
      {
        href: '/salah',
        label: 'Salah',
        shortLabel: 'Salah',
        description: 'Tick off your daily prayers',
        icon: CalendarDays,
        group: 'track',
      },
      {
        href: '/fitness',
        label: 'Fitness Challenge',
        shortLabel: 'Fitness',
        description: 'Walk every day, earn points and badges',
        icon: Footprints,
        group: 'track',
      },
      {
        href: '/pledge',
        label: 'Durood Pledge',
        shortLabel: 'Pledge',
        description: 'Count your durood and dhikr',
        icon: Heart,
        group: 'track',
      },
      {
        href: '/donations',
        label: 'Kids Sadaqah',
        shortLabel: 'Sadaqah',
        description: 'Log charity and climb the kindness leaderboard',
        icon: Coins,
        group: 'track',
      },
      {
        href: '/leaderboard',
        label: 'Leaderboard',
        shortLabel: 'Ranks',
        description: 'See the top learners',
        icon: Trophy,
        group: 'track',
      },
      {
        href: '/my-recordings',
        label: 'My Recordings',
        shortLabel: 'Records',
        description: 'See approved or rejected recordings and points',
        icon: Mic,
        group: 'track',
      },
    ],
  },
  {
    id: 'rewards',
    label: 'Rewards',
    emoji: '🎁',
    items: [
      {
        href: '/rewards',
        label: 'Rewards',
        shortLabel: 'Rewards',
        description: 'Spin the wheel and win prizes',
        icon: Gift,
        group: 'rewards',
      },
      {
        href: '/guide',
        label: 'Earn Points',
        shortLabel: 'Points',
        description: 'How to earn up to 200 points a day',
        icon: HelpCircle,
        group: 'rewards',
      },
    ],
  },
];

/** Flattened, ordered list of every nav destination (Home first, Chat last). */
export const ALL_NAV_ITEMS: NavItem[] = [
  HOME_ITEM,
  ...NAV_GROUPS.flatMap((group) => group.items),
  CHAT_ITEM,
];

/** Primary home quick actions — keep in sync with nav-config. */
export const HOME_PRIMARY_ACTIONS: NavItem[] = [
  NAV_GROUPS[0].items[0], // Daily Quiz
  NAV_GROUPS[0].items[1], // Games
  NAV_GROUPS[1].items[0], // Quran
  NAV_GROUPS[2].items[0], // Salah
  NAV_GROUPS[2].items[3], // Leaderboard
  NAV_GROUPS[3].items[0], // Rewards
];

/**
 * The four primary destinations shown in the fixed mobile tab bar. A fifth
 * "Menu" tab (rendered by the component) opens the full grouped list.
 */
export const BOTTOM_TABS: NavItem[] = [
  HOME_ITEM,
  NAV_GROUPS[0].items[0], // Daily Quiz
  NAV_GROUPS[2].items[3], // Leaderboard
  NAV_GROUPS[3].items[0], // Rewards
];

/**
 * Shared active-route matching. Highlights a link on its own page and on any
 * sub-page (e.g. /stories/123 highlights Stories), with special handling for
 * Home (exact) and Quran (any /quran* path).
 */
export function isNavActive(pathname: string | null | undefined, href: string): boolean {
  if (!pathname) return false;
  if (href === '/') return pathname === '/';
  if (href === '/quran/learn') return pathname.startsWith('/quran');
  if (href === '/donations') return pathname === '/donations' || pathname.startsWith('/donations/');
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isGroupActive(pathname: string | null | undefined, group: NavGroup): boolean {
  return group.items.some((item) => isNavActive(pathname, item.href));
}
