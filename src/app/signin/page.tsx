"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { ensureUserProfile } from '@/lib/user-profile';
import Link from 'next/link';
import { Button } from '@/components/Button';
import { Eye, EyeOff, Shield } from 'lucide-react';

export default function SignInPage() {
  const router = useRouter();
  const authInFlightRef = useRef(false);

  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [info, setInfo]             = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [offline, setOffline]       = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [touched, setTouched]       = useState<{ email: boolean; password: boolean; mfa: boolean }>({
    email: false, password: false, mfa: false,
  });

  const [mfaRequired, setMfaRequired]       = useState(false);
  const [mfaFactorId, setMfaFactorId]       = useState<string | null>(null);
  const [mfaChallengeId, setMfaChallengeId] = useState<string | null>(null);
  const [mfaCode, setMfaCode]               = useState('');
  const [retryIn, setRetryIn]               = useState<number | null>(null);

  /* ── Manual-retry countdown (counts down, does NOT auto-submit) ── */
  useEffect(() => {
    if (retryIn === null || retryIn <= 0) { setRetryIn(null); return; }
    const id = window.setInterval(() => {
      setRetryIn((n) => (n === null || n <= 1 ? null : n - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [retryIn]);

  /* ── On mount: check if a client-side cooldown is still active ── */
  useEffect(() => {
    try {
      const until = parseInt(window.localStorage.getItem('iklp_signin_locked_until') ?? '0', 10);
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining > 0) setRetryIn(remaining);
    } catch {}
  }, []);

  const recordFailedAttempt = () => {
    try {
      const key = 'iklp_signin_attempts';
      const raw = window.localStorage.getItem(key);
      const attempts: number[] = raw ? JSON.parse(raw) : [];
      const now = Date.now();
      // Keep only attempts in the last 5 minutes
      const recent = attempts.filter((t) => now - t < 5 * 60 * 1000);
      recent.push(now);
      window.localStorage.setItem(key, JSON.stringify(recent));
      // After 4 failed attempts, enforce a 2-minute client-side cooldown
      if (recent.length >= 4) {
        const lockUntil = now + 2 * 60 * 1000;
        window.localStorage.setItem('iklp_signin_locked_until', String(lockUntil));
        setRetryIn(120);
        return true; // locked
      }
    } catch {}
    return false;
  };

  const clearFailedAttempts = () => {
    try {
      window.localStorage.removeItem('iklp_signin_attempts');
      window.localStorage.removeItem('iklp_signin_locked_until');
    } catch {}
  };

  /* ── Bootstrap ──────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try { const msg = new URLSearchParams(window.location.search).get('message'); if (msg) setInfo(msg); } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const stored = window.localStorage.getItem('iklp_remember_me');
      setRememberMe(stored === null ? true : stored === 'true');
    } catch {}
  }, []);

  /* ── Derived ─────────────────────────────────────────── */
  const normalizedEmail = useMemo(() => email.trim().toLowerCase(), [email]);
  const emailValid      = useMemo(() => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail), [normalizedEmail]);
  const passwordValid   = useMemo(() => password.length >= 6, [password]);

  const getNextPath = () => {
    if (typeof window === 'undefined') return '/';
    try {
      const next = new URLSearchParams(window.location.search).get('next');
      if (!next) return '/';
      return next.startsWith('/') ? next : '/';
    } catch { return '/'; }
  };

  const persistRemember = (val: boolean) => {
    try { window.localStorage.setItem('iklp_remember_me', val ? 'true' : 'false'); } catch {}
  };

  const waitForSession = async (attempts = 6, delayMs = 200) => {
    for (let i = 0; i < attempts; i++) {
      const { data } = await supabase.auth.getSession();
      if (data.session?.user?.id) return data.session;
      await new Promise((r) => setTimeout(r, delayMs));
    }
    return null;
  };

  /* ── MFA ─────────────────────────────────────────────── */
  const beginMfaIfNeeded = async () => {
    try {
      const api: any = (supabase.auth as any).mfa;
      if (!api?.listFactors || !api?.challenge) return false;
      const { data } = await api.listFactors();
      const factors: any[] = data?.totp ?? data?.all ?? data?.factors ?? [];
      const verified = factors.find((f: any) => f?.status === 'verified');
      if (!verified?.id) return false;
      const { data: ch, error: chErr } = await api.challenge({ factorId: verified.id });
      if (chErr || !ch?.id) return false;
      setMfaFactorId(verified.id);
      setMfaChallengeId(ch.id);
      setMfaRequired(true);
      setMfaCode('');
      return true;
    } catch { return false; }
  };

  const onVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authInFlightRef.current || loading) return;
    setError(null);
    setTouched((t) => ({ ...t, mfa: true }));
    if (!mfaFactorId || !mfaChallengeId) {
      setError('2FA session expired. Please sign in again.');
      setMfaRequired(false);
      return;
    }
    const code = mfaCode.replace(/\s+/g, '');
    if (!/^\d{6}$/.test(code)) { setError('Enter the 6-digit code from your authenticator app.'); return; }
    authInFlightRef.current = true;
    setLoading(true);
    try {
      const api: any = (supabase.auth as any).mfa;
      const { error: verifyErr } = await api.verify({ factorId: mfaFactorId, challengeId: mfaChallengeId, code });
      if (verifyErr) { setError(verifyErr.message || 'Invalid code. Please try again.'); return; }
      setInfo('Signed in! Redirecting…');
      router.replace(getNextPath());
    } catch (err: any) {
      setError(err?.message || 'Could not verify code. Please try again.');
    } finally {
      setLoading(false);
      authInFlightRef.current = false;
    }
  };

  /* ── Social login ────────────────────────────────────── */
  const onSocialLogin = async (provider: 'google' | 'github' | 'apple') => {
    if (authInFlightRef.current || loading) return;
    authInFlightRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/` : undefined;
      const { error: oauthErr } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo } });
      if (oauthErr) setError(oauthErr.message || 'Social sign-in failed. Please try again.');
    } catch (e: any) {
      setError(e?.message || 'Social sign-in failed. Please try again.');
    } finally {
      setLoading(false);
      authInFlightRef.current = false;
    }
  };

  /* ── Forgot password ─────────────────────────────────── */
  const onForgotPassword = async () => {
    setError(null);
    setInfo(null);
    if (!email.trim()) { setError('Enter your email above, then click "Forgot password?" again.'); return; }
    try {
      const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/reset-password` : undefined;
      const { error: resetErr } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase(), { redirectTo });
      if (resetErr) { setError(resetErr.message || 'Could not send reset email.'); return; }
      setInfo('Password reset email sent. Check your inbox.');
    } catch (e: any) { setError(e?.message || 'Could not send reset email.'); }
  };

  /* ── Main sign-in ────────────────────────────────────── */
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (authInFlightRef.current || loading) return;
    setError(null);
    setInfo(null);
    setTouched({ email: true, password: true, mfa: false });

    if (!normalizedEmail || !emailValid) { setError('Please enter a valid email address.'); return; }
    if (!password || !passwordValid)     { setError('Password must be at least 6 characters.'); return; }
    if (offline) { setError('You appear to be offline. Please reconnect and try again.'); return; }
    // Client-side cooldown check
    try {
      const until = parseInt(window.localStorage.getItem('iklp_signin_locked_until') ?? '0', 10);
      const remaining = Math.ceil((until - Date.now()) / 1000);
      if (remaining > 0) { setRetryIn(remaining); setError(`Too many attempts. Please wait ${remaining} seconds.`); return; }
    } catch {}

    persistRemember(rememberMe);
    authInFlightRef.current = true;
    setLoading(true);

    try {
      // Route through our server-side proxy so Supabase sees Vercel's IP,
      // not the user's browser IP — this bypasses the per-IP rate limit.
      const res = await fetch('/api/auth/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: normalizedEmail, password }),
      });

      const json = await res.json();

      if (!res.ok) {
        const raw: string = json?.error ?? '';
        const isNetwork =
          raw.toLowerCase().includes('failed to fetch') ||
          raw.toLowerCase().includes('networkerror') ||
          raw.toLowerCase().includes('network request failed');
        if (isNetwork) {
          setError('Could not reach the server. Please check your internet connection.');
          return;
        }
        // Rate-limited — try direct Supabase auth as fallback, then show countdown
        const isRateLimit =
          res.status === 429 ||
          raw.toLowerCase().includes('rate limit') ||
          raw.toLowerCase().includes('too many');
        if (isRateLimit) {
          // Try direct sign-in as a fallback path
          try {
            const { data: directData, error: directErr } = await supabase.auth.signInWithPassword({
              email: normalizedEmail,
              password,
            });
            if (!directErr && directData.session) {
              // Direct sign-in worked — continue normally
              const uid = directData.session.user.id;
              clearFailedAttempts();
              ensureUserProfile(uid).catch(() => {});
              const needsMfa = await beginMfaIfNeeded();
              if (needsMfa) { setInfo('Enter your 2FA code to continue.'); return; }
              setInfo('Signed in! Redirecting…');
              router.replace(getNextPath());
              return;
            }
          } catch {}
          // Direct also failed — enforce cooldown
          const wait = json?.retryAfter ?? 120;
          const lockUntil = Date.now() + wait * 1000;
          try { window.localStorage.setItem('iklp_signin_locked_until', String(lockUntil)); } catch {}
          setRetryIn(wait);
          setError(`Too many sign-in attempts. Please wait ${wait} seconds then try again.`);
          return;
        }
        recordFailedAttempt();
        setError(raw || 'Sign-in failed. Please check your email and password.');
        return;
      }

      const { access_token, refresh_token, user } = json;
      if (!access_token || !refresh_token) {
        setError('Sign-in failed — no session returned. Please try again.');
        return;
      }

      // Load the returned tokens into the browser Supabase client
      await supabase.auth.setSession({ access_token, refresh_token });

      const uid = user?.id;
      if (!uid) { setError('Sign-in failed — no user returned. Please try again.'); return; }

      const session = await waitForSession();
      if (!session) {
        setError('Sign-in succeeded but your browser blocked the session cookie. Please enable cookies and try again.');
        return;
      }

      clearFailedAttempts();
      ensureUserProfile(uid).catch(() => {});

      const needsMfa = await beginMfaIfNeeded();
      if (needsMfa) { setInfo('Enter your 2FA code to continue.'); return; }

      setInfo('Signed in! Redirecting…');
      router.replace(getNextPath());
    } catch (err: any) {
      recordFailedAttempt();
      setError(err?.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
      authInFlightRef.current = false;
    }
  };

  /* ── Render ──────────────────────────────────────────── */
  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 sm:px-6 py-10 bg-gradient-to-b from-islamic-light via-white to-white">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 items-stretch">

        {/* Left panel */}
        <div className="hidden md:flex flex-col justify-between rounded-2xl p-8 bg-gradient-to-br from-indigo-700 to-purple-900 text-white shadow-xl">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold">
              <Shield size={14} /> Secure Sign In
            </div>
            <h1 className="mt-5 text-3xl font-extrabold leading-tight">Welcome back</h1>
            <p className="mt-3 text-white/80">
              Sign in to continue your learning journey. Your account stays signed in until you log out.
            </p>
          </div>
        </div>

        {/* Right panel */}
        <div className="w-full rounded-2xl bg-white shadow-xl border border-slate-100 p-6 sm:p-8">
          <div className="md:hidden mb-6">
            <h1 className="text-2xl font-extrabold text-slate-900">Sign in</h1>
            <p className="mt-1 text-sm text-slate-600">Continue learning where you left off.</p>
          </div>

          {offline && (
            <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              You are offline. Please reconnect to sign in.
            </div>
          )}

          {(error || info || retryIn !== null) && (
            <div
              className={`mb-4 rounded-xl px-4 py-3 text-sm ${
                error
                  ? 'bg-red-50 text-red-800 border border-red-200'
                  : 'bg-green-50 text-green-800 border border-green-200'
              }`}
              role="status"
              aria-live="polite"
            >
              {error
                ? <>{error}{retryIn !== null && <span className="font-bold"> ({retryIn}s remaining)</span>}</>
                : info}
            </div>
          )}

          {/* Social buttons removed */}

          {!mfaRequired ? (
            <form id="signin-form" onSubmit={onSubmit} className="space-y-4" noValidate>
              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-slate-800 mb-1">Email</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="kid@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, email: true }))}
                  className={`w-full rounded-xl border px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400 transition ${
                    touched.email && !emailValid ? 'border-red-300 bg-red-50' : 'border-slate-200'
                  }`}
                />
                {touched.email && !emailValid && (
                  <p className="mt-1 text-xs text-red-700">Enter a valid email address.</p>
                )}
              </div>

              {/* Password */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="password" className="block text-sm font-semibold text-slate-800">Password</label>
                  <button type="button" onClick={onForgotPassword} className="text-xs font-semibold text-indigo-600 hover:underline">
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    onBlur={() => setTouched((t) => ({ ...t, password: true }))}
                    className={`w-full rounded-xl border px-3 py-2.5 pr-11 outline-none focus:ring-2 focus:ring-indigo-400 transition ${
                      touched.password && !passwordValid ? 'border-red-300 bg-red-50' : 'border-slate-200'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-800"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {touched.password && !passwordValid && (
                  <p className="mt-1 text-xs text-red-700">Password must be at least 6 characters.</p>
                )}
              </div>

              {/* Remember me */}
              <label className="flex items-center gap-2 text-sm text-slate-700 select-none cursor-pointer">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-indigo-600"
                />
                Keep me signed in
              </label>

              <Button type="submit" disabled={loading || retryIn !== null} className="w-full">
                {loading ? 'Signing in…' : retryIn !== null ? `Please wait ${retryIn}s…` : 'Sign In'}
              </Button>

              <p className="text-sm text-center text-slate-600">
                New here?{' '}
                <Link href="/signup" className="text-indigo-600 font-semibold hover:underline">Create an account</Link>
              </p>
            </form>
          ) : (
            /* MFA form */
            <form onSubmit={onVerifyMfa} className="space-y-4">
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-sm font-semibold text-slate-900">Two-factor authentication</p>
                <p className="mt-1 text-sm text-slate-700">Enter the 6-digit code from your authenticator app.</p>
              </div>
              <div>
                <label htmlFor="mfa" className="block text-sm font-semibold text-slate-800 mb-1">2FA code</label>
                <input
                  id="mfa"
                  type="text"
                  inputMode="numeric"
                  placeholder="123456"
                  value={mfaCode}
                  onChange={(e) => setMfaCode(e.target.value)}
                  onBlur={() => setTouched((t) => ({ ...t, mfa: true }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 outline-none focus:ring-2 focus:ring-indigo-400"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full">
                {loading ? 'Verifying…' : 'Verify & Continue'}
              </Button>
              <button
                type="button"
                onClick={() => { setMfaRequired(false); setMfaCode(''); setMfaFactorId(null); setMfaChallengeId(null); }}
                className="w-full text-sm text-slate-600 hover:underline"
              >
                Use a different account
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
