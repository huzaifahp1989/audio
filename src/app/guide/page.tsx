'use client';

import React from 'react';
import Link from 'next/link';
import { ReadAloudButton } from '@/components/ReadAloudButton';
import { FadeUp, Reveal, Stagger, StaggerItem } from '@/components/Motion';
import {
  ACTIVITY_BONUS_POINTS,
  DAILY_EARNING_PLAN,
  DAILY_PLAN_TOTAL_POINTS,
  MAX_DAILY_GAME_COMPLETIONS,
  MAX_DAILY_GAME_POINTS,
  MAX_DAILY_QUIZ_ATTEMPTS,
  MAX_DAILY_QUIZ_POINTS,
  POINTS_DAILY_CAP,
  QUIZ_POINTS_PER_COMPLETION,
} from '@/lib/points-policy';
import {
  BookOpen,
  Gamepad2,
  Gift,
  Heart,
  HelpCircle,
  Shield,
  Sparkles,
  Star,
  Trophy,
  Zap,
} from 'lucide-react';

const activityMeta: Record<
  string,
  { description: string; cta: string; emoji: string; color: string }
> = {
  quiz: {
    description: 'Pick a topic, answer 5 questions, and complete the quiz to earn points. Questions match your age band.',
    cta: 'Take a quiz',
    emoji: '🧠',
    color: 'from-violet-500 to-purple-600',
  },
  game: {
    description: 'Play hangman, memory match, word scramble, and more — finish a full session to earn points.',
    cta: 'Play games',
    emoji: '🎮',
    color: 'from-amber-500 to-orange-600',
  },
  story_quiz: {
    description: 'Read an age-matched story, then finish the 3-question mini-quiz (once per day).',
    cta: 'Read a story',
    emoji: '📚',
    color: 'from-sky-500 to-blue-600',
  },
  durood: {
    description: 'Log your durood recitations on the pledge page after you have recited at least 5 times.',
    cta: 'Pledge Durood',
    emoji: '📿',
    color: 'from-rose-500 to-pink-600',
  },
  zikr: {
    description: 'Track SubhanAllah, Alhamdulillah, Allahu Akbar, and other zikr — log at least 5 to earn points.',
    cta: 'Log Zikr',
    emoji: '🤲',
    color: 'from-teal-500 to-emerald-600',
  },
  hadith: {
    description: 'Read hadith and answer reflection questions for your age group.',
    cta: 'Learn Hadith',
    emoji: '📖',
    color: 'from-cyan-500 to-teal-600',
  },
  salah: {
    description: 'Log all 5 daily prayers (Fajr, Dhuhr, Asr, Maghrib, Isha) on the Salah tracker.',
    cta: 'Track Salah',
    emoji: '🕌',
    color: 'from-indigo-500 to-violet-600',
  },
  arabic: {
    description: 'Browse Arabic words and meanings, then finish today’s Arabic Learning activity.',
    cta: 'Learn Arabic',
    emoji: '🔤',
    color: 'from-lime-500 to-green-600',
  },
  creative: {
    description: 'Colour, draw, offline printables, or create art in Create & Play — claim once per day.',
    cta: 'Create & Play',
    emoji: '🎨',
    color: 'from-fuchsia-500 to-pink-600',
  },
  story_choice: {
    description: 'Pick good choices in a short story adventure and finish for points.',
    cta: 'Start adventure',
    emoji: '🗺️',
    color: 'from-orange-500 to-amber-600',
  },
  dua: {
    description: 'Read the dua of the day, say it out loud, and mark it done for points.',
    cta: 'Dua of the day',
    emoji: '🕌',
    color: 'from-emerald-500 to-teal-600',
  },
  kindness: {
    description: 'Complete a kindness scavenger hunt — tick kind deeds you did today.',
    cta: 'Kindness hunt',
    emoji: '💗',
    color: 'from-pink-500 to-rose-600',
  },
  manners: {
    description: 'Practise Islamic manners (salam, Bismillah, listening) and tick them off.',
    cta: 'Good manners',
    emoji: '✨',
    color: 'from-violet-500 to-purple-600',
  },
};

