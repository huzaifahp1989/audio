'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DailyPointsBar } from '@/components/DailyPointsBar';
import { usePointsProgress } from '@/lib/points-progress-context';
import { MAX_DAILY_QUIZ_ATTEMPTS, QUIZ_POINTS_PER_COMPLETION, POINTS_DAILY_CAP, MAX_DAILY_QUIZ_POINTS } from '@/lib/points-policy';
import { CheckCircle, Calendar, Trophy, ArrowLeft, Sparkles, Clock } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { getQuizQuestionPool } from '@/lib/quiz-question-pool';
import { QUIZ_TOPICS, QUIZ_TOPIC_GROUPS, getTopicById, getTopicQuestionCount, getDailyTopicSeed, type QuizTopicId } from '@/lib/quiz-topics';
import { ReadAloudButton } from '@/components/ReadAloudButton';
import { EarnMorePointsLinks } from '@/components/EarnMorePointsLinks';
import { authJsonFetch } from '@/lib/auth-headers';
import { trackQuizCompleted } from '@/lib/analytics';

const quizPool = getQuizQuestionPool();

function difficultyStars(difficulty?: string) {
  switch (difficulty) {
    case 'Expert': return '⭐⭐⭐⭐';
    case 'Hard': return '⭐⭐⭐';
    case 'Medium': return '⭐⭐';
    default: return '⭐';
  }
}

type QuizMode = 'daily' | null;

