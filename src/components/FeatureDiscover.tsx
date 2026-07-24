'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  CHAT_ITEM,
  getRuntimeNavGroups,
  isFitnessChallengeAvailableInCurrentRuntime,
  type NavGroupId,
} from '@/lib/nav-config';
import { NavCard } from '@/components/NavCard';

type FeatureDiscoverProps = {
  /** Compact emoji tiles for younger learners; richer icon cards for older. */
  variant?: 'younger' | 'older';
};

const GROUP_ACCENT: Record<
  NavGroupId,
  { ring: string; chip: string; tile: 'blue' | 'green' | 'yellow' | 'pink' | 'purple' | 'orange' }
> = {
  play: { ring: 'border-amber-200/80', chip: 'bg-amber-50 text-amber-900', tile: 'yellow' },
  learn: { ring: 'border-teal-200/80', chip: 'bg-teal-50 text-teal-900', tile: 'green' },
  track: { ring: 'border-indigo-200/80', chip: 'bg-indigo-50 text-indigo-900', tile: 'purple' },
  rewards: { ring: 'border-rose-200/80', chip: 'bg-rose-50 text-rose-900', tile: 'pink' },
};

const YOUNGER_EMOJI: Record<string, string> = {
  '/quiz': '🧠',
  '/games': '🎮',
  '/create': '🎨',
  '/quran/learn': '📖',
  '/quran/surahs': '📗',
  '/hifz': '🌟',
  '/seerah': '📜',
  '/stories': '📚',
  '/hadith': '📜',
  '/arabic': '📖',
  '/salah': '🕌',
  '/pledge': '📿',
  '/donations': '🪙',
  '/leaderboard': '🏆',
  '/rewards': '🎁',
  '/guide': '⭐',
  '/chat': '💬',
};

const YOUNGER_COLOR_ROTATION: Array<'blue' | 'green' | 'yellow' | 'pink' | 'purple' | 'orange'> = [
  'purple',
  'yellow',
  'green',
  'blue',
  'pink',
  'orange',
];

/**
 * Home discoverability hub — driven by NAV_GROUPS so links never drift from the navbar.
 */
export function FeatureDiscover({ variant = 'older' }: FeatureDiscoverProps) {
  const [showFitnessChallenge, setShowFitnessChallenge] = useState(false);
  const visibleGroups = useMemo(
    () => getRuntimeNavGroups(showFitnessChallenge),
    [showFitnessChallenge]
  );

  useEffect(() => {
    setShowFitnessChallenge(isFitnessChallengeAvailableInCurrentRuntime());
  }, []);

  if (variant === 'younger') {
    const tiles = visibleGroups.flatMap((group, groupIndex) =>
      group.items.map((item, itemIndex) => ({
        href: item.href,
        icon: YOUNGER_EMOJI[item.href] || group.emoji,
        title: item.shortLabel || item.label,
        description: item.description,
        color: YOUNGER_COLOR_ROTATION[(groupIndex * 2 + itemIndex) % YOUNGER_COLOR_ROTATION.length],
      }))
    );

    return (
      <section className="space-y-4 stagger-in" aria-labelledby="explore-kids-zone-title">
        <div className="text-center sm:text-left">
          <h2 id="explore-kids-zone-title" className="font-heading text-2xl font-extrabold text-sand-900">
            Explore Kids Zone
          </h2>
          <p className="mt-1 text-sm font-medium text-sand-600">Pick something fun to do</p>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {tiles.map((tile) => (
            <NavCard
              key={tile.href}
              href={tile.href}
              icon={tile.icon}
              title={tile.title}
              description={tile.description}
              color={tile.color}
            />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-6 stagger-in" aria-labelledby="explore-kids-zone-title">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 id="explore-kids-zone-title" className="font-heading text-2xl font-extrabold text-sand-900 md:text-3xl">
            Explore Kids Zone
          </h2>
          <p className="mt-1 text-sm text-sand-600 md:text-base">
            Everything to play, learn, track your deeds, and earn rewards
          </p>
        </div>
      </div>

      <div className="space-y-5">
        {visibleGroups.map((group) => {
          const accent = GROUP_ACCENT[group.id];
          return (
            <div
              key={group.id}
              className={`overflow-hidden rounded-2xl border bg-white/80 p-4 shadow-sm sm:p-5 ${accent.ring}`}
            >
              <div className="mb-3 flex items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${accent.chip}`}
                >
                  <span aria-hidden>{group.emoji}</span>
                  {group.label}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.items.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="feature-tile group flex items-start gap-3 rounded-xl p-4 transition hover:bg-white"
                  >
                    <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-sm transition group-hover:scale-105">
                      <item.icon size={18} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold text-sand-900">{item.label}</span>
                      <span className="mt-0.5 block text-sm text-sand-600">{item.description}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          );
        })}

        <Link
          href={CHAT_ITEM.href}
          className="feature-tile flex items-center gap-3 rounded-2xl border border-sand-200/80 bg-white/80 p-4 transition hover:bg-white"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 text-white shadow-sm">
            <CHAT_ITEM.icon size={18} />
          </span>
          <span>
            <span className="block font-bold text-sand-900">{CHAT_ITEM.label}</span>
            <span className="block text-sm text-sand-600">{CHAT_ITEM.description}</span>
          </span>
        </Link>
      </div>
    </section>
  );
}