const earningActivities = DAILY_EARNING_PLAN.map((row) => {
  const meta = activityMeta[row.activity] ?? {
    description: `Complete ${row.title} to earn points.`,
    cta: 'Go',
    emoji: '⭐',
    color: 'from-slate-500 to-slate-700',
  };
  const maxPts = row.limit * row.pointsEach;
  return {
    title: row.title,
    points: `+${row.pointsEach} pts`,
    limit:
      row.limit === 1
        ? `Once per day (${maxPts} pts)`
        : `${row.limit} per day (${maxPts} pts)`,
    description: meta.description,
    href: row.href,
    cta: meta.cta,
    emoji: meta.emoji,
    color: meta.color,
  };
});

const dailyPlanSteps = [
  {
    label: `Take ${MAX_DAILY_QUIZ_ATTEMPTS} quizzes`,
    detail: `${QUIZ_POINTS_PER_COMPLETION} points each = ${MAX_DAILY_QUIZ_POINTS} points`,
    color: 'bg-violet-600',
  },
  {
    label: `Play ${MAX_DAILY_GAME_COMPLETIONS} games`,
    detail: `${ACTIVITY_BONUS_POINTS} points each = ${MAX_DAILY_GAME_POINTS} points`,
    color: 'bg-amber-500',
  },
  {
    label: 'Complete a story mini-quiz',
    detail: `+${ACTIVITY_BONUS_POINTS} points once per day`,
    color: 'bg-sky-500',
  },
  {
    label: 'Pledge Durood once',
    detail: `+${ACTIVITY_BONUS_POINTS} points (5+ recitations)`,
    color: 'bg-rose-500',
  },
  {
    label: 'Pledge Zikr once',
    detail: `+${ACTIVITY_BONUS_POINTS} points (5+ recitations)`,
    color: 'bg-teal-500',
  },
  {
    label: 'Complete Hadith learning',
    detail: `+${ACTIVITY_BONUS_POINTS} points once per day`,
    color: 'bg-cyan-600',
  },
  {
    label: 'Log all 5 Salah',
    detail: `+${ACTIVITY_BONUS_POINTS} points once per day`,
    color: 'bg-indigo-600',
  },
  {
    label: 'Create & Play activities',
    detail: `+${ACTIVITY_BONUS_POINTS} each (colour, story, dua, kindness, manners — once per type)`,
    color: 'bg-pink-500',
  },
];

const extraWays = [
  { label: 'Daily missions bonus', href: '/', note: 'Complete all 4 daily missions on the home page (includes a rotating Create activity)' },
  { label: 'Daily surprise box', href: '/', note: 'Open once a day for +5 pts, a sticker, or a fun tip' },
  { label: '7-day mystery box', href: '/', note: 'Be active 7 days in the score week for +15–30 pts + a badge' },
  { label: 'Sticker book', href: '/rewards', note: 'Unlock stickers from Create, quizzes, streaks, and surprises' },
  { label: 'My Gallery', href: '/create/gallery', note: 'Save colouring and drawings to show your parents' },
  { label: 'Offline Activities', href: '/create/offline', note: 'Print colouring, mazes, checklists and dua cards' },
  { label: 'Refer a friend', href: '/tasks', note: 'Share your referral link from Tasks' },
  { label: 'Story recordings', href: '/stories', note: 'Record and submit story recitations' },
  { label: 'Weekly prize draw', href: '/leaderboard', note: 'Stay active all week to qualify' },
];