export default function QuizPage() {
  const { user, profile, refreshProfile, updateLocalProfile } = useAuth();
  const { showPointsProgress } = usePointsProgress();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const [mode, setMode] = useState<QuizMode>(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [quizComplete, setQuizComplete] = useState(false);
  const [resultToast, setResultToast] = useState<string | null>(null);

  const [dailyQuiz, setDailyQuiz] = useState<any>(null);
  const [dailyStatus, setDailyStatus] = useState<'loading' | 'ready' | 'completed' | 'error'>('loading');
  const [dailyAnswers, setDailyAnswers] = useState<Record<string, number>>({});
  const [startTime, setStartTime] = useState<number>(0);
  const [dailyResult, setDailyResult] = useState<any>(null);
  const [todayDate, setTodayDate] = useState<string>('');
  const [selectedTopic, setSelectedTopic] = useState<QuizTopicId | null>(null);

  const [quizLockedUntil, setQuizLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<string>('');
  const [todaySeed, setTodaySeed] = useState<string>('');
  const [topicQuestions, setTopicQuestions] = useState<any[]>([]);
  const [activeQuizId, setActiveQuizId] = useState<string>('');
  const [isLoadingTopicQuiz, setIsLoadingTopicQuiz] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [quizAttemptsToday, setQuizAttemptsToday] = useState(0);

  useEffect(() => {
    setTodayDate(new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' }));
    setTodaySeed(getDailyTopicSeed());
  }, []);

  // Live countdown ticker — counts down to quizLockedUntil (epoch ms when lock expires)
  useEffect(() => {
    if (!quizLockedUntil) return;
    const tick = () => {
      const remaining = quizLockedUntil - Date.now();
      if (remaining <= 0) {
        setQuizLockedUntil(null);
        setCountdown('');
        setDailyStatus('ready');
        return;
      }
      const h = Math.floor(remaining / 3_600_000);
      const m = Math.floor((remaining % 3_600_000) / 60_000);
      const s = Math.floor((remaining % 60_000) / 1_000);
      setCountdown(`${h}h ${m.toString().padStart(2, '0')}m ${s.toString().padStart(2, '0')}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [quizLockedUntil]);

  useEffect(() => {
    async function fetchDailyStatus() {
      try {
        setDailyStatus('loading');
        const res = await fetch('/api/quiz/daily');
        if (!res.ok) {
          if (res.status === 404) {
            setDailyStatus('error');
            return;
          }
          throw new Error('Failed to fetch daily quiz');
        }
        const quizData = await res.json();
        setDailyQuiz(quizData);

        if (user?.id) {
          // Server-side 24-hour lock check — works across all devices
          const lockRes = await fetch(`/api/quiz/daily/lock-status?userId=${user.id}`);
          if (lockRes.ok) {
            const lockData = await lockRes.json();
            setQuizAttemptsToday(Number(lockData.attemptsToday || 0));
            if (lockData.locked && lockData.lockedUntil) {
              setQuizLockedUntil(lockData.lockedUntil);
              setQuizAttemptsToday(Number(lockData.attemptsToday || MAX_DAILY_QUIZ_ATTEMPTS));
              setDailyStatus('completed');
              setDailyResult({ score: lockData.lastScore ?? 0 });
              return;
            }
          }
        }
        // Reset lock state if not locked
        setQuizLockedUntil(null);
        setDailyResult(null);
        setDailyStatus('ready');
      } catch (err) {
        console.error('Error fetching daily quiz:', err);
        setDailyStatus('error');
      }
    }
    fetchDailyStatus();
  }, [user]);

  const currentQuestions = topicQuestions;

  const selectedTopicInfo = useMemo(() => getTopicById(selectedTopic), [selectedTopic]);

  const currentQuestion = currentQuestions[currentQuestionIndex];

  const startDailyQuiz = async (topicId: QuizTopicId) => {
    if (!user?.id) {
      const msg = encodeURIComponent('Please sign in to take the daily quiz.');
      router.push(`/signin?next=%2Fquiz&message=${msg}`);
      return;
    }

    const topicQuestionCount = getTopicQuestionCount(quizPool as any[], topicId);
    if (topicQuestionCount < 5) {
      setResultToast(`No ${getTopicById(topicId)?.label || topicId} questions are available today.`);
      return;
    }

    setIsLoadingTopicQuiz(true);
    setResultToast(null);

    try {
      const res = await fetch(`/api/quiz/topic-questions?topic=${topicId}&userId=${encodeURIComponent(user.id)}`);
      const data = await res.json();

      if (!res.ok || !Array.isArray(data.questions) || data.questions.length === 0) {
        setResultToast(data.error || `Could not load ${getTopicById(topicId)?.label || topicId} questions right now.`);
        return;
      }

      setSelectedTopic(topicId);
      setTopicQuestions(data.questions);
      setTodaySeed(data.daySeed || data.weekSeed || getDailyTopicSeed());
      setActiveQuizId(data.quizId || `topic-${topicId}-${data.daySeed || data.weekSeed || getDailyTopicSeed()}-${user.id}`);
      setMode('daily');
      setStartTime(Date.now());
      setCurrentQuestionIndex(0);
      setDailyAnswers({});
      setQuizComplete(false);
      setSelectedAnswer(null);
      setShowFeedback(false);
    } catch (err) {
      console.error('Failed to load topic quiz:', err);
      setResultToast('Could not load quiz questions. Please try again.');
    } finally {
      setIsLoadingTopicQuiz(false);
    }
  };

  const handleAnswerSelect = (index: number) => {
    setSelectedAnswer(index);
  };

  const handleNext = () => {
    if (selectedAnswer === null) return;

    if (!showFeedback) {
      setShowFeedback(true);
      return;
    }

    const questionId = String(currentQuestion?.id || '');
    const answer = selectedAnswer;

    setDailyAnswers(prev => ({
      ...prev,
      [questionId]: answer
    }));

    if (currentQuestionIndex < currentQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowFeedback(false);
    } else {
      finishQuiz(questionId, answer);
    }
  };

  const finishQuiz = (lastQuestionId?: string, lastAnswer?: number | null) => {
    try {
    if (!selectedTopic) {
      setResultToast('Please select a topic first.');
      return;
    }

    if (!currentQuestions.length) {
      setResultToast('No questions available for this topic right now. Please choose another topic.');
      setMode(null);
      return;
    }

    const questionId = String(lastQuestionId || currentQuestion?.id || '');
    const answer = lastAnswer ?? selectedAnswer;

    setQuizComplete(true);

    if (!questionId || answer === null || answer === undefined) {
      setDailyResult({
        score: 0,
        maxScore: currentQuestions.length,
        awardedPoints: 0,
        syncing: false,
        message: 'Could not read your last answer. Tap Finish Quiz again.',
      });
      return;
    }

    const endTime = Date.now();
    const duration = Math.floor((endTime - startTime) / 1000);

    const finalAnswers: Record<string, number> = {
      ...dailyAnswers,
      [questionId]: Number(answer)
    };

    const localCorrect = currentQuestions.reduce((count: number, question: any) => {
      const answer = finalAnswers[String(question.id)];
      return count + (Number(answer) === Number(question.correctAnswer) ? 1 : 0);
    }, 0);
    const localScore = localCorrect * 10;
    const maxScore = currentQuestions.length * 10;

    // Show results immediately — server sync runs in the background.
    setDailyResult({
      score: localScore,
      maxScore,
      awardedPoints: 0,
      message: 'Saving your score…',
      syncing: true,
    });

    if (!user?.id) {
      setResultToast('Please sign in to submit the quiz and earn points.');
      setDailyResult((prev: any) => ({ ...prev, syncing: false }));
      return;
    }

    void (async () => {
    try {
      const res = await authJsonFetch('/api/quiz/daily/submit', {
        method: 'POST',
        timeoutMs: 15_000,
        body: JSON.stringify({
          userId: user?.id,
          quizId: activeQuizId || `topic-${selectedTopic}-${todaySeed}-${user.id}`,
          answers: finalAnswers,
          durationSeconds: duration,
          topic: selectedTopic,
          questionIds: currentQuestions.map((question: any) => String(question.id))
        })
      });

      const data = await res.json();
      
      if (res.status === 401) {
        setDailyResult((prev: any) => ({ ...prev, syncing: false }));
        setResultToast('Your session expired. Please sign in again from the menu, then retake the quiz.');
        return;
      }

      // Handle daily limit (429 status)
      if (res.status === 429 && data.locked) {
        setDailyStatus('completed');
        if (data.lockedUntil) {
          setQuizLockedUntil(data.lockedUntil);
        }
        setDailyResult({ score: data.lastScore ?? localScore, maxScore, awardedPoints: 0, syncing: false, message: data.error || 'Quiz already completed in the last 24 hours.' });
        setResultToast('You have finished both quizzes for today. Play games or pledge Durood & Zikr to earn more points!');
        return;
      }

      if (res.status === 409 && data.duplicateAttempt) {
        setResultToast(data.error || 'You already completed this topic. Choose another topic for your second quiz.');
        setDailyStatus('ready');
        setQuizLockedUntil(null);
        setMode(null);
        setQuizComplete(false);
        setSelectedTopic(null);
        setTopicQuestions([]);
        return;
      }
      
      if (data.success) {
        const awardedPoints = Number(data.points ?? data.awardedPoints ?? 0);
        const serverScore = Number(data.score ?? localScore);
        setDailyResult({ ...data, score: serverScore, maxScore: Number(data.maxScore ?? maxScore), awardedPoints, syncing: false, message: data.message });
        const attemptsToday = Number(data.attemptsToday || 0);
        const maxDailyAttempts = Number(data.maxDailyAttempts || MAX_DAILY_QUIZ_ATTEMPTS);
        setQuizAttemptsToday(attemptsToday);
        const hasUsedAllDailyAttempts = attemptsToday >= maxDailyAttempts;
        setDailyStatus(hasUsedAllDailyAttempts ? 'completed' : 'ready');
        if (hasUsedAllDailyAttempts) {
          setQuizLockedUntil(Number(data.lockedUntil || Date.now() + 24 * 60 * 60 * 1000));
        } else {
          setQuizLockedUntil(null);
        }
        if (data.profile) {
          updateLocalProfile({
            points: Number(data.profile.points ?? profile?.points ?? 0),
            weeklyPoints: Number(data.profile.weeklyPoints ?? profile?.weeklyPoints ?? 0),
            monthlyPoints: Number(data.profile.monthlyPoints ?? profile?.monthlyPoints ?? 0),
            todayPoints: Number(data.profile.todayPoints ?? data.todayPoints ?? 0),
          });
        } else if (awardedPoints > 0) {
          void refreshProfile().catch(() => {});
        }
        if (awardedPoints > 0) {
          setResultToast(`+${awardedPoints} points added!`);
        } else if (data.message) {
          setResultToast(String(data.message));
        }

        showPointsProgress({
          activity: 'quiz',
          activityLabel: 'Daily Quiz',
          pointsEarned: awardedPoints,
          message: data.message ? String(data.message) : undefined,
        });

        trackQuizCompleted({
          topic: String(selectedTopic || ''),
          points: awardedPoints,
          attemptsToday,
        });

        // Refresh profile and competition tracking in the background — don't block the results screen.
        void refreshProfile().catch(() => {});
        if (user?.id) {
          void authJsonFetch('/api/competition/track', {
            method: 'POST',
            body: JSON.stringify({ userId: user.id, activity: 'quiz' }),
          }).catch(() => {});
        }
      } else {
        setDailyResult((prev: any) => ({ ...prev, syncing: false }));
        setResultToast(data.error || 'Submission failed');
      }
    } catch (err) {
      console.error('Submission error:', err);
      const timedOut = err instanceof Error && err.name === 'AbortError';
      setDailyResult((prev: any) => ({
        ...prev,
        syncing: false,
        message: timedOut
          ? 'Score saved locally. Points may take a moment — refresh your profile if needed.'
          : prev?.message,
      }));
      setResultToast(
        timedOut
          ? 'Submission is taking longer than usual. Your score is shown — points will sync when the server responds.'
          : 'Network error submitting quiz. Your score is shown above.'
      );
    }
    })();
    } catch (err) {
      console.error('finishQuiz failed:', err);
      setQuizComplete(true);
      setDailyResult({
        score: 0,
        maxScore: currentQuestions.length,
        awardedPoints: 0,
        syncing: false,
        message: 'Quiz finished — tap Exit and try again if points did not save.',
      });
    }
  };

  const resetPage = () => {
    setMode(null);
    setDailyResult(null);
    setQuizComplete(false);
    setResultToast(null);
    if (!quizLockedUntil) {
      setDailyStatus('ready');
    }
    setCurrentQuestionIndex(0);
    setSelectedAnswer(null);
    setSelectedTopic(null);
    setTopicQuestions([]);
    setActiveQuizId('');
    setShowFeedback(false);
  };

  if (!mounted) {
    return (
      <>
        <div className="min-h-[70vh] flex items-center justify-center bg-[#f5f3ff]">
          <div className="text-[#475569]">Loading...</div>
        </div>
      </>
    );
  }

  if (!mode) {
    return (
      <>
      <div className="min-h-screen bg-[#f5f3ff] pattern-islamic">
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
          {/* Islamic Quiz Challenge — shown at the very top so it is easy to find */}
          <Link
            href="/quiz-challenge"
            className="block rounded-2xl border border-amber-300/50 bg-gradient-to-r from-[#4c1d95] via-[#6d28d9] to-[#7c3aed] p-4 text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl sm:p-5"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl" aria-hidden>🌙</span>
                <div>
                  <p className="text-lg font-black leading-tight sm:text-xl">Safar Islamic Quiz Challenge</p>
                  <p className="text-xs text-violet-100/90 sm:text-sm">
                    Quran Stories &amp; Fiqh quizzes — type your answers, one attempt each!
                  </p>
                </div>
              </div>
              <span className="hidden shrink-0 items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-sm font-bold text-amber-100 sm:inline-flex">
                Play now →
              </span>
            </div>
          </Link>

          <EarnMorePointsLinks title="Earn more points today" />

          {/* Header */}
          <div className="text-center space-y-4">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#f5f3ff] rounded-full border border-[#7c3aed]/20">
              <Sparkles size={16} className="text-[#7c3aed]" />
              <span className="text-sm font-semibold text-[#6d28d9]">Daily Challenge</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-[#1e1b4b]">
              Today's Quiz
            </h1>
            <p className="text-[#475569] text-lg">
              Test your Islamic knowledge and earn points!
            </p>
          </div>

          {/* Daily Quiz Card */}
          <div className="bg-white rounded-2xl shadow-lg border border-[#c4b5fd]/30 overflow-hidden">
            <div className="bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] p-6 text-white">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center">
                    <Trophy size={28} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold">Daily Competition Quiz</h2>
                    <div className="flex items-center gap-2 mt-1 text-white/80">
                      <Calendar size={16} />
                      <span>{todayDate}</span>
                    </div>
                  </div>
                </div>
                <span className="text-5xl">🏆</span>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <DailyPointsBar quizAttemptsUsed={quizAttemptsToday} />

              {/* Status Badge */}
              {dailyStatus === 'completed' && (
                <div className="space-y-3">
                  <div className="inline-flex items-center gap-2 bg-green-50 text-green-700 px-4 py-2 rounded-xl border border-green-200 font-semibold">
                    <CheckCircle size={18} />
                    Both quizzes done for today — Score: {dailyResult?.score ?? 0}
                  </div>
                  {countdown && (
                    <div className="flex items-center gap-2 text-[#475569] text-sm font-semibold">
                      <Clock size={15} className="text-[#cd9456]" />
                      Next quiz available in <span className="text-[#1e1b4b] font-bold ml-1">{countdown}</span>
                    </div>
                  )}
                  <div className="bg-[#fffbeb] rounded-xl p-4 border border-[#fbbf24]/30 text-left">
                    <p className="font-bold text-[#b45309] mb-1">Keep earning today&apos;s points! 🌟</p>
                    <p className="text-[#92400e] text-sm mb-3">
                      You&apos;ve used both daily quizzes ({MAX_DAILY_QUIZ_POINTS} pts). Play games, pledge Durood &amp; Zikr, or log your dhikr — each earns +25 points until you reach {POINTS_DAILY_CAP} for the day.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Link href="/games" className="inline-flex items-center gap-2 bg-[#7c3aed] text-white px-4 py-2 rounded-lg font-bold text-sm hover:bg-[#6d28d9] transition-all">
                        🎮 Play Games
                      </Link>
                      <Link href="/pledge" className="inline-flex items-center gap-2 bg-[#fbbf24] text-[#92400e] px-4 py-2 rounded-lg font-bold text-sm hover:bg-[#f59e0b] transition-all">
                        📿 Durood &amp; Zikr
                      </Link>
                      <Link href="/guide" className="inline-flex items-center gap-2 bg-white text-[#6d28d9] px-4 py-2 rounded-lg font-bold text-sm ring-1 ring-violet-200 hover:bg-violet-50 transition-all">
                        ⭐ Points guide
                      </Link>
                    </div>
                  </div>
                </div>
              )}

              {dailyStatus === 'ready' && quizAttemptsToday > 0 && quizAttemptsToday < MAX_DAILY_QUIZ_ATTEMPTS && (
                <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm font-semibold text-violet-900">
                  {MAX_DAILY_QUIZ_ATTEMPTS - quizAttemptsToday} quiz{MAX_DAILY_QUIZ_ATTEMPTS - quizAttemptsToday === 1 ? '' : 'zes'} left today · +{QUIZ_POINTS_PER_COMPLETION} pts each
                </div>
              )}

              {resultToast && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                  {resultToast}
                </div>
              )}

              {isLoadingTopicQuiz && (
                <div className="rounded-xl border border-[#c4b5fd]/40 bg-[#f5f3ff] px-4 py-3 text-sm font-semibold text-[#6d28d9]">
                  Loading your quiz questions...
                </div>
              )}

              {dailyStatus === 'error' && (
                <div className="inline-flex items-center gap-2 bg-red-50 text-red-700 px-4 py-2 rounded-xl border border-red-200 font-semibold">
                  Quiz temporarily unavailable
                </div>
              )}

              {/* Description */}
              <div className="space-y-3 text-[#1e1b4b]">
                <p className="text-lg">
                  Choose up to two topics each day and complete them to earn {QUIZ_POINTS_PER_COMPLETION} points each ({MAX_DAILY_QUIZ_POINTS} quiz points daily).
                </p>
                <ul className="space-y-2 text-[#475569]">
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#7c3aed]"></span>
                    5 educational questions in each topic
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#fbbf24]"></span>
                    Every completed topic gives +{QUIZ_POINTS_PER_COMPLETION} points (max {MAX_DAILY_QUIZ_ATTEMPTS}/day)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#ff6b6b]"></span>
                    Compete with other learners
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#8b5cf6]"></span>
                    Topics: Quran, Salah, Hadith, Seerah, Sahabah, Akhlaq + Quranic prophet stories
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#0ea5e9]"></span>
                    Questions refresh every day at midnight UTC
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#14b8a6]"></span>
                    Each daily quiz uses new random questions — no repeats the same day
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#7c3aed]"></span>
                    Complete any 5 activities every week to qualify for the winner draw
                  </li>
                </ul>
              </div>

              {/* Topic Buttons */}
              <div className="space-y-6">
                {QUIZ_TOPIC_GROUPS.map((group) => {
                  const groupTopics = QUIZ_TOPICS.filter((topic) => (topic.group || 'general') === group.id)
                  if (!groupTopics.length) return null

                  return (
                    <div key={group.id}>
                      <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-[#6d28d9]">
                        {group.title}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {groupTopics.map((topic) => {
                          const topicCount = getTopicQuestionCount(quizPool as any[], topic.id)
                          const isReady = dailyStatus === 'ready' && user?.id && topicCount >= 5

                          return (
                            <button
                              key={topic.id}
                              onClick={() => startDailyQuiz(topic.id)}
                              disabled={!isReady || isLoadingTopicQuiz}
                              className={`rounded-xl border p-4 text-left transition-all ${
                                isReady
                                  ? 'bg-white border-[#7c3aed]/30 hover:border-[#7c3aed] hover:shadow-md'
                                  : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed'
                              }`}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-2xl">{topic.emoji}</span>
                                <span className="text-xs font-bold px-2 py-1 rounded-full bg-[#f5f3ff] text-[#6d28d9]">
                                  +{QUIZ_POINTS_PER_COMPLETION} pts
                                </span>
                              </div>
                              <p className="font-bold text-[#1e1b4b]">{topic.label}</p>
                              <p className="text-sm text-[#475569]">
                                {topic.description ||
                                  (topic.id === 'quran'
                                    ? 'Story-based Quran learning — new questions daily'
                                    : '5 random questions — new set every day')}
                              </p>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>

              {!user?.id && dailyStatus === 'ready' && (
                <Link
                  href="/signin?next=%2Fquiz"
                  className="block py-4 px-6 rounded-xl font-bold text-lg bg-white text-[#7c3aed] border-2 border-[#7c3aed] hover:bg-[#f5f3ff] transition-all text-center"
                >
                  Sign In to Start Topic Quiz
                </Link>
              )}

              {!user?.id && dailyStatus === 'ready' && (
                <p className="text-sm text-[#475569] text-center">
                  Sign in is required to take a topic quiz and earn points.
                </p>
              )}
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            {[
              { label: 'Your Score', value: dailyResult?.score ?? '-', icon: '🎯' },
              { label: 'Topic', value: selectedTopicInfo?.label || '-', icon: '📚' },
              { label: 'Topic Reward', value: `+${QUIZ_POINTS_PER_COMPLETION}`, icon: '⭐' },
            ].map((stat, idx) => (
              <div key={idx} className="bg-white rounded-xl p-4 text-center border border-[#c4b5fd]/20 shadow-sm">
                <span className="text-2xl">{stat.icon}</span>
                <p className="text-2xl font-bold text-[#1e1b4b] mt-1">{stat.value}</p>
                <p className="text-sm text-[#475569]">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* Tip */}
          <div className="bg-[#fffbeb] rounded-xl p-5 border border-[#fbbf24]/30">
            <div className="flex items-start gap-3">
              <span className="text-2xl">💡</span>
              <div>
                <h4 className="font-bold text-[#b45309] mb-1">Quiz Tip</h4>
                <p className="text-[#92400e] text-sm">
                  Read each question carefully. Take your time - there's no rush! 
                  Remember, the goal is to learn, not just to score points.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      </>
    );
  }

  // Quiz Interface
  return (
    <>
    <div className="min-h-screen bg-[#f5f3ff] py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={resetPage}
            className="flex items-center gap-2 text-[#1e1b4b] hover:text-[#7c3aed] font-semibold transition"
          >
            <ArrowLeft size={20} />
            Exit
          </button>
          <div className="text-sm font-semibold text-[#475569]">
            Question {currentQuestionIndex + 1} of {currentQuestions.length}
          </div>
        </div>

        {!quizComplete ? (
          <div className="bg-white rounded-2xl shadow-lg border border-[#c4b5fd]/30 p-6 sm:p-8">
            {/* Progress Bar */}
            <div className="w-full bg-[#ede9fe] h-3 rounded-full mb-8 overflow-hidden">
              <div
                className="bg-gradient-to-r from-[#7c3aed] to-[#fbbf24] h-full rounded-full transition-all duration-500"
                style={{ width: `${((currentQuestionIndex + 1) / currentQuestions.length) * 100}%` }}
              />
            </div>

            {/* Question meta */}
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center rounded-full bg-[#f5f3ff] text-[#6d28d9] border border-[#7c3aed]/30 px-3 py-1 text-xs font-bold uppercase tracking-wide">
                Topic: {selectedTopicInfo?.label || currentQuestion?.category || 'Islamic Knowledge'}
              </span>
              {currentQuestion?.quranCategory || currentQuestion?.category ? (
                <span className="inline-flex items-center rounded-full bg-[#ecfeff] text-[#0e7490] border border-[#06b6d4]/30 px-3 py-1 text-xs font-semibold">
                  {currentQuestion.quranCategory || currentQuestion.category}
                </span>
              ) : null}
              {currentQuestion?.difficulty ? (
                <span className="inline-flex items-center rounded-full bg-[#fffbeb] text-[#b45309] border border-[#fbbf24]/30 px-3 py-1 text-xs font-semibold">
                  {currentQuestion.difficulty} {difficultyStars(currentQuestion.difficulty)}
                </span>
              ) : null}
            </div>

            {currentQuestion?.story ? (
              <div className="mb-6 rounded-xl border border-[#c4b5fd]/40 bg-[#faf5ff] p-4">
                <p className="text-xs font-bold uppercase tracking-wide text-[#7c3aed] mb-2">Story</p>
                <p className="text-[#312e81] leading-relaxed">{currentQuestion.story}</p>
              </div>
            ) : null}

            <div className="mb-6 flex items-start justify-between gap-3">
              <h2 className="text-xl sm:text-2xl font-bold text-[#1e1b4b] leading-relaxed">
                {currentQuestion?.question_text || currentQuestion?.question}
              </h2>
              <ReadAloudButton
                text={[
                  currentQuestion?.story,
                  currentQuestion?.question_text || currentQuestion?.question,
                  ...(currentQuestion?.options || []).map(
                    (opt: string, i: number) => `Option ${String.fromCharCode(65 + i)}: ${opt}`
                  ),
                ]
                  .filter(Boolean)
                  .join('. ')}
                size="sm"
                className="shrink-0"
              />
            </div>

            {/* Options */}
            <div className="space-y-3">
              {(currentQuestion?.options || []).map((option: string, idx: number) => {
                const isSelected = selectedAnswer === idx;
                const isCorrect = showFeedback && idx === currentQuestion?.correctAnswer;
                const isWrong = showFeedback && isSelected && idx !== currentQuestion?.correctAnswer;

                return (
                  <button
                    key={idx}
                    onClick={() => !showFeedback && handleAnswerSelect(idx)}
                    disabled={showFeedback}
                    className={`w-full p-4 sm:p-5 text-left rounded-xl border-2 transition-all text-base font-semibold ${
                      isCorrect
                        ? 'border-emerald-500 bg-emerald-50 text-emerald-900'
                        : isWrong
                          ? 'border-rose-400 bg-rose-50 text-rose-900'
                          : isSelected
                            ? 'border-[#7c3aed] bg-[#f5f3ff] text-[#6d28d9]'
                            : 'border-[#c4b5fd]/50 bg-white text-[#1e1b4b] hover:border-[#7c3aed]/50 hover:bg-[#ede9fe]'
                    } ${showFeedback ? 'cursor-default' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-10 h-10 rounded-xl border-2 flex items-center justify-center text-sm font-bold shrink-0 ${
                          isSelected
                            ? 'border-[#7c3aed] bg-[#7c3aed] text-white'
                            : 'border-[#c4b5fd] text-[#475569]'
                        }`}
                      >
                        {String.fromCharCode(65 + idx)}
                      </div>
                      <div className="pt-2">{option}</div>
                    </div>
                  </button>
                );
              })}
            </div>

            {showFeedback ? (
              <div className="mt-6 rounded-xl border border-[#7c3aed]/20 bg-[#faf5ff] p-5 space-y-3 text-left">
                <p className={`font-bold ${selectedAnswer === currentQuestion?.correctAnswer ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {selectedAnswer === currentQuestion?.correctAnswer ? 'Correct! MashaAllah 🌟' : 'Not quite — keep learning!'}
                </p>
                {currentQuestion?.explanation ? (
                  <p className="text-[#312e81] leading-relaxed">{currentQuestion.explanation}</p>
                ) : null}
                {currentQuestion?.reference || currentQuestion?.surah ? (
                  <p className="text-sm font-semibold text-[#6d28d9]">
                    {[currentQuestion?.surah, currentQuestion?.reference ? `(${currentQuestion.reference})` : null].filter(Boolean).join(' ')}
                  </p>
                ) : null}
                {currentQuestion?.didYouKnow ? (
                  <div className="rounded-lg bg-[#fffbeb] border border-[#fbbf24]/30 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-wide text-[#b45309] mb-1">Did you know?</p>
                    <p className="text-sm text-[#92400e]">{currentQuestion.didYouKnow}</p>
                  </div>
                ) : null}
              </div>
            ) : null}

            {/* Next Button */}
            <div className="mt-8 pt-6 border-t border-[#c4b5fd]/30">
              <button
                onClick={handleNext}
                disabled={selectedAnswer === null}
                className={`w-full py-4 rounded-xl font-bold text-lg transition-all ${
                  selectedAnswer !== null
                    ? 'bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] text-white shadow-lg hover:shadow-xl'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                {!showFeedback
                  ? 'Check Answer'
                  : currentQuestionIndex === currentQuestions.length - 1
                    ? 'Finish Quiz'
                    : 'Next Question'}
              </button>
            </div>
          </div>
        ) : (
          // Quiz Complete View
          <div className="bg-white rounded-2xl shadow-lg border border-[#c4b5fd]/30 p-8 text-center">
            <>
              <div className="w-24 h-24 bg-gradient-to-br from-[#fbbf24] to-[#f59e0b] rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Trophy size={48} className="text-white" />
              </div>
              <h2 className="text-3xl font-bold text-[#1e1b4b] mb-2">Quiz Completed!</h2>
              <p className="text-[#475569] mb-6">MashaAllah! You finished the daily quiz.</p>
              {dailyResult?.syncing ? (
                <p className="mb-4 text-sm font-semibold text-[#6d28d9]">Saving your score and points…</p>
              ) : null}

              <div className="space-y-4 mb-8">
                  <div className="bg-[#f5f3ff] rounded-xl p-4">
                    <p className="text-sm text-[#6d28d9] font-semibold uppercase tracking-wide">Your Score</p>
                    <p className="text-4xl font-bold text-[#7c3aed]">
                      {Math.round(Number(dailyResult?.score ?? 0) / 10)} / {currentQuestions.length}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-[#6d28d9]">
                      {dailyResult?.score ?? 0} points
                    </p>
                  </div>

                  {dailyResult?.streak > 0 && (
                    <div className="inline-flex items-center gap-2 bg-orange-50 text-orange-700 px-4 py-2 rounded-xl border border-orange-200 font-semibold">
                      🔥 {dailyResult.streak} Day Streak!
                    </div>
                  )}

                  {dailyResult?.awardedPoints > 0 ? (
                    <p className="text-[#7c3aed] font-bold text-lg">+{dailyResult.awardedPoints} Points Added to Leaderboard! ⭐</p>
                  ) : (
                    <p className="text-[#475569]">{dailyResult?.message || 'No points awarded for this attempt.'}</p>
                  )}

                  <div className="bg-[#f5f3ff] rounded-xl p-4 border border-[#7c3aed]/20 text-left">
                    <p className="font-bold text-[#6d28d9] mb-1">New games added! 🎮</p>
                    <p className="text-[#5b21b6] text-sm mb-3">
                      Want to gain more points? Check out the Games page and try the newest games.
                    </p>
                    <Link href="/games" className="inline-flex items-center gap-2 bg-[#7c3aed] text-white px-4 py-2 rounded-lg font-bold text-sm hover:opacity-95 transition-all">
                      Play Games →
                    </Link>
                  </div>

                  {/* Pledge CTA */}
                  <div className="bg-[#fffbeb] rounded-xl p-4 border border-[#fbbf24]/30 text-left">
                    <p className="font-bold text-[#b45309] mb-1">Want to earn more points? 🌟</p>
                    <p className="text-[#92400e] text-sm mb-2">
                      You can pledge Durood &amp; Zikr to earn extra bonus points after your quizzes. Come back tomorrow for two brand new quiz chances!
                    </p>
                    {countdown && (
                      <p className="flex items-center gap-1.5 text-xs text-[#475569] font-semibold mb-3">
                        <Clock size={13} /> Next quiz in <span className="text-[#1e1b4b] font-bold ml-1">{countdown}</span>
                      </p>
                    )}
                    <Link href="/pledge" className="inline-flex items-center gap-2 bg-[#fbbf24] text-[#92400e] px-4 py-2 rounded-lg font-bold text-sm hover:bg-[#f59e0b] transition-all">
                      📿 Pledge Durood &amp; Zikr →
                    </Link>
                  </div>
                </div>

                {resultToast && (
                  <div className="mb-6 p-4 bg-blue-50 text-blue-700 rounded-xl text-sm">
                    {resultToast}
                  </div>
                )}

                <button
                  onClick={resetPage}
                  className="w-full py-4 bg-gradient-to-r from-[#7c3aed] to-[#6d28d9] text-white font-bold rounded-xl shadow-lg hover:shadow-xl transition-all"
                >
                  Return to Quiz Menu
                </button>
            </>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
