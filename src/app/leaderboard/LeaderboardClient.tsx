'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { Trophy, Crown, Medal, Award, Sparkles, Star } from 'lucide-react';

type Entry = {
  uid: string;
  name: string;
  madrasahName?: string;
  level: number;
  points: number;
  weeklyPoints?: number;
  monthlyPoints?: number;
  badges?: number;
  lastPlayedDate?: string | null;
  winnerTick?: boolean;
  weeklyChallengeDone?: boolean;
};

const POLICY_POPUP_KEY = 'leaderboard_policy_popup_v1';

export default function LeaderboardClient() {
  const activeTab: 'weekly' = 'weekly';
  const [entries, setEntries] = useState<Entry[]>([]);
  const [weeklyChallenge, setWeeklyChallenge] = useState<{ remaining: number; qualifiedForDraw: boolean } | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPolicyPopup, setShowPolicyPopup] = useState(false);
  const [popupMounted, setPopupMounted] = useState(false);
  const { profile } = useAuth();
  const fetchAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setPopupMounted(true);
    if (typeof window !== 'undefined' && !sessionStorage.getItem(POLICY_POPUP_KEY)) {
      setShowPolicyPopup(true);
    }
  }, []);

  const dismissPolicyPopup = () => {
    sessionStorage.setItem(POLICY_POPUP_KEY, '1');
    setShowPolicyPopup(false);
  };

  const loadLeaderboard = useCallback(async (opts?: { soft?: boolean }) => {
    if (!opts?.soft) setLoading(true);
    try {
      fetchAbortRef.current?.abort();
      const controller = new AbortController();
      fetchAbortRef.current = controller;

      const res = await fetch(`/api/leaderboard/public?tab=${activeTab}&t=${Date.now()}`, { cache: 'no-store', signal: controller.signal });
      const json = await res.json();

      if (!res.ok || !Array.isArray(json.entries)) return;

      setEntries(json.entries as Entry[]);
    } catch (err) {
      const isAbort = (err as any)?.name === 'AbortError';
      if (!isAbort) console.error('Leaderboard load error:', err);
    } finally {
      if (!opts?.soft) setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    loadLeaderboard();
  }, [loadLeaderboard]);

  useEffect(() => {
    let active = true;

    const loadWeeklyChallenge = async () => {
      const userId = String(profile?.uid || '').trim();
      if (!userId) {
        setWeeklyChallenge(null);
        return;
      }

      try {
        const res = await fetch(`/api/rewards/weekly-activities?userId=${userId}`, { cache: 'no-store' });
        const json = await res.json();
        if (!active || !res.ok) return;
        setWeeklyChallenge({
          remaining: Number(json.remaining || 0),
          qualifiedForDraw: Boolean(json.qualifiedForDraw),
        });
      } catch {
        if (active) setWeeklyChallenge(null);
      }
    };

    loadWeeklyChallenge();
    return () => {
      active = false;
    };
  }, [profile?.uid]);

  useEffect(() => {
    const channel = supabase
      .channel('leaderboard-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users_points' }, () => {
        loadLeaderboard({ soft: true });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadLeaderboard]);

  const leaderboardData = useMemo(() => {
    return entries.map((entry, index) => ({
      rank: index + 1,
      username: entry.name,
      madrasahName: entry.madrasahName || '',
      level: entry.level,
      points: entry.weeklyPoints ?? 0,
      uid: entry.uid,
      badges: entry.badges ?? 0,
      lastPlayedDate: entry.lastPlayedDate ?? null,
      winnerTick: entry.winnerTick ?? false,
      weeklyChallengeDone: entry.weeklyChallengeDone ?? false,
    }));
  }, [entries]);

  const formatPlayedDate = (isoDate: string | null | undefined) => {
    if (!isoDate) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate.trim());
    if (!m) return isoDate;
    const y = m[1];
    const mm = parseInt(m[2], 10);
    const dd = parseInt(m[3], 10);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const mon = months[mm - 1] || m[2];
    return `${dd} ${mon} ${y}`;
  };

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Crown size={24} className="text-[#fbbf24]" />;
    if (rank === 2) return <Medal size={24} className="text-gray-400" />;
    if (rank === 3) return <Award size={24} className="text-[#cd9456]" />;
    return <span className="text-[#a1633a] font-bold">#{rank}</span>;
  };

  const getRankStyle = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-br from-[#fbbf24] to-[#f59e0b] text-white';
    if (rank === 2) return 'bg-gradient-to-br from-gray-300 to-gray-400 text-white';
    if (rank === 3) return 'bg-gradient-to-br from-[#cd9456] to-[#a1633a] text-white';
    return 'bg-white text-[#6a422d]';
  };

  return (
    <>
      {popupMounted && showPolicyPopup && createPortal(
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm px-4" role="dialog" aria-modal="true">
          <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl border border-amber-200">
            <div className="mb-4 flex items-center gap-3">
              <span className="text-3xl">🏆</span>
              <h2 className="text-lg font-bold text-[#6a422d]">Weekly Points Update</h2>
            </div>
            <ul className="space-y-2 text-sm text-[#6a422d]">
              <li className="flex items-start gap-2"><span className="text-amber-500 font-bold mt-0.5">•</span><span>Weekly points are <strong>capped at 400</strong> per week.</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-500 font-bold mt-0.5">•</span><span>Anyone who reached <strong>400 points has been reset to 300</strong>, so there are 100 points left to earn this week.</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-500 font-bold mt-0.5">•</span><span>Weekly points are reset manually by admin. Keep playing to stay on top!</span></li>
              <li className="flex items-start gap-2"><span className="text-amber-500 font-bold mt-0.5">•</span><span>To get a star and to enter prize draw stay active and get 300 points weekly.</span></li>
            </ul>
            <button
              onClick={dismissPolicyPopup}
              className="mt-5 w-full rounded-xl bg-gradient-to-r from-[#14b8a6] to-[#0d9488] py-3 text-white font-bold hover:opacity-90 transition"
            >
              Got it!
            </button>
          </div>
        </div>,
        document.body
      )}
      <div className="min-h-screen bg-[#fdf8f3] pattern-islamic">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#fffbeb] rounded-full border border-[#fbbf24]/30">
            <Trophy size={16} className="text-[#f59e0b]" />
            <span className="text-sm font-semibold text-[#b45309]">Competition Leaderboard</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-[#6a422d]">Leaderboard</h1>
          <p className="text-[#a1633a] text-lg">See who is leading this week</p>
        </div>

        <div className="bg-gradient-to-r from-[#ecfeff] to-[#f0fdfa] border border-[#14b8a6]/30 rounded-2xl p-5 text-center">
          <p className="text-[#0f766e] font-bold text-base md:text-lg">
            New winner will be announced every Friday.
          </p>
          <p className="text-[#115e59] mt-2 text-sm md:text-base">
            Please continue taking part every day to win prizes.
          </p>
        </div>

        <div className="text-center">
          <a
            href="https://chat.whatsapp.com/E7bJY8Hz5lEEDscBXKtsSM?mode=gi_t"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl border border-[#14b8a6]/30 bg-[#f0fdfa] px-4 py-3 text-sm font-bold text-[#0d9488] hover:bg-[#ccfbf1] transition"
          >
            Join kids zone group on whatsapp to stay updated
          </a>
        </div>

        {weeklyChallenge ? (
          <div className={`rounded-2xl border p-5 text-center ${weeklyChallenge.qualifiedForDraw ? 'border-amber-200 bg-amber-50' : 'border-teal-200 bg-teal-50'}`}>
            <p className="font-bold text-base md:text-lg text-[#6a422d]">
              {weeklyChallenge.qualifiedForDraw
                ? 'You finished all 5 weekly activities. Your leaderboard name gets a star.'
                : `You have ${weeklyChallenge.remaining} activit${weeklyChallenge.remaining === 1 ? 'y' : 'ies'} left to get your leaderboard star.`}
            </p>
          </div>
        ) : null}

        {loading && (
          <div className="bg-white rounded-2xl shadow-lg border border-[#e5c9a3]/30 p-8">
            <div className="h-6 w-48 bg-[#f9f0e6] rounded mb-6 animate-pulse" />
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-[#f9f0e6] rounded animate-pulse" />)}
            </div>
          </div>
        )}

        {!loading && leaderboardData.length === 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-[#e5c9a3]/30 p-8 text-center">
            <Trophy size={48} className="mx-auto mb-4 text-[#e5c9a3]" />
            <p className="text-[#6a422d] font-semibold">No entries yet</p>
            <p className="text-[#a1633a]">Start earning points to appear on the leaderboard!</p>
          </div>
        )}

        {!loading && leaderboardData.length > 0 && (
          <div className="bg-white rounded-2xl shadow-lg border border-[#e5c9a3]/30 overflow-hidden">
            <div className="p-6 bg-gradient-to-r from-[#14b8a6] to-[#0d9488] text-white">
              <h2 className="text-xl font-bold">Weekly Rankings</h2>
              <p className="text-sm text-white/80">Reset manually by admin</p>
            </div>

            <div className="divide-y divide-[#e5c9a3]/20">
              {leaderboardData.map((entry) => (
                <div
                  key={entry.rank}
                  className={`flex items-center gap-4 p-4 transition hover:bg-[#f9f0e6]/50 ${entry.uid === profile?.uid ? 'bg-[#f0fdfa]/50' : ''}`}
                >
                  <div className="w-10 text-center font-bold text-[#a1633a]">#{entry.rank}</div>
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#fbbf24] to-[#f59e0b] flex items-center justify-center text-xl">
                    🌍
                  </div>
                  <div className="flex-1">
                    <p className="font-bold text-[#6a422d] inline-flex items-center gap-2">
                      <span>{entry.username}</span>
                      {entry.winnerTick ? <span aria-label="Winner" className="text-emerald-600">✓</span> : null}
                      {entry.weeklyChallengeDone ? <span aria-label="Weekly challenge complete" className="text-amber-500">⭐</span> : null}
                    </p>
                    {!entry.weeklyChallengeDone ? (
                      <p className="text-xs text-[#0f766e]">To get a star and to enter prize draw stay active and get 300 points weekly.</p>
                    ) : null}
                    <p className="text-xs text-[#a1633a]">Madrasah: {entry.madrasahName || ''}</p>
                    <p className="text-sm text-[#a1633a]">Level {entry.level}</p>
                    {formatPlayedDate(entry.lastPlayedDate) ? <p className="text-xs text-[#a1633a]">Played: {formatPlayedDate(entry.lastPlayedDate)}</p> : null}
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-[#f59e0b]">{entry.points}</p>
                    <p className="text-sm text-[#a1633a]">{entry.badges}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="bg-gradient-to-r from-[#14b8a6] to-[#0d9488] rounded-2xl p-6 text-white">
          <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
            <Star size={20} /> Your Ranking
          </h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-sm text-white/80 mb-1">Your Rank</p>
              <p className="text-3xl font-bold">
                {profile?.uid
                  ? (() => {
                      const idx = leaderboardData.findIndex((entry) => entry.uid === profile.uid);
                      return idx >= 0 ? `#${idx + 1}` : '—';
                    })()
                  : '—'}
              </p>
            </div>
            <div className="bg-white/10 rounded-xl p-4 text-center">
              <p className="text-sm text-white/80 mb-1">Your Points</p>
              <p className="text-3xl font-bold">
                {profile?.uid ? (profile?.weeklyPoints ?? profile?.points ?? 0) : '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#f0fdfa] rounded-2xl p-6 border border-[#14b8a6]/20">
          <h4 className="font-bold text-[#0d9488] mb-3 flex items-center gap-2">
            <Sparkles size={18} /> Tips to Climb the Leaderboard
          </h4>
          <ul className="space-y-2 text-[#115e59] text-sm">
            <li className="flex items-start gap-2">
              <span className="text-[#14b8a6]">✓</span> Complete the daily quiz every day
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#14b8a6]">✓</span> Play games to earn bonus points
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#14b8a6]">✓</span> Log your Durood and Zikr regularly
            </li>
            <li className="flex items-start gap-2">
              <span className="text-[#14b8a6]">✓</span> Maintain your daily streak for bonuses
            </li>
          </ul>
        </div>
      </div>
    </div>
    </>
  );
}