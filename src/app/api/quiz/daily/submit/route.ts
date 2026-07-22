import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ensureUserRecords } from '@/lib/ensure-user-records';
import { awardPointsWithDailyCapByUserId } from '@/lib/server-points';
import { getStaticQuiz } from '@/lib/quiz-generator';
import { filterQuestionsByTopic, getDailyTopicSeed, parseTopicQuizId } from '@/lib/quiz-topics';
import { resolveTopicQuizQuestionsFromIds, resolveSubmittedTopicQuestions } from '@/lib/quiz-topic-questions';
import { getTopicQuestionExclusions } from '@/lib/quiz-user-history';
import { isTestModeEmail } from '@/lib/test-mode';
import { POINTS_DAILY_CAP, QUIZ_POINTS_PER_COMPLETION, MAX_DAILY_QUIZ_ATTEMPTS } from '@/lib/points-policy';
import { createSessionQuizRecordId } from '@/lib/topic-quiz-record';
import { randomUUID } from 'crypto';
import { requireMatchingUser } from '@/lib/request-auth';

function getUtcDayWindow() {
  const now = new Date();
  const dayStart = new Date(Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
    0,
    0,
    0,
    0
  ));
  const nextDayStart = new Date(dayStart);
  nextDayStart.setUTCDate(nextDayStart.getUTCDate() + 1);

  return {
    dayStartIso: dayStart.toISOString(),
    nextDayStartIso: nextDayStart.toISOString(),
    nextDayStartMs: nextDayStart.getTime(),
  };
}

/**
 * Returns a 429 response when the user hit the daily limit, otherwise null, plus
 * the number of attempts already completed today (so callers can build the
 * post-submit summary without a second COUNT query).
 */
