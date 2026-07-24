'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { getAuthFetchHeaders, authJsonFetch } from '@/lib/auth-headers';
import { nativeStepsSupported, readNativeSteps, requestStepPermission } from '@/lib/step-source';
import { startFitnessUpdates } from '@/lib/fitness-tracker';
import {
  Footprints,
  Flame,
  MapPin,
  Clock,
  Trophy,
  Star,
  Loader2,
  RefreshCw,
  CheckCircle2,
  PartyPopper,
  Award,
  ShieldCheck,
  Smartphone,
} from 'lucide-react';

interface FitnessStatus {
  challenge: { id: string; name: string; goalType: 'steps' | 'minutes'; goalTarget: number; points: number } | null;
  today: { steps: number; minutes: number; distanceM: number; calories: number; goalMet: boolean; pointsAwarded: number };
  currentStreak: number;
  weekSteps: number;
  monthSteps: number;
  lifetimeSteps: number;
  totalPoints: number;
  badges: string[];
  achievements: { key: string; label: string; emoji: string; earned: boolean }[];
  tableMissing?: boolean;
}

function StatCard({ icon, label, value, tint }: { icon: React.ReactNode; label: string; value: string; tint: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${tint}`}>
      <div className="flex items-center gap-2 text-sm font-semibold text-[#475569]">
        {icon} {label}
      </div>
      <p className="mt-1 text-2xl font-black text-[#1e1b4b]">{value}</p>
    </div>
  );
}

export default function FitnessPage() {
  const { user, loading: authLoading } = useAuth();
  const [status, setStatus] = React.useState<FitnessStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [syncing, setSyncing] = React.useState(false);
  const [requestingPermission, setRequestingPermission] = React.useState(false);
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [nativeSupported, setNativeSupported] = React.useState(false);
  const [justCompleted, setJustCompleted] = React.useState(false);
  const [liveSteps, setLiveSteps] = React.useState<number | null>(null);
  const [trackerMessage, setTrackerMessage] = React.useState('');

  const pushSteps = React.useCallback(async (total: number, source: string, showToast = false) => {
    try {
      const headers = await getAuthFetchHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch('/api/fitness/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ steps: Math.round(total), source }),
      });
      const json = await res.json();
      if (res.ok && json.status) {
        setStatus(json.status as FitnessStatus);
        if (json.newlyAwardedPoints > 0) {
          setJustCompleted(true);
          setMessage(`MashaAllah! +${json.newlyAwardedPoints} points for completing today\u2019s challenge!`);
        } else if (showToast) {
          setMessage('Steps synced!');
        }
      }
    } catch {
      /* offline — will sync on the next tick */
    }
  }, []);

  const loadStatus = React.useCallback(async () => {
    try {
      const res = await authJsonFetch('/api/fitness/status');
      const json = await res.json();
      if (res.ok) setStatus(json as FitnessStatus);
      else setError(json?.error || 'Could not load your activity.');
    } catch {
      setError('Could not load your activity.');
    } finally {
      setLoading(false);
    }
  }, []);

  const sync = React.useCallback(async (showToast = true) => {
    setSyncing(true);
    if (showToast) {
      setMessage('');
      setError('');
    }
    try {
      const reading = await readNativeSteps();
      if (!reading) {
        if (showToast) {
          setError('Open Kids Zone in the mobile app and allow motion access to count steps.');
        }
        return;
      }
      setLiveSteps(reading.steps);
      const headers = await getAuthFetchHeaders({ 'Content-Type': 'application/json' });
      const res = await fetch('/api/fitness/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ steps: reading.steps, minutes: reading.minutes, source: reading.source }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Sync failed');
      if (json.status) setStatus(json.status as FitnessStatus);
      if (json.newlyAwardedPoints > 0 || json.goalMet) setJustCompleted(true);
      if (json.newlyAwardedPoints > 0) {
        setMessage(`MashaAllah! +${json.newlyAwardedPoints} points for completing today\u2019s challenge!`);
      } else if (showToast) {
        setMessage('Steps synced!');
      }
    } catch (e) {
      if (showToast) setError(e instanceof Error ? e.message : 'Sync failed');
    } finally {
      setSyncing(false);
    }
  }, []);

  const requestPermissionAndSync = React.useCallback(async () => {
    setRequestingPermission(true);
    setError('');
    try {
      const granted = await requestStepPermission();
      if (!granted) {
        setError('Motion access was not allowed. Enable it in your phone settings to count steps.');
        return;
      }
      await sync(true);
    } finally {
      setRequestingPermission(false);
    }
  }, [sync]);

  React.useEffect(() => {
    if (authLoading || !user) {
      if (!authLoading) setLoading(false);
      return;
    }

    const supported = nativeStepsSupported();
    setNativeSupported(supported);
    void loadStatus();

    if (!supported) return;

    let disposed = false;
    let stopUpdates: (() => Promise<void>) | null = null;

    void requestStepPermission()
      .then((granted) => {
        if (disposed) return;
        if (granted) {
          setTrackerMessage('Counting steps from your phone sensor…');
          return sync(false);
        }
        setTrackerMessage('Allow motion access to start counting steps.');
      })
      .catch(() => {
        if (!disposed) setTrackerMessage('Could not start the step counter.');
      });

    void startFitnessUpdates((measurement) => {
      if (disposed) return;
      setLiveSteps(measurement.steps);
      void pushSteps(measurement.steps, 'pedometer');
    })
      .then((cleanup) => {
        if (disposed) {
          void cleanup();
          return;
        }
        stopUpdates = cleanup;
      })
      .catch(() => {
        if (!disposed) setTrackerMessage('Live updates paused — tap Sync to refresh your step count.');
      });

    const intervalId = window.setInterval(() => {
      void sync(false);
    }, 15000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      if (stopUpdates) void stopUpdates();
    };
  }, [authLoading, user, loadStatus, sync, pushSteps]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[#f5f3ff] pattern-islamic">
        <div className="mx-auto max-w-md px-4 py-16 text-center">
          <Loader2 className="mx-auto animate-spin text-[#7c3aed]" size={32} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-[#f5f3ff] pattern-islamic">
        <div className="mx-auto max-w-md px-4 py-16">
          <div className="rounded-3xl border border-amber-300 bg-amber-50 p-8 text-center">
            <Footprints className="mx-auto text-amber-500" size={36} />
            <p className="mt-2 font-bold text-amber-800">Sign in to join the Fitness Challenge</p>
            <Link href="/signin?next=/fitness" className="mt-3 inline-block rounded-xl bg-[#7c3aed] px-5 py-2.5 font-bold text-white">Sign in</Link>
          </div>
        </div>
      </div>
    );
  }

  const challenge = status?.challenge;
  const today = status?.today;
  const displaySteps = Math.max(today?.steps ?? 0, liveSteps ?? 0);
  const progressCurrent = challenge
    ? challenge.goalType === 'minutes'
      ? today?.minutes ?? 0
      : displaySteps
    : 0;
  const progressPct = challenge && challenge.goalTarget > 0 ? Math.min(100, Math.round((progressCurrent / challenge.goalTarget) * 100)) : 0;
  const distanceKm = ((today?.distanceM ?? 0) / 1000).toFixed(2);

  return (
    <div className="min-h-screen bg-[#f5f3ff] pattern-islamic">
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <div className="text-center">
          <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-3xl bg-gradient-to-br from-[#16a34a] to-[#15803d] text-3xl text-white shadow-lg">🏃</div>
          <h1 className="mt-2 text-4xl font-black text-[#1e1b4b] md:text-5xl">Kids Fitness Challenge</h1>
          <p className="text-lg text-[#475569]">Walk every day, earn points, and climb the leaderboard!</p>
        </div>

        {status?.tableMissing ? (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 p-5 text-center text-amber-800">
            The Fitness Challenge isn&apos;t set up yet. Please check back soon!
          </div>
        ) : (
          <>
            <div className="overflow-hidden rounded-3xl border border-[#c4b5fd]/40 bg-gradient-to-br from-[#4c1d95] via-[#6d28d9] to-[#7c3aed] p-6 text-white shadow-lg">
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-200">Today&apos;s challenge</p>
              <p className="mt-1 text-2xl font-black">{challenge ? challenge.name : 'No active challenge'}</p>
              {challenge ? (
                <>
                  <div className="mt-3 h-4 w-full overflow-hidden rounded-full bg-white/20">
                    <div className="h-full rounded-full bg-gradient-to-r from-amber-300 to-emerald-300 transition-all" style={{ width: `${progressPct}%` }} />
                  </div>
                  <p className="mt-2 text-sm text-violet-100">
                    {progressCurrent.toLocaleString()} / {challenge.goalTarget.toLocaleString()} {challenge.goalType} · worth {challenge.points} points
                  </p>
                  {today?.goalMet ? (
                    <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/30 px-3 py-1 text-sm font-bold text-white">
                      <CheckCircle2 size={15} /> Completed today {today.pointsAwarded > 0 ? `(+${today.pointsAwarded} pts)` : ''}
                    </p>
                  ) : null}
                </>
              ) : null}
            </div>

            {justCompleted && today?.goalMet ? (
              <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50 p-4 text-center">
                <PartyPopper className="mx-auto text-emerald-500" size={28} />
                <p className="mt-1 font-black text-emerald-800">Challenge complete — great walking! 🎉</p>
              </div>
            ) : null}

            {message ? <p className="rounded-xl bg-emerald-50 px-4 py-2 text-center text-sm font-semibold text-emerald-700">{message}</p> : null}
            {error ? <p className="rounded-xl bg-rose-50 px-4 py-2 text-center text-sm font-semibold text-rose-700">{error}</p> : null}

            <div className="rounded-2xl border border-[#c4b5fd]/40 bg-white p-4 text-center shadow">
              {nativeSupported ? (
                <div className="space-y-3">
                  <p className="font-bold text-[#1e1b4b]">🚶 Phone step counter</p>
                  <p className="text-4xl font-black text-[#16a34a] tabular-nums">{displaySteps.toLocaleString()}</p>
                  <p className="text-xs text-[#64748b]">
                    {trackerMessage || 'Steps update automatically while this page is open.'}
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => void sync(true)}
                      disabled={syncing}
                      className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-[#16a34a] to-[#15803d] px-6 py-3 font-bold text-white shadow-lg transition hover:-translate-y-0.5 disabled:opacity-50"
                    >
                      {syncing ? <Loader2 size={18} className="animate-spin" /> : <RefreshCw size={18} />}
                      {syncing ? 'Syncing steps…' : 'Sync my steps'}
                    </button>
                    <button
                      type="button"
                      onClick={() => void requestPermissionAndSync()}
                      disabled={requestingPermission}
                      className="inline-flex items-center gap-2 rounded-xl border border-emerald-200 bg-white px-5 py-3 font-bold text-emerald-800 shadow-sm transition hover:bg-emerald-50 disabled:opacity-50"
                    >
                      <ShieldCheck size={18} />
                      {requestingPermission ? 'Requesting…' : 'Allow motion access'}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="text-sm text-[#475569]">
                  <div className="mx-auto mb-3 flex justify-center">
                    <Smartphone className="text-amber-500" size={28} />
                  </div>
                  <p className="font-bold text-[#1e1b4b]">Step tracking is app-only</p>
                  <p className="mt-1">
                    The Fitness Challenge reads steps from your phone&apos;s built-in motion sensor inside
                    the Kids Zone mobile app. It cannot count steps in a normal browser on desktop or mobile web.
                  </p>
                  <p className="mt-2 text-xs font-semibold text-amber-700">
                    Sign in to the app on your phone and allow motion access to join the challenge.
                  </p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={<Footprints size={15} />} label="Steps today" value={displaySteps.toLocaleString()} tint="border-emerald-200 bg-emerald-50" />
              <StatCard icon={<Clock size={15} />} label="Minutes" value={String(today?.minutes ?? 0)} tint="border-sky-200 bg-sky-50" />
              <StatCard icon={<Flame size={15} />} label="Calories" value={String(today?.calories ?? 0)} tint="border-orange-200 bg-orange-50" />
              <StatCard icon={<MapPin size={15} />} label="Distance" value={`${distanceKm} km`} tint="border-violet-200 bg-violet-50" />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatCard icon={<Flame size={15} />} label="Day streak" value={`${status?.currentStreak ?? 0} 🔥`} tint="border-rose-200 bg-rose-50" />
              <StatCard icon={<Footprints size={15} />} label="This week" value={(status?.weekSteps ?? 0).toLocaleString()} tint="border-teal-200 bg-teal-50" />
              <StatCard icon={<Star size={15} />} label="Lifetime steps" value={(status?.lifetimeSteps ?? 0).toLocaleString()} tint="border-indigo-200 bg-indigo-50" />
              <StatCard icon={<Trophy size={15} />} label="Fitness points" value={(status?.totalPoints ?? 0).toLocaleString()} tint="border-amber-200 bg-amber-50" />
            </div>

            <div className="rounded-3xl border border-[#c4b5fd]/40 bg-white p-6 shadow">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-black text-[#1e1b4b]">
                <Award size={20} className="text-amber-500" /> Achievements
              </h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {(status?.achievements || []).map((a) => (
                  <div
                    key={a.key}
                    className={`rounded-2xl border p-3 text-center ${a.earned ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-slate-50 opacity-60'}`}
                  >
                    <div className="text-3xl">{a.earned ? a.emoji : '🔒'}</div>
                    <p className="mt-1 text-xs font-bold text-[#1e1b4b]">{a.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center">
              <Link href="/fitness/leaderboard" className="inline-flex items-center gap-2 rounded-xl border border-[#7c3aed]/30 bg-white px-5 py-3 font-bold text-[#6d28d9] shadow-sm transition hover:bg-[#f5f3ff]">
                <Trophy size={18} /> Fitness Leaderboard
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
