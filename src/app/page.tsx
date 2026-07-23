'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useAgeMode } from '@/lib/age-mode';
import { BookOpen, Gamepad2, Mic, Sparkles, Star, Target, Zap, Trophy, Coins } from 'lucide-react';
import DailyMissions from '@/components/DailyMissions';
import { ComeBackNudge } from '@/components/ComeBackNudge';
import { WeeklyChallengeCard } from '@/components/WeeklyChallengeCard';
import { RamadanModeCard } from '@/components/RamadanModeCard';
import { RamadanPopup } from '@/components/RamadanPopup';
import ReferralTokenHub from '@/components/ReferralTokenHub';
import KidsZoneFeatureLab from '@/components/KidsZoneFeatureLab';
import { FeatureDiscover } from '@/components/FeatureDiscover';
import { WhatsNew } from '@/components/WhatsNew';
import { RecordAndEarnBanner } from '@/components/RecordAndEarnBanner';
import { Mascot } from '@/components/Mascot';
import { ReadAloudButton } from '@/components/ReadAloudButton';
import { PointsSummaryWidget } from '@/components/PointsSummaryWidget';
import { SurveyPopup } from '@/components';
import { DailyAyahCard } from '@/components/DailyAyahCard';
import { AchievementGrid } from '@/components/AchievementGrid';
import { StreakCalendar } from '@/components/StreakCalendar';
import { getKidLevelTitle } from '@/lib/level-names';

const TIP_TEXT =
  'Try to learn something new about Islam every day, even if it is just one verse or one hadith. Little by little, you build lasting knowledge. May Allah bless your journey!';