async function enforceDailyQuizAttemptLimit(
  userId: string
): Promise<{ blocked: NextResponse | null; attemptsToday: number }> {
  const { dayStartIso, nextDayStartIso, nextDayStartMs } = getUtcDayWindow();
  const { data, count, error } = await supabaseAdmin
    .from('quiz_attempts')
    .select('score, completed_at', { count: 'exact' })
    .eq('user_id', userId)
    .gte('completed_at', dayStartIso)
    .lt('completed_at', nextDayStartIso)
    .order('completed_at', { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const attemptsToday = Number(count || 0);
  if (attemptsToday >= MAX_DAILY_QUIZ_ATTEMPTS) {
    const timeRemaining = Math.max(0, Math.ceil((nextDayStartMs - Date.now()) / 1000));
    const lastScore = Array.isArray(data) && data[0] ? Number((data[0] as any).score ?? 0) : null;
    return {
      attemptsToday,
      blocked: NextResponse.json(
        {
          error: `You have already completed ${MAX_DAILY_QUIZ_ATTEMPTS} quizzes today. Come back tomorrow for more points.`,
          locked: true,
          lockedUntil: nextDayStartMs,
          lastScore,
          attemptsToday,
          maxDailyAttempts: MAX_DAILY_QUIZ_ATTEMPTS,
          timeRemaining,
        },
        { status: 429 }
      ),
    };
  }

  return { blocked: null, attemptsToday };
}

/** Build the attempt summary from a known count (no DB query). */
function attemptSummaryFromCount(attemptsToday: number) {
  const { nextDayStartMs } = getUtcDayWindow();
  return {
    attemptsToday,
    maxDailyAttempts: MAX_DAILY_QUIZ_ATTEMPTS,
    remainingDailyAttempts: Math.max(0, MAX_DAILY_QUIZ_ATTEMPTS - attemptsToday),
    lockedUntil: nextDayStartMs,
  };
}

async function getTodaysQuizAttemptSummary(userId: string) {
  const { dayStartIso, nextDayStartIso, nextDayStartMs } = getUtcDayWindow();
  const { count, error } = await supabaseAdmin
    .from('quiz_attempts')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('completed_at', dayStartIso)
    .lt('completed_at', nextDayStartIso);

  if (error) {
    throw error;
  }

  const attemptsToday = Number(count || 0);
  return {
    attemptsToday,
    maxDailyAttempts: MAX_DAILY_QUIZ_ATTEMPTS,
    remainingDailyAttempts: Math.max(0, MAX_DAILY_QUIZ_ATTEMPTS - attemptsToday),
    lockedUntil: nextDayStartMs,
  };
}

async function ensureFallbackDailyQuizId(dateOrWeekSeed: string, questionIds: string[], topicId?: string, userId?: string): Promise<string> {
  if (topicId) {
    return createSessionQuizRecordId(topicId, questionIds, `${userId || 'anon'}:${topicId}:${randomUUID()}`);
  }

  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('daily_quizzes')
    .select('id')
    .eq('quiz_date', dateOrWeekSeed)
    .maybeSingle();

  if (!existingErr && existing?.id) return existing.id;

  const { data: inserted, error: insertErr } = await supabaseAdmin
    .from('daily_quizzes')
    .insert({
      quiz_date: dateOrWeekSeed,
      question_ids: questionIds,
      is_published: false,
    })
    .select('id')
    .single();

  if (!insertErr && inserted?.id) return inserted.id;

  const { data: reread, error: rereadErr } = await supabaseAdmin
    .from('daily_quizzes')
    .select('id')
    .eq('quiz_date', dateOrWeekSeed)
    .single();

  if (rereadErr || !reread?.id) {
    throw new Error(insertErr?.message || rereadErr?.message || 'Could not resolve fallback quiz ID');
  }

  return reread.id;
}

async function awardQuizPoints(userId: string, totalPoints: number, isTestMode: boolean) {
  if (isTestMode || totalPoints <= 0) {
    return {
      pointsAwarded: 0,
      reason: isTestMode ? 'test_mode' : null,
      todayPoints: 0,
      dailyLimit: POINTS_DAILY_CAP,
    };
  }

  const result = await awardPointsWithDailyCapByUserId(userId, totalPoints, {
    successMessage: `Topic completed! +${QUIZ_POINTS_PER_COMPLETION} points added to leaderboard.`,
    // The submit route already validated test mode and ensured user records —
    // skip re-doing those inside the points helper to avoid extra round trips.
    knownIsTestMode: isTestMode,
    skipEnsureUserRecords: true,
  });

  return {
    pointsAwarded: result.pointsAwarded,
    reason: result.reason,
    todayPoints: result.todayPoints,
    totalPoints: result.totalPoints,
    weeklyPoints: result.weeklyPoints,
    monthlyPoints: result.monthlyPoints,
    dailyLimit: result.dailyLimit,
  };
}

function successNoPoints(score: number, maxScore: number, totalPossiblePoints: number, flags?: Record<string, unknown>) {
  return {
    success: true,
    score,
    maxScore,
    points: 0,
    totalPossiblePoints,
    message: 'Test mode active. Retry accepted without leaderboard points.',
    reason: 'test_mode_retry',
    todayPoints: 0,
    dailyLimit: POINTS_DAILY_CAP,
    ...flags,
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { userId, quizId, answers, durationSeconds, topic, questionIds: submittedQuestionIds } = body;

    const auth = await requireMatchingUser(req, String(userId || ''));
    if (!auth.ok) return auth.response;

    if (!quizId || !answers) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Compute test mode from the already-validated token email (no extra auth round trip).
    const isTestMode = isTestModeEmail(auth.user.email);

    if (quizId.startsWith('topic-')) {
      const parsed = parseTopicQuizId(String(quizId));
      const topicFromId = parsed?.topicId || topic;
      const daySeedFromId = parsed?.weekSeed || getDailyTopicSeed();

      if (!topicFromId) {
        return NextResponse.json({ error: 'No questions available for this topic.' }, { status: 400 });
      }

      const submittedIds = Array.isArray(submittedQuestionIds)
        ? submittedQuestionIds.map((id: string) => String(id))
        : [];

      const fromClient = resolveSubmittedTopicQuestions(topicFromId, submittedIds);
      const hasTrustedClientQuestions = fromClient.length > 0;

      const activeQuestionsEarly = hasTrustedClientQuestions ? fromClient : null;

      // Parallelize independent reads. Skip question-history lookup when the client sent a valid set.
      const [ensured, exclusions, limit, sessionQuizRecordId] = await Promise.all([
        ensureUserRecords(auth.userId),
        hasTrustedClientQuestions
          ? Promise.resolve({ today: [] as string[], recent: [] as string[], attemptsToday: 0 })
          : getTopicQuestionExclusions(userId, topicFromId),
        isTestMode
          ? Promise.resolve({ blocked: null as NextResponse | null, attemptsToday: 0 })
          : enforceDailyQuizAttemptLimit(userId),
        activeQuestionsEarly
          ? createSessionQuizRecordId(
              topicFromId,
              activeQuestionsEarly.map((q: any) => String(q.id)),
              `${userId}:${topicFromId}:${randomUUID()}`
            )
          : Promise.resolve(''),
      ]);

      if (!ensured.ok) {
        console.error('Failed to ensure user records for quiz submit:', ensured.error);
        return NextResponse.json({ error: 'Could not prepare user profile for quiz submission.' }, { status: 500 });
      }
      if (limit.blocked) return limit.blocked;
      const priorAttemptsToday = limit.attemptsToday;

      const activeQuestions =
        hasTrustedClientQuestions
          ? fromClient
          : resolveTopicQuizQuestionsFromIds(
              topicFromId,
              daySeedFromId,
              userId,
              submittedIds,
              [...new Set([...exclusions.today, ...exclusions.recent])],
              exclusions.attemptsToday
            );

      if (!activeQuestions.length) {
        return NextResponse.json({ error: 'No questions available for this topic.' }, { status: 400 });
      }

      const allowedQuestionIds = new Set(activeQuestions.map((q: any) => String(q.id)));

      const resolvedSessionQuizRecordId =
        sessionQuizRecordId ||
        (await createSessionQuizRecordId(
          topicFromId,
          activeQuestions.map((q: any) => String(q.id)),
          `${userId}:${topicFromId}:${randomUUID()}`
        ));

      let correctCount = 0;
      const questionMap = new Map(activeQuestions.map((q: any) => [String(q.id), q]));
      for (const [qId, ansIdx] of Object.entries(answers)) {
        if (!allowedQuestionIds.has(String(qId))) continue;
        const q = questionMap.get(String(qId));
        if (q && Number(q.correctAnswer) === Number(ansIdx)) correctCount++;
      }

      const score = correctCount * 10;
      const maxScore = activeQuestions.length * 10;
      const isCompletedTopic = activeQuestions.every((q: any) => Object.prototype.hasOwnProperty.call(answers, String(q.id)));
      const totalPoints = isCompletedTopic ? QUIZ_POINTS_PER_COMPLETION : 0;

      const { error: attemptError } = await supabaseAdmin.from('quiz_attempts').insert({
        user_id: userId,
        quiz_id: resolvedSessionQuizRecordId,
        topic: topicFromId,
        question_ids: activeQuestions.map((q: any) => String(q.id)),
        score,
        max_score: maxScore,
        duration_seconds: durationSeconds,
        is_perfect_score: score === maxScore,
        is_flagged: durationSeconds < 20,
        completed_at: new Date().toISOString(),
      });

      if (attemptError) {
        if (attemptError.code === '23505') {
          if (isTestMode) {
            return NextResponse.json(successNoPoints(score, maxScore, totalPoints, { isTopicQuiz: true }));
          }
          return NextResponse.json(
            {
              error: 'You have already completed this topic quiz. Pick a different topic for your second daily quiz.',
              duplicateAttempt: true,
            },
            { status: 409 }
          );
        }
        throw attemptError;
      }

      const awardResult = await awardQuizPoints(userId, totalPoints, isTestMode);

      const finalPointsAwarded = awardResult.pointsAwarded;
      const attemptSummary = isTestMode
        ? await getTodaysQuizAttemptSummary(userId)
        : attemptSummaryFromCount(priorAttemptsToday + 1);
      const awardMessage = isTestMode
        ? 'Test mode active. Quiz recorded, but no leaderboard points were added.'
        : finalPointsAwarded > 0
          ? `Topic completed! +${QUIZ_POINTS_PER_COMPLETION} points added to leaderboard.`
          : awardResult.reason === 'daily_limit_reached'
            ? `You have reached today's ${POINTS_DAILY_CAP}-point limit. Quiz completed, but no points were added.`
            : awardResult.reason === 'update_failed'
              ? 'Quiz completed, but points could not be added right now.'
              : 'Quiz completed, but points could not be added right now.';

      return NextResponse.json({
        success: true,
        score,
        maxScore,
        points: finalPointsAwarded,
        awardedPoints: finalPointsAwarded,
        totalPossiblePoints: totalPoints,
        message: awardMessage,
        reason: awardResult.reason,
        todayPoints: awardResult.todayPoints,
        dailyLimit: awardResult.dailyLimit,
        isTopicQuiz: true,
        attemptsToday: attemptSummary.attemptsToday,
        maxDailyAttempts: attemptSummary.maxDailyAttempts,
        remainingDailyAttempts: attemptSummary.remainingDailyAttempts,
        lockedUntil: attemptSummary.lockedUntil,
        profile: {
          points: awardResult.totalPoints,
          todayPoints: awardResult.todayPoints,
          weeklyPoints: awardResult.weeklyPoints,
          monthlyPoints: awardResult.monthlyPoints,
        },
      });
    }

    if (quizId.startsWith('fallback-')) {
      const [ensured, limit] = await Promise.all([
        ensureUserRecords(auth.userId),
        isTestMode
          ? Promise.resolve({ blocked: null as NextResponse | null, attemptsToday: 0 })
          : enforceDailyQuizAttemptLimit(userId),
      ]);
      if (!ensured.ok) {
        return NextResponse.json({ error: 'Could not prepare user profile for quiz submission.' }, { status: 500 });
      }
      if (limit.blocked) return limit.blocked;
      const priorAttemptsToday = limit.attemptsToday;

      const date = quizId.replace('fallback-', '');
      const staticQuiz = getStaticQuiz(date);
      const questions = staticQuiz.questions;
      const topicScopedQuestions = filterQuestionsByTopic(questions, topic);
      const activeQuestions = topicScopedQuestions.length > 0 ? topicScopedQuestions : questions;

      const allowedQuestionIds = new Set(
        Array.isArray(submittedQuestionIds) && submittedQuestionIds.length > 0
          ? submittedQuestionIds.map((id: string) => String(id))
          : activeQuestions.map((q: any) => String(q.id))
      );

      const scoredQuestions = activeQuestions.filter((q: any) => allowedQuestionIds.has(String(q.id)));
      if (!scoredQuestions.length) {
        return NextResponse.json({ error: 'No questions available for this topic.' }, { status: 400 });
      }

      const fallbackDailyQuizId = await ensureFallbackDailyQuizId(
        date,
        scoredQuestions.map((q: any) => String(q.id)),
        topic,
        userId
      );

      let correctCount = 0;
      const questionMap = new Map(scoredQuestions.map((q: any) => [String(q.id), q]));
      for (const [qId, ansIdx] of Object.entries(answers)) {
        if (!allowedQuestionIds.has(String(qId))) continue;
        const q = questionMap.get(String(qId));
        if (q && Number(q.correctAnswer) === Number(ansIdx)) correctCount++;
      }

      const score = correctCount * 10;
      const maxScore = scoredQuestions.length * 10;
      const isCompletedTopic = scoredQuestions.every((q: any) => Object.prototype.hasOwnProperty.call(answers, String(q.id)));
      const totalPoints = isCompletedTopic ? QUIZ_POINTS_PER_COMPLETION : 0;

      const { error: attemptError } = await supabaseAdmin.from('quiz_attempts').insert({
        user_id: userId,
        quiz_id: fallbackDailyQuizId,
        topic: topic || null,
        score,
        max_score: maxScore,
        duration_seconds: durationSeconds,
        is_perfect_score: score === maxScore,
        is_flagged: false,
        completed_at: new Date().toISOString(),
      });

      if (attemptError) {
        if (isTestMode && attemptError.code === '23505') {
          return NextResponse.json(successNoPoints(score, maxScore, totalPoints, { isFallback: true }));
        }
        throw attemptError;
      }

      const awardResult = await awardQuizPoints(userId, totalPoints, isTestMode);

      const finalPointsAwarded = awardResult.pointsAwarded;
      const attemptSummary = isTestMode
        ? await getTodaysQuizAttemptSummary(userId)
        : attemptSummaryFromCount(priorAttemptsToday + 1);
      const awardMessage = isTestMode
        ? 'Test mode active. Quiz recorded, but no leaderboard points were added.'
        : finalPointsAwarded > 0
          ? `Topic completed! +${QUIZ_POINTS_PER_COMPLETION} points added to leaderboard.`
          : awardResult.reason === 'daily_limit_reached'
            ? `You have reached today's ${POINTS_DAILY_CAP}-point limit. Quiz completed, but no points were added.`
            : awardResult.reason === 'update_failed'
              ? 'Quiz completed, but points could not be added right now.'
              : 'Quiz completed, but points could not be added right now.';

      return NextResponse.json({
        success: true,
        score,
        maxScore,
        points: finalPointsAwarded,
        totalPossiblePoints: totalPoints,
        message: awardMessage,
        reason: awardResult.reason,
        todayPoints: awardResult.todayPoints,
        dailyLimit: awardResult.dailyLimit,
        isFallback: true,
        attemptsToday: attemptSummary.attemptsToday,
        maxDailyAttempts: attemptSummary.maxDailyAttempts,
        remainingDailyAttempts: attemptSummary.remainingDailyAttempts,
        lockedUntil: attemptSummary.lockedUntil,
      });
    }

    const { data: quiz, error: quizError } = await supabaseAdmin
      .from('daily_quizzes')
      .select('question_ids')
      .eq('id', quizId)
      .single();

    if (quizError || !quiz) {
      return NextResponse.json({ error: 'Quiz not found' }, { status: 404 });
    }

    const questionIds = quiz.question_ids as string[];
    const { data: questions, error: qError } = await supabaseAdmin
      .from('questions')
      .select('id, category, correct_answer_index')
      .in('id', questionIds);

    if (qError || !questions) {
      return NextResponse.json({ error: 'Questions not found' }, { status: 500 });
    }

    const topicScopedQuestions = filterQuestionsByTopic(questions, topic);
    const candidateQuestions = topicScopedQuestions.length > 0 ? topicScopedQuestions : questions;
    const allowedQuestionIds = new Set(
      Array.isArray(submittedQuestionIds) && submittedQuestionIds.length > 0
        ? submittedQuestionIds.map((id: string) => String(id))
        : candidateQuestions.map((q) => String(q.id))
    );

    const activeQuestionIds = candidateQuestions
      .map((q) => String(q.id))
      .filter((id) => allowedQuestionIds.has(id));

    if (!activeQuestionIds.length) {
      return NextResponse.json({ error: 'No questions available for this topic.' }, { status: 400 });
    }

    let correctCount = 0;
    const questionMap = new Map(questions.map((q) => [String(q.id), q.correct_answer_index]));
    for (const [qId, ansIdx] of Object.entries(answers)) {
      if (!allowedQuestionIds.has(String(qId))) continue;
      if (questionMap.get(String(qId)) === Number(ansIdx)) correctCount++;
    }

    const score = correctCount * 10;
    const maxScore = activeQuestionIds.length * 10;
    const isPerfect = score === maxScore;
    const isFlagged = Number(durationSeconds) < 20;

    const [ensured, limit, existingAttemptRes] = await Promise.all([
      ensureUserRecords(auth.userId),
      isTestMode
        ? Promise.resolve({ blocked: null as NextResponse | null, attemptsToday: 0 })
        : enforceDailyQuizAttemptLimit(userId),
      supabaseAdmin
        .from('quiz_attempts')
        .select('id')
        .eq('user_id', userId)
        .eq('quiz_id', quizId)
        .maybeSingle(),
    ]);

    if (!ensured.ok) {
      return NextResponse.json({ error: 'Could not prepare user profile for quiz submission.' }, { status: 500 });
    }
    if (limit.blocked) return limit.blocked;
    const priorAttemptsToday = limit.attemptsToday;

    const existingAttempt = existingAttemptRes.data;
    if (!isTestMode && existingAttempt) {
      return NextResponse.json({ error: 'You have already attempted this quiz.' }, { status: 400 });
    }

    const { data: attempt, error: attemptError } = await supabaseAdmin
      .from('quiz_attempts')
      .insert({
        user_id: userId,
        quiz_id: quizId,
        score,
        max_score: maxScore,
        duration_seconds: durationSeconds,
        is_perfect_score: isPerfect,
        is_flagged: isFlagged,
        completed_at: new Date().toISOString(),
      })
      .select()
      .single();

    const isCompletedTopic = activeQuestionIds.every((id) => Object.prototype.hasOwnProperty.call(answers, id));
    const totalPoints = isCompletedTopic ? QUIZ_POINTS_PER_COMPLETION : 0;

    if (attemptError) {
      if (isTestMode && attemptError.code === '23505') {
        return NextResponse.json(successNoPoints(score, maxScore, totalPoints, { attemptId: null }));
      }
      throw attemptError;
    }

    const awardResult = await awardQuizPoints(userId, totalPoints, isTestMode);

    const finalPointsAwarded = awardResult.pointsAwarded;
    const attemptSummary = isTestMode
      ? await getTodaysQuizAttemptSummary(userId)
      : attemptSummaryFromCount(priorAttemptsToday + 1);
    const awardMessage = isTestMode
      ? 'Test mode active. Quiz recorded, but no leaderboard points were added.'
      : finalPointsAwarded > 0
        ? `Topic completed! +${QUIZ_POINTS_PER_COMPLETION} points added to leaderboard.`
        : awardResult.reason === 'daily_limit_reached'
          ? `You have reached today's ${POINTS_DAILY_CAP}-point limit. Quiz completed, but no points were added.`
          : awardResult.reason === 'update_failed'
            ? 'Quiz completed, but points could not be added right now.'
            : 'Quiz completed, but points could not be added right now.';

    return NextResponse.json({
      success: true,
      score,
      maxScore,
      points: finalPointsAwarded,
      totalPossiblePoints: totalPoints,
      message: awardMessage,
      reason: awardResult.reason,
      todayPoints: awardResult.todayPoints,
      dailyLimit: awardResult.dailyLimit,
      attemptId: attempt.id,
      attemptsToday: attemptSummary.attemptsToday,
      maxDailyAttempts: attemptSummary.maxDailyAttempts,
      remainingDailyAttempts: attemptSummary.remainingDailyAttempts,
      lockedUntil: attemptSummary.lockedUntil,
    });
  } catch (err: any) {
    console.error('Submit error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