export default function GuidePage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-[#fff9eb] via-white to-[#f0fdfa] px-4 py-10">
      <div className="mx-auto w-full max-w-4xl">
        <FadeUp className="mb-8 rounded-3xl border border-[#0d9488]/15 bg-white/90 p-6 shadow-xl backdrop-blur sm:p-8">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#f0fdfa] px-3 py-1 text-xs font-extrabold text-[#0f766e]">
            <Sparkles size={14} />
            Points Guide
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-black text-[#1f2937] sm:text-4xl">How to earn points</h1>
            <ReadAloudButton
              text={`How to earn points. You can earn up to ${POINTS_DAILY_CAP} points a day. Learn, play, and do good deeds. Your points help you win badges and climb the leaderboard.`}
              size="sm"
            />
          </div>
          <p className="mt-3 max-w-2xl kid-text text-slate-700">
            You can earn up to <strong>{POINTS_DAILY_CAP} points a day</strong>. Learn, play, and do good deeds.
            Your points help you win badges and climb the leaderboard.
          </p>

          <Stagger className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3" delayChildren={0.12}>
            <StaggerItem>
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-center">
                <p className="text-xs font-bold uppercase text-violet-700">Daily maximum</p>
                <p className="mt-1 text-3xl font-black text-violet-900">{POINTS_DAILY_CAP}</p>
                <p className="text-xs text-violet-700">points per day</p>
              </div>
            </StaggerItem>
            <StaggerItem>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center">
                <p className="text-xs font-bold uppercase text-amber-700">From quizzes</p>
                <p className="mt-1 text-3xl font-black text-amber-900">{MAX_DAILY_QUIZ_POINTS}</p>
                <p className="text-xs text-amber-700">{MAX_DAILY_QUIZ_ATTEMPTS} × {QUIZ_POINTS_PER_COMPLETION} pts</p>
              </div>
            </StaggerItem>
            <StaggerItem>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
                <p className="text-xs font-bold uppercase text-emerald-700">Daily plan total</p>
                <p className="mt-1 text-3xl font-black text-emerald-900">{DAILY_PLAN_TOTAL_POINTS}</p>
                <p className="text-xs text-emerald-700">plan activities (cap {POINTS_DAILY_CAP})</p>
              </div>
            </StaggerItem>
          </Stagger>
        </FadeUp>

        <Reveal className="mb-6 rounded-3xl border border-violet-200 bg-violet-50 p-6 shadow-lg">
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-violet-700">
            <Sparkles size={20} />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900">How age changes your Kids Zone</h2>
          <p className="mt-2 text-sm text-slate-700">
            Your age is required so we can show the right activities. You can also switch Younger / Older mode on your profile.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-violet-100 bg-white p-4">
              <p className="text-xs font-bold uppercase text-violet-600">Younger (≤8)</p>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                <li>Big picture home tiles and simpler copy</li>
                <li>Memory Match with fewer, larger cards</li>
                <li>Easier story quizzes and age 6–8 quiz pools</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-violet-100 bg-white p-4">
              <p className="text-xs font-bold uppercase text-violet-600">Older (9+)</p>
              <ul className="mt-2 space-y-1.5 text-sm text-slate-700">
                <li>Full dashboard with clear goals and draw progress</li>
                <li>Harder Memory Match (Arabic–English) with optional timer</li>
                <li>Reflection story quizzes and age 9–14 quiz pools</li>
              </ul>
            </div>
          </div>
        </Reveal>

        <Reveal className="mb-6 rounded-3xl border border-amber-200 bg-amber-50 p-6 shadow-lg" delay={0.05}>
          <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white text-amber-700">
            <Gift size={20} />
          </div>
          <h2 className="text-lg font-extrabold text-slate-900">How to keep coming back</h2>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            <li>Check the home near-miss card — see points left for the weekly draw and missions left for bonus.</li>
            <li>Be active on 7 different days in the score week to unlock the mystery box (+15–30 pts + a badge).</li>
            <li>Keep the family streak alive by finishing daily missions (siblings share the streak).</li>
            <li>Come back tomorrow for fresh quiz slots, game points, and another story mini-quiz.</li>
          </ul>
        </Reveal>

        <Reveal className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f0fdfa] text-[#0f766e]">
              <Zap size={20} />
            </div>
            <h2 className="text-xl font-extrabold text-slate-900">Your daily plan (up to {POINTS_DAILY_CAP} pts)</h2>
          </div>
          <ol className="space-y-3 text-sm text-slate-700">
            {dailyPlanSteps.map((step, index) => (
              <li key={step.label} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${step.color} text-xs font-black text-white`}
                >
                  {index + 1}
                </span>
                <span>
                  <strong>{step.label}</strong> — {step.detail}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-sm font-semibold text-slate-600">
            Total: {DAILY_PLAN_TOTAL_POINTS} points per day. Watch the daily bar on every page to track your progress.
          </p>
        </Reveal>

        <Stagger className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2" delayChildren={0.08}>
          {earningActivities.map((activity) => (
            <StaggerItem key={activity.title}>
              <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg h-full">
                <div className="mb-3 flex items-start justify-between gap-2">
                  <span className="text-3xl">{activity.emoji}</span>
                  <span
                    className={`rounded-full bg-gradient-to-r ${activity.color} px-3 py-1 text-xs font-black text-white`}
                  >
                    {activity.points}
                  </span>
                </div>
                <h3 className="text-lg font-extrabold text-slate-900">{activity.title}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">{activity.limit}</p>
                <p className="mt-2 text-sm text-slate-700">{activity.description}</p>
                <Link
                  href={activity.href}
                  className="mt-4 inline-flex rounded-xl bg-[#f0fdfa] px-4 py-2 text-sm font-bold text-[#0f766e] hover:bg-[#ccfbf1]"
                >
                  {activity.cta} →
                </Link>
              </div>
            </StaggerItem>
          ))}
        </Stagger>

        <Reveal className="mb-6 rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
          <div className="flex items-start gap-3">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f0fdfa] text-[#0f766e]">
              <Star size={20} />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-extrabold text-slate-900">More ways to earn</h2>
              <ul className="mt-3 space-y-3">
                {extraWays.map((item) => (
                  <li key={item.label} className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3 text-sm">
                    <Link href={item.href} className="font-bold text-[#0f766e] hover:underline">
                      {item.label}
                    </Link>
                    <p className="mt-0.5 text-slate-600">{item.note}</p>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Reveal>

        <Stagger className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2" delayChildren={0.1}>
          <StaggerItem>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg h-full">
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f0fdfa] text-[#0f766e]">
                <Trophy size={20} />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900">Badges &amp; leaderboard</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>Earn <strong>1 badge every 100 total points</strong>.</li>
                <li>Your level goes up as you collect more badges.</li>
                <li>The leaderboard shows weekly activity — rank is for fun, not who wins prizes.</li>
                <li>Earn above <strong>150 weekly points</strong> to enter the random winner draw.</li>
              </ul>
              <Link href="/leaderboard" className="mt-4 inline-flex text-sm font-bold text-[#0f766e] hover:underline">
                View leaderboard →
              </Link>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg h-full">
              <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff5f5] text-[#ff6b6b]">
                <Gift size={20} />
              </div>
              <h2 className="text-lg font-extrabold text-slate-900">Tips to maximise points</h2>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">
                <li>Sign in every day — consistency builds streaks and weekly activity.</li>
                <li>Complete daily activities to fill your {POINTS_DAILY_CAP}-point bar (pick your mix — plan can exceed the cap).</li>
                <li>Check the daily points counter at the top of each page.</li>
                <li>Complete daily missions and chase the 7-day mystery box on the home page.</li>
              </ul>
              <Link href="/rewards" className="mt-4 inline-flex text-sm font-bold text-[#0f766e] hover:underline">
                View rewards →
              </Link>
            </div>
          </StaggerItem>
        </Stagger>

        <Reveal className="mb-6 rounded-3xl border border-emerald-200 bg-emerald-50 p-6">
          <p className="text-sm font-bold text-emerald-900">Quick links to start earning</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link href="/quiz" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-emerald-100">
              <BookOpen size={16} /> Quiz
            </Link>
            <Link href="/hadith" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-emerald-100">
              Hadith
            </Link>
            <Link href="/salah" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-emerald-100">
              Salah
            </Link>
            <Link href="/stories" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-emerald-100">
              Stories
            </Link>
            <Link href="/games/memory-match" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-emerald-100">
              Memory Match
            </Link>
            <Link href="/games" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-emerald-100">
              <Gamepad2 size={16} /> Games
            </Link>
            <Link href="/pledge" className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-800 shadow-sm hover:bg-emerald-100">
              <Heart size={16} /> Pledge
            </Link>
            <Link href="/signin" className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-emerald-700">
              Sign in to earn
            </Link>
          </div>
        </Reveal>

        <Stagger className="grid grid-cols-1 gap-4 sm:grid-cols-2" delayChildren={0.08}>
          <StaggerItem>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg h-full">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f0fdfa] text-[#0f766e]">
                  <Shield size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Fair play</h2>
                  <p className="mt-2 text-sm text-slate-700">
                    Be honest, play fairly, and focus on learning. The goal is to build good habits and keep improving.
                  </p>
                </div>
              </div>
            </div>
          </StaggerItem>

          <StaggerItem>
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg h-full">
              <div className="flex items-start gap-3">
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[#fff5f5] text-[#ff6b6b]">
                  <HelpCircle size={20} />
                </div>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Need help?</h2>
                  <p className="mt-2 text-sm text-slate-700">
                    WhatsApp{' '}
                    <a className="font-bold text-[#0f766e] hover:underline" href="https://wa.me/447404644610" target="_blank" rel="noopener noreferrer">
                      07404644610
                    </a>{' '}
                    for login help or questions.
                  </p>
                </div>
              </div>
            </div>
          </StaggerItem>
        </Stagger>
      </div>
    </div>
  );
}