export default function Home() {
  const { profile } = useAuth();
  const { isYounger } = useAgeMode();
  const user = useMemo(() => {
    const extras = (profile as unknown as { streak?: number; total_days?: number; totalDays?: number }) || {};
    return {
      username: profile?.name || 'Friend',
      points: profile?.points ?? 0,
      level: getKidLevelTitle(profile?.level ?? 1),
      streak: extras.streak ?? 0,
      totalDaysLearned: extras.total_days ?? extras.totalDays ?? 0,
    };
  }, [profile]);

  const progressBlock = <PointsSummaryWidget />;

  // ---------------------------------------------------------------------------
  // Younger mode: brand-first, visual, low-text.
  // ---------------------------------------------------------------------------
  if (isYounger) {
    return (
      <div className="page-canvas">
        <SurveyPopup />
        <RamadanPopup />
        <div className="page-wrap space-y-6">
          <WhatsNew />
          <RecordAndEarnBanner />
          <section className="hero-panel stagger-in">
            <div className="relative flex flex-col items-center gap-5 px-5 py-8 text-center md:flex-row md:items-center md:justify-between md:text-left">
              <div className="space-y-3">
                <p className="font-heading text-4xl font-extrabold tracking-tight text-teal-900 md:text-5xl">
                  Kids Zone
                </p>
                <p className="text-lg font-semibold text-sand-800">
                  Assalamu Alaikum, <span className="text-gradient-warm">{user.username}</span>!
                </p>
                <p className="mx-auto max-w-md text-sm text-sand-600 md:mx-0">
                  Play, learn, and grow — one fun activity at a time.
                </p>
                <div className="flex flex-wrap justify-center gap-3 pt-1 md:justify-start">
                  <Link
                    href="/quiz"
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-teal-800 px-6 py-3.5 text-base font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    <BookOpen size={20} /> Start Quiz
                  </Link>
                  <Link
                    href="/studio"
                    className="inline-flex items-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-3.5 text-base font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    <Mic size={20} /> Record &amp; Earn
                  </Link>
                  <Link
                    href="/games"
                    className="inline-flex items-center gap-2 rounded-2xl border-2 border-teal-200 bg-white px-6 py-3.5 text-base font-bold text-sand-900 transition hover:bg-teal-50"
                  >
                    <Gamepad2 size={20} /> Play Games
                  </Link>
                </div>
                <p className="pt-1 text-sm">
                  <Link href="/donations" className="font-semibold text-teal-700 underline-offset-2 hover:underline">
                    Log sadaqah
                  </Link>
                </p>
              </div>
              <Mascot mood="wave" size="md" message={`You have ${user.points} points. Let's learn today!`} />
            </div>
          </section>

          {progressBlock}

          <ComeBackNudge />

          <RamadanModeCard />

          <div id="daily-missions">
            <DailyMissions />
          </div>

          <WeeklyChallengeCard />

          <FeatureDiscover variant="younger" />

          <DailyAyahCard compact />

          <StreakCalendar compact />

          <section className="feature-tile rounded-3xl border-[#7c3aed]/20 bg-[#f5f3ff] p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#7c3aed]">
                <span className="text-2xl">💡</span>
              </div>
              <div>
                <div className="mb-1 flex items-center gap-2">
                  <h4 className="font-bold text-[#6d28d9]">Today&apos;s Tip</h4>
                  <ReadAloudButton text={TIP_TEXT} label="" size="sm" />
                </div>
                <p className="kid-text text-[#5b21b6]">
                  Learn one new thing about Islam every day. One verse or one hadith is a great start!
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Older mode: brand-first hero, then progress, then Explore Kids Zone.
  // ---------------------------------------------------------------------------
  return (
    <div className="page-canvas">
      <SurveyPopup />
      <RamadanPopup />
      <div className="page-wrap space-y-7">
        <WhatsNew />
        <RecordAndEarnBanner />
        <section className="hero-panel stagger-in">
          <div className="relative px-6 py-9 md:px-10 md:py-11">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center md:justify-between">
              <div className="max-w-xl space-y-3">
                <p className="font-heading text-4xl font-extrabold tracking-tight text-teal-900 md:text-5xl lg:text-6xl">
                  Kids Zone
                </p>
                <p className="text-lg font-semibold text-sand-800 md:text-xl">
                  Assalamu Alaikum, <span className="text-gradient-warm">{user.username}</span>
                </p>
                <p className="max-w-lg text-base text-sand-600 md:text-lg">
                  Your Islamic learning hub — quizzes, games, Quran, deeds, and rewards in one place.
                </p>
                <div className="flex flex-wrap gap-3 pt-1">
                  <Link
                    href="/quiz"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-teal-600 to-teal-800 px-6 py-3 font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    <BookOpen size={20} />
                    Daily Quiz
                  </Link>
                  <Link
                    href="/studio"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-700 px-6 py-3 font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
                  >
                    <Mic size={20} />
                    Record &amp; Earn
                  </Link>
                  <Link
                    href="/games"
                    className="inline-flex items-center gap-2 rounded-xl border-2 border-teal-200 bg-white px-6 py-3 font-bold text-sand-900 transition hover:bg-teal-50"
                  >
                    <Gamepad2 size={20} />
                    Play Games
                  </Link>
                </div>
                <p className="text-sm text-sand-600">
                  <Link
                    href="/donations"
                    className="inline-flex items-center gap-1.5 font-semibold text-teal-700 underline-offset-2 hover:underline"
                  >
                    <Coins size={14} />
                    Kids Sadaqah
                  </Link>
                </p>
              </div>

              <div className="flex-shrink-0 self-center">
                <Mascot mood="happy" size="md" />
              </div>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-4 stagger-in md:grid-cols-4">
          {[
            { icon: Star, label: 'Points', value: user.points, color: 'text-[#f59e0b]', bg: 'bg-[#fffbeb]' },
            { icon: Target, label: 'Level', value: user.level, color: 'text-[#7c3aed]', bg: 'bg-[#f5f3ff]' },
            { icon: Zap, label: 'Streak', value: `${user.streak || 0} days`, color: 'text-[#ff6b6b]', bg: 'bg-[#fff5f5]' },
            {
              icon: Trophy,
              label: 'Days Learning',
              value: user.totalDaysLearned || 0,
              color: 'text-[#8b5cf6]',
              bg: 'bg-[#eef2ff]',
            },
          ].map((stat) => (
            <div key={stat.label} className={`${stat.bg} stat-pill p-5`}>
              <div className="flex items-center gap-3">
                <div className={`rounded-xl bg-white p-2 ${stat.color}`}>
                  <stat.icon size={20} />
                </div>
                <div>
                  <p className="text-2xl font-bold text-[#1e1b4b]">{stat.value}</p>
                  <p className="text-sm text-[#475569]">{stat.label}</p>
                </div>
              </div>
            </div>
          ))}
        </section>

        <PointsSummaryWidget />

        <ComeBackNudge />

        <RamadanModeCard />

        <div id="daily-missions">
          <DailyMissions />
        </div>

        <WeeklyChallengeCard />

        <FeatureDiscover variant="older" />

        <DailyAyahCard />

        <AchievementGrid compact />

        <ReferralTokenHub />

        <KidsZoneFeatureLab />

        <section className="feature-tile rounded-3xl border-teal-200 bg-gradient-to-br from-teal-50 via-white to-emerald-50 p-6">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.18em] text-teal-800">
                <Sparkles size={14} /> Monthly Featured Quiz
              </div>
              <h2 className="mt-3 text-2xl font-black text-[#4c1d95] md:text-3xl">Masjid Al-Aqsa Quiz Competition</h2>
              <p className="mt-2 text-sm leading-6 text-[#5b21b6] md:text-base">
                This month&apos;s featured contest is a written Islamic quiz on Masjid Al-Aqsa. Submit once, wait for
                admin review, and winners will receive cash prizes at the end of the month.
              </p>
            </div>
            <Link
              href="/competitions/masjid-al-aqsa"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-lg transition hover:from-teal-500 hover:to-emerald-500"
            >
              <Trophy size={18} /> Enter Quiz
            </Link>
          </div>
        </section>

        <section className="feature-tile rounded-2xl border-[#7c3aed]/20 bg-[#f5f3ff] p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#7c3aed]">
              <span className="text-2xl">💡</span>
            </div>
            <div>
              <div className="mb-1 flex items-center gap-2">
                <h4 className="font-bold text-[#6d28d9]">Learning Tip</h4>
                <ReadAloudButton text={TIP_TEXT} label="" size="sm" />
              </div>
              <p className="text-[#5b21b6]">
                Try to learn something new about Islam every day, even if it&apos;s just one verse or one hadith.
                Consistency is the key to building lasting knowledge. May Allah bless your journey!
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
