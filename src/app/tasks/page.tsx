'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, ClipboardList, Copy, Mail, Mic, Send, Star, Smartphone, UserPlus, Users } from 'lucide-react';
import { Modal } from '@/components';
import { useAuth } from '@/lib/auth-context';
import { APP_STORE_LINKS, StorePlatform } from '@/lib/app-store-links';
import { openStoreReview, requestInAppReviewWithFallback } from '@/lib/in-app-review';
import { trackReferralShared } from '@/lib/analytics';

type ReferralPayload = {
  referralCode: string;
  inviteLink: string;
  successfulJoins: number;
  joinReward: {
    points: number;
    tokens: number;
  };
};

type InviteTask = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
};

function buildStorageKey(userId: string | null | undefined) {
  return `kidszone-referral-tasks:${userId || 'guest'}`;
}

type ClaimState = 'idle' | 'loading' | 'submitted' | 'already_submitted' | 'error';

export default function TasksPage() {
  const { user } = useAuth();
  const [payload, setPayload] = useState<ReferralPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [friendName, setFriendName] = useState('');
  const [friendEmail, setFriendEmail] = useState('');
  const [tasks, setTasks] = useState<InviteTask[]>([]);
  const [iosFeedback, setIosFeedback] = useState<ClaimState>('idle');
  const [androidFeedback, setAndroidFeedback] = useState<ClaimState>('idle');
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [reviewPrompting, setReviewPrompting] = useState<StorePlatform | null>(null);
  const [isReviewPopupOpen, setIsReviewPopupOpen] = useState(false);
  // Per-task referral claim state keyed by task id
  const [referralClaims, setReferralClaims] = useState<Record<string, ClaimState>>({});
  const [referralClaimMessages, setReferralClaimMessages] = useState<Record<string, string>>({});

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(buildStorageKey(user?.id));
    if (!stored) {
      setTasks([]);
      return;
    }

    try {
      const parsed = JSON.parse(stored);
      setTasks(Array.isArray(parsed) ? parsed : []);
    } catch {
      setTasks([]);
    }
  }, [user?.id]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(buildStorageKey(user?.id), JSON.stringify(tasks));
  }, [tasks, user?.id]);

  useEffect(() => {
    if (!user?.id) {
      setPayload(null);
      setLoading(false);
      setLoadError(null);
      return;
    }

    let active = true;
    const loadPayload = async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/kids-zone/referrals?userId=${user.id}`, { cache: 'no-store' });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Could not load referral details.');
        }
        if (active) setPayload(data);
      } catch (error: any) {
        if (active) {
          setPayload(null);
          setLoadError(error?.message || 'Could not load referral details.');
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPayload();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const pendingCount = tasks.length;

  const submitClaimRequest = async (
    claimType: 'feedback_ios' | 'feedback_android' | 'referral',
    setter: (s: ClaimState) => void,
    setMsg: (m: string) => void,
    notes?: string
  ) => {
    if (!user?.id) return;
    setter('loading');
    setMsg('');
    try {
      const res = await fetch('/api/tasks/request-claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, claimType, notes }),
      });
      const data = await res.json();
      if (res.status === 409) {
        setter('already_submitted');
        setMsg(data.error || 'Already submitted for review.');
        return;
      }
      if (res.status === 503) {
        setter('error');
        setMsg('Admin setup required. Please ask admin to run CREATE_PENDING_CLAIMS.sql.');
        return;
      }
      if (!res.ok) {
        setter('error');
        setMsg(data.error || 'Could not submit. Please try again.');
        return;
      }
      setter('submitted');
      setMsg(data.message || 'Submitted for admin review. Points will be added once approved.');
    } catch {
      setter('error');
      setMsg('Could not submit. Please try again.');
    }
  };

  const claimFeedbackReward = (platform: 'ios' | 'android') => {
    if (!user?.id) {
      setFeedbackMessage('Please sign in first, then submit for review reward.');
      return;
    }
    const claimType = platform === 'ios' ? 'feedback_ios' : 'feedback_android';
    const setter = platform === 'ios' ? setIosFeedback : setAndroidFeedback;
    submitClaimRequest(claimType, setter, setFeedbackMessage);
  };

  const handleOpenReview = async (platform: StorePlatform) => {
    setReviewPrompting(platform);
    setFeedbackMessage(null);
    const result = await requestInAppReviewWithFallback(platform);
    if (result.status === 'requested') {
      setFeedbackMessage('Review prompt requested. If the store decides not to show it now, try again later.');
    } else if (result.status === 'fallback_opened') {
      setFeedbackMessage('Store page opened. Please leave your rating and review there.');
    } else if (result.status === 'cooldown') {
      setFeedbackMessage('Review prompt is on cooldown. Please try again after some time.');
    } else if (result.status === 'unavailable') {
      setFeedbackMessage('In-app review is currently unavailable on this device.');
    } else {
      setFeedbackMessage(result.message || 'Could not open review right now.');
    }
    setReviewPrompting(null);
  };

  const handleOpenStore = (platform: StorePlatform) => {
    openStoreReview(platform);
    setFeedbackMessage('Store page opened. Please leave your rating and review there.');
  };

  const claimReferralReward = (task: InviteTask) => {
    const currentState = referralClaims[task.id] || 'idle';
    if (currentState === 'loading' || currentState === 'submitted' || currentState === 'already_submitted') return;
    setReferralClaims((prev) => ({ ...prev, [task.id]: 'loading' }));
    const name = task.name.trim();
    const email = task.email.trim().toLowerCase();
    const notes = `Referral: name=${name || ''}; email=${email || ''}`;
    submitClaimRequest(
      'referral',
      (state) => setReferralClaims((prev) => ({ ...prev, [task.id]: state })),
      (msg) => setReferralClaimMessages((prev) => ({ ...prev, [task.id]: msg })),
      notes
    );
  };

  const referralRewardText = useMemo(() => {
    const rewardPoints = payload?.joinReward?.points ?? 50;
    return `When your friend signs up to Kids Zone using your referral link, you earn +${rewardPoints} points automatically.`;
  }, [payload?.joinReward?.points]);

  const copyInviteLink = async () => {
    if (!payload?.inviteLink) return;
    try {
      await navigator.clipboard.writeText(payload.inviteLink);
      setMessage('Invite link copied. Share it with your friend so they can sign up to Kids Zone.');
    } catch {
      setMessage('Could not copy the invite link automatically.');
    }
  };

  const addTask = () => {
    const name = friendName.trim();
    const email = friendEmail.trim();

    if (!name && !email) {
      setMessage('Please add a friend name or email.');
      return;
    }

    const entry: InviteTask = {
      id: `${Date.now()}`,
      name: name || 'Friend',
      email,
      createdAt: new Date().toISOString(),
    };

    setTasks((current) => [entry, ...current]);
    setFriendName('');
    setFriendEmail('');
    setMessage('Referral task added. Share your Kids Zone signup link with this friend.');
  };

  const removeTask = (id: string) => {
    setTasks((current) => current.filter((task) => task.id !== id));
  };

  const openEmailInvite = (task: InviteTask) => {
    if (!payload?.inviteLink || !task.email) return;
    const subject = encodeURIComponent('Join Kids Zone Islamic Learning');
    const body = encodeURIComponent(
      `Assalamu Alaikum!\n\nPlease sign up to Kids Zone using my referral link: ${payload.inviteLink}\n\nApp Store: ${APP_STORE_LINKS.ios}\nGoogle Play: ${APP_STORE_LINKS.android}\n\nJazakAllahu Khair.`
    );
    trackReferralShared({ method: 'email' });
    window.location.href = `mailto:${task.email}?subject=${subject}&body=${body}`;
  };

  return (
    <div className="min-h-screen bg-[#f5f3ff] pattern-islamic">
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        <div className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#eef2ff] rounded-full border border-[#6366f1]/20">
            <ClipboardList size={16} className="text-[#4f46e5]" />
            <span className="text-sm font-semibold text-[#4338ca]">Tasks & Referrals</span>
          </div>
          <h1 className="text-4xl md:text-5xl font-bold text-[#1e1b4b]">Invite a Friend Task</h1>
          <p className="text-[#475569] text-lg max-w-2xl mx-auto">
            Add a friend name or email, share your Kids Zone signup link, and earn points when they join.
          </p>
        </div>

        <div className="bg-gradient-to-r from-[#eff6ff] to-[#f0f9ff] border border-[#60a5fa]/30 rounded-2xl p-5 text-center">
          <p className="text-[#1d4ed8] font-bold text-base md:text-lg">
            Share Kids Zone from Islam Media Central with family and friends.
          </p>
          <p className="text-[#1e40af] mt-2 text-sm md:text-base">
            Your friend must sign up to Kids Zone using your referral link. After they join, your {payload?.joinReward?.points ?? 50} referral points are added automatically.
          </p>
        </div>

        {/* Recording Feature */}
        <section className="rounded-3xl border border-purple-200 bg-gradient-to-br from-purple-50 via-white to-indigo-50 p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-purple-600 text-3xl text-white shadow-sm">
              <Mic size={28} />
            </div>
            <div className="flex-1">
              <div className="inline-flex rounded-full bg-purple-100 px-3 py-1 text-xs font-bold uppercase tracking-wide text-purple-800">
                Record &amp; Earn Points
              </div>
              <h2 className="mt-3 text-2xl font-bold text-[#1e1b4b]">Record Quran, Nasheeds, Stories &amp; Hadith</h2>
              <div className="mt-3 space-y-2 text-sm leading-6 text-[#475569] md:text-base">
                <p>Use this recorder to record Quran recitation, nasheeds, Islamic stories, Hadith and more.</p>
                <p className="font-semibold text-purple-700">We will check your recordings and give more points!</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link
                  href="/studio"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-purple-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-purple-700"
                >
                  <Mic size={18} />
                  Click here &amp; earn points
                </Link>
                <Link
                  href="/my-recordings"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border-2 border-purple-200 bg-white px-5 py-3 text-sm font-bold text-purple-900 transition hover:bg-purple-50"
                >
                  My Recordings
                </Link>
                <a
                  href="https://create-me-a-audio.vercel.app/kids-record"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-purple-200 bg-purple-50 px-5 py-3 text-sm font-bold text-purple-800 transition hover:bg-purple-100"
                >
                  Open External Recorder
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Activity shortcuts */}
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Link href="/studio" className="group flex flex-col items-center gap-3 bg-white rounded-2xl border border-[#c4b5fd]/20 shadow-lg p-6 text-center hover:border-[#7c3aed]/40 hover:shadow-xl transition">
            <div className="text-4xl">🎙️</div>
            <div>
              <p className="font-black text-[#1e1b4b] text-lg">Record a Story</p>
              <p className="text-sm text-[#475569] mt-1">Record an Islamic story and earn points</p>
            </div>
          </Link>
          <Link href="/pledge" className="group flex flex-col items-center gap-3 bg-white rounded-2xl border border-[#c4b5fd]/20 shadow-lg p-6 text-center hover:border-[#7c3aed]/40 hover:shadow-xl transition">
            <div className="text-4xl">📿</div>
            <div>
              <p className="font-black text-[#1e1b4b] text-lg">Durood &amp; Zikr Pledge</p>
              <p className="text-sm text-[#475569] mt-1">Complete pledges to gain points</p>
            </div>
          </Link>
          <Link href="/games" className="group flex flex-col items-center gap-3 bg-white rounded-2xl border border-[#c4b5fd]/20 shadow-lg p-6 text-center hover:border-[#7c3aed]/40 hover:shadow-xl transition">
            <div className="text-4xl">🎮</div>
            <div>
              <p className="font-black text-[#1e1b4b] text-lg">Play Games</p>
              <p className="text-sm text-[#475569] mt-1">Play Islamic games to earn points</p>
            </div>
          </Link>
        </section>

        <section className="bg-white rounded-2xl border border-[#c4b5fd]/20 shadow-lg p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Star size={18} className="text-[#f59e0b]" />
            <h2 className="text-2xl font-bold text-[#1e1b4b]">Leave a Review</h2>
          </div>
          <p className="text-sm text-[#475569]">
            Open the review popup to leave a review on Apple App Store or Google Play.
          </p>
          <button
            onClick={() => setIsReviewPopupOpen(true)}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white font-bold shadow-md"
          >
            <Star size={16} /> Open Review Popup
          </button>
        </section>

        {!user ? (
          <div className="bg-white rounded-2xl border border-[#c4b5fd]/20 shadow-lg p-8 text-center space-y-4">
            <Users size={42} className="mx-auto text-[#6366f1]" />
            <h2 className="text-2xl font-bold text-[#1e1b4b]">Sign in to use referral tasks</h2>
            <p className="text-[#475569]">You need an account to get your invite link and track your referral tasks.</p>
            <div className="flex justify-center gap-3">
              <Link href="/signin?next=%2Ftasks" className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] text-white font-bold">
                Sign In
              </Link>
              <Link href="/signup" className="px-5 py-3 rounded-xl border border-[#c4b5fd]/40 text-[#1e1b4b] font-bold bg-white">
                Join Kids Zone
              </Link>
            </div>
          </div>
        ) : loading ? (
          <div className="bg-white rounded-2xl border border-[#c4b5fd]/20 shadow-lg p-8 text-[#475569]">Loading referral task tools...</div>
        ) : !payload ? (
          <div className="bg-white rounded-2xl border border-[#c4b5fd]/20 shadow-lg p-8 text-center space-y-3">
            <p className="text-[#1e1b4b] font-bold">Referral tools are unavailable right now.</p>
            <p className="text-[#475569]">{loadError || 'Please try again later.'}</p>
          </div>
        ) : (
          <>
            <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-2xl border border-[#c4b5fd]/20 shadow-lg p-5">
                <p className="text-xs uppercase tracking-[0.12em] text-[#6366f1]">Referral Code</p>
                <p className="text-3xl font-black text-[#312e81] mt-2">{payload.referralCode}</p>
              </div>
              <div className="bg-white rounded-2xl border border-[#c4b5fd]/20 shadow-lg p-5">
                <p className="text-xs uppercase tracking-[0.12em] text-[#5b21b6]">Successful Joins</p>
                <p className="text-3xl font-black text-[#5b21b6] mt-2">{payload.successfulJoins}</p>
              </div>
              <div className="bg-white rounded-2xl border border-[#c4b5fd]/20 shadow-lg p-5">
                <p className="text-xs uppercase tracking-[0.12em] text-[#b45309]">Pending Referral Tasks</p>
                <p className="text-3xl font-black text-[#92400e] mt-2">{pendingCount}</p>
              </div>
            </section>

            <section className="bg-white rounded-2xl border border-[#c4b5fd]/20 shadow-lg p-6 space-y-4">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-[#1e1b4b]">Create Referral Task</h2>
                  <p className="text-[#475569] text-sm mt-1">Add your friend&apos;s name or email, then send them your Kids Zone signup link.</p>
                </div>
                <p className="text-sm font-semibold text-[#5b21b6]">{referralRewardText}</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-bold text-[#1e1b4b] mb-2">Friend Name</label>
                  <input
                    value={friendName}
                    onChange={(event) => setFriendName(event.target.value)}
                    placeholder="Enter friend name"
                    className="w-full rounded-xl border border-[#c4b5fd]/40 px-4 py-3 text-[#1e1b4b] bg-[#fffdf9]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-[#1e1b4b] mb-2">Friend Email</label>
                  <input
                    value={friendEmail}
                    onChange={(event) => setFriendEmail(event.target.value)}
                    placeholder="Enter friend email"
                    className="w-full rounded-xl border border-[#c4b5fd]/40 px-4 py-3 text-[#1e1b4b] bg-[#fffdf9]"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-[#cbd5e1] bg-[#f8fafc] p-4 space-y-3">
                <p className="text-sm font-semibold text-[#334155]">Referral signup link</p>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input readOnly value={payload.inviteLink} className="w-full rounded-xl border border-[#cbd5e1] px-3 py-2 text-sm text-[#1e293b] bg-white" />
                  <button onClick={copyInviteLink} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white border border-[#cbd5e1] text-[#334155] font-semibold hover:bg-[#f1f5f9]">
                    <Copy size={16} />
                    Copy Link
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-3">
                <button onClick={addTask} className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white font-bold shadow-md">
                  <UserPlus size={18} />
                  Add Referral Task
                </button>
                <a href={APP_STORE_LINKS.android} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-[#16a34a]/30 bg-[#f0fdf4] text-[#166534] font-bold">
                  <Send size={18} />
                  Open Android App Link
                </a>
              </div>

              {message ? <p className="text-sm font-semibold text-[#5b21b6]">{message}</p> : null}
            </section>

            <section className="bg-white rounded-2xl border border-[#c4b5fd]/20 shadow-lg p-6 space-y-5">
              <div className="flex items-center gap-2">
                <Star size={18} className="text-[#f59e0b]" />
                <h2 className="text-2xl font-bold text-[#1e1b4b]">Leave a Review — Earn 30 Points</h2>
              </div>
              <p className="text-sm text-[#475569]">
                Leave a review for Kids Zone on the Apple App Store or Google Play and earn +30 bonus points. Click &ldquo;Submit for Review&rdquo; after leaving your review — the admin will approve and add your points.
              </p>
              <button
                onClick={() => setIsReviewPopupOpen(true)}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white font-bold shadow-md"
              >
                <Star size={16} /> Open Review Popup
              </button>
              {feedbackMessage ? (
                <p className={`text-sm font-semibold ${
                  iosFeedback === 'error' || androidFeedback === 'error' ? 'text-[#be123c]' : 'text-[#5b21b6]'
                }`}>{feedbackMessage}</p>
              ) : null}
            </section>

            <section className="bg-white rounded-2xl border border-[#c4b5fd]/20 shadow-lg p-6 space-y-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={18} className="text-[#7c3aed]" />
                <h2 className="text-2xl font-bold text-[#1e1b4b]">Your Referral Tasks</h2>
              </div>
              <p className="text-sm text-[#475569]">After you refer someone, add their name or email here and click <strong>Claim +30 Points</strong>. The admin will approve it and add your points.</p>

              {tasks.length === 0 ? (
                <div className="rounded-2xl bg-[#fffdf9] border border-dashed border-[#c4b5fd]/40 p-6 text-center text-[#475569]">
                  No referral tasks added yet. Add a friend name or email to start inviting.
                </div>
              ) : (
                <div className="space-y-3">
                  {tasks.map((task) => (
                    <div key={task.id} className="rounded-2xl border border-[#c4b5fd]/20 bg-[#fffdf9] p-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <p className="font-bold text-[#1e1b4b]">{task.name}</p>
                        <p className="text-sm text-[#475569]">{task.email || 'No email saved'}</p>
                        <p className="text-xs text-[#94a3b8] mt-1">Added {new Date(task.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {task.email ? (
                          <button onClick={() => openEmailInvite(task)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#eff6ff] text-[#1d4ed8] font-semibold border border-[#bfdbfe]">
                            <Mail size={16} />
                            Email Invite
                          </button>
                        ) : null}
                        <button onClick={copyInviteLink} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white text-[#334155] font-semibold border border-[#cbd5e1]">
                          <Copy size={16} />
                          Copy Link
                        </button>
                        {(() => {
                          const cs = referralClaims[task.id] || 'idle';
                          const submitted = cs === 'submitted' || cs === 'already_submitted';
                          return (
                            <button
                              disabled={cs === 'loading' || submitted}
                              onClick={() => claimReferralReward(task)}
                              className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl font-semibold border text-sm transition ${
                                submitted
                                  ? 'bg-[#dcfce7] text-[#166534] border-[#86efac]'
                                  : cs === 'error'
                                  ? 'bg-[#fff1f2] text-[#be123c] border-[#fecdd3]'
                                  : 'bg-gradient-to-r from-[#6366f1] to-[#4f46e5] text-white border-transparent shadow-md'
                              } disabled:opacity-60`}
                            >
                              {submitted ? '✓ Reward Submitted' : cs === 'loading' ? 'Submitting…' : 'Claim +30 Points'}
                            </button>
                          );
                        })()}
                        {referralClaimMessages[task.id] ? (
                          <p className="text-xs font-semibold text-[#5b21b6] w-full">{referralClaimMessages[task.id]}</p>
                        ) : null}
                        <button onClick={() => removeTask(task.id)} className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#fff1f2] text-[#be123c] font-semibold border border-[#fecdd3]">
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}

        <Modal isOpen={isReviewPopupOpen} onClose={() => setIsReviewPopupOpen(false)} title="Leave a Review" size="lg">
          <div className="space-y-4">
            <p className="text-sm text-[#475569]">
              Choose your platform, leave a review, then click submit so admin can approve +30 points.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl border border-[#c4b5fd]/30 bg-[#f8fafc] p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Smartphone size={20} className="text-[#1d4ed8]" />
                  <p className="font-bold text-[#1e293b]">Apple App Store</p>
                </div>
                <p className="text-xs text-[#64748b]">Open the App Store, leave a rating and short review.</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleOpenStore('ios')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8] font-semibold text-sm"
                  >
                    Open App Store
                  </button>
                  <button
                    onClick={() => void handleOpenReview('ios')}
                    disabled={reviewPrompting === 'ios'}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#bfdbfe] bg-white text-[#1d4ed8] font-semibold text-sm disabled:opacity-60"
                  >
                    {reviewPrompting === 'ios' ? 'Opening…' : 'In-App Review'}
                  </button>
                  <button
                    disabled={iosFeedback === 'loading' || iosFeedback === 'submitted' || iosFeedback === 'already_submitted'}
                    onClick={() => claimFeedbackReward('ios')}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm transition ${
                      iosFeedback === 'submitted' || iosFeedback === 'already_submitted'
                        ? 'bg-[#dcfce7] text-[#166534] border border-[#86efac]'
                        : iosFeedback === 'error'
                        ? 'bg-[#fff1f2] text-[#be123c] border border-[#fecdd3]'
                        : 'bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-md'
                    } disabled:opacity-60`}
                  >
                    {iosFeedback === 'submitted' ? '✓ Submitted for Review' : iosFeedback === 'already_submitted' ? '✓ Already Submitted' : iosFeedback === 'loading' ? 'Submitting…' : 'Submit for Review (+30 pts)'}
                  </button>
                </div>
              </div>
              <div className="rounded-2xl border border-[#c4b5fd]/30 bg-[#f8fafc] p-5 flex flex-col gap-3">
                <div className="flex items-center gap-2">
                  <Smartphone size={20} className="text-[#15803d]" />
                  <p className="font-bold text-[#1e293b]">Google Play</p>
                </div>
                <p className="text-xs text-[#64748b]">Open Google Play, leave a rating and short review.</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleOpenStore('android')}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#bbf7d0] bg-[#f0fdf4] text-[#15803d] font-semibold text-sm"
                  >
                    Open Google Play
                  </button>
                  <button
                    onClick={() => void handleOpenReview('android')}
                    disabled={reviewPrompting === 'android'}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-[#bbf7d0] bg-white text-[#15803d] font-semibold text-sm disabled:opacity-60"
                  >
                    {reviewPrompting === 'android' ? 'Opening…' : 'In-App Review'}
                  </button>
                  <button
                    disabled={androidFeedback === 'loading' || androidFeedback === 'submitted' || androidFeedback === 'already_submitted'}
                    onClick={() => claimFeedbackReward('android')}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm transition ${
                      androidFeedback === 'submitted' || androidFeedback === 'already_submitted'
                        ? 'bg-[#dcfce7] text-[#166534] border border-[#86efac]'
                        : androidFeedback === 'error'
                        ? 'bg-[#fff1f2] text-[#be123c] border border-[#fecdd3]'
                        : 'bg-gradient-to-r from-[#f59e0b] to-[#d97706] text-white shadow-md'
                    } disabled:opacity-60`}
                  >
                    {androidFeedback === 'submitted' ? '✓ Submitted for Review' : androidFeedback === 'already_submitted' ? '✓ Already Submitted' : androidFeedback === 'loading' ? 'Submitting…' : 'Submit for Review (+30 pts)'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      </div>
    </div>
  );
}
