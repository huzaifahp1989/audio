import { supabaseAdmin } from '@/lib/supabase-admin';
import { ensureUserRecords } from '@/lib/ensure-user-records';
import { POINTS_DAILY_CAP, resolvePointsToAward } from '@/lib/points-policy';
import { shouldResetMonthlyPoints } from '@/lib/weekly-activity';
import { isTestModeUserId } from '@/lib/test-mode-server';

export type ServerAwardReason = 'awarded' | 'daily_limit_reached' | 'test_mode' | 'invalid_points' | 'update_failed';

export type ServerAwardPointsResult = {
  success: boolean;
  reason: ServerAwardReason;
  message: string;
  pointsAwarded: number;
  totalPoints: number;
  weeklyPoints: number;
  monthlyPoints: number;
  todayPoints: number;
  dailyLimit: number;
  badges: number;
  level: number;
};

type ServerAwardOptions = {
  countTowardDailyLimit?: boolean;
  successMessage?: string;
  /** Skip the internal test-mode lookup when the caller already knows it (avoids an auth round trip). */
  knownIsTestMode?: boolean;
  /** Skip ensureUserRecords when the caller already ran it (avoids redundant reads/writes). */
  skipEnsureUserRecords?: boolean;
};

export async function awardPointsWithDailyCapByUserId(
  userId: string,
  requestedPoints: number,
  options: ServerAwardOptions = {}
): Promise<ServerAwardPointsResult> {
  const countTowardDailyLimit = options.countTowardDailyLimit !== false;

  if (!requestedPoints || requestedPoints <= 0) {
    return {
      success: false,
      reason: 'invalid_points',
      message: 'Points must be greater than 0.',
      pointsAwarded: 0,
      totalPoints: 0,
      weeklyPoints: 0,
      monthlyPoints: 0,
      todayPoints: 0,
      dailyLimit: POINTS_DAILY_CAP,
      badges: 0,
      level: 1,
    };
  }

  const isTestMode = options.knownIsTestMode ?? (await isTestModeUserId(userId));
  if (isTestMode) {
    return {
      success: true,
      reason: 'test_mode',
      message: 'Test mode active for this account. Mission bonus is tracked but no leaderboard points are added.',
      pointsAwarded: 0,
      totalPoints: 0,
      weeklyPoints: 0,
      monthlyPoints: 0,
      todayPoints: 0,
      dailyLimit: POINTS_DAILY_CAP,
      badges: 0,
      level: 1,
    };
  }

  if (!options.skipEnsureUserRecords) {
    const ensured = await ensureUserRecords(userId);
    if (!ensured.ok) {
      return {
        success: false,
        reason: 'update_failed',
        message: ensured.error || 'Could not prepare user profile for points.',
        pointsAwarded: 0,
        totalPoints: 0,
        weeklyPoints: 0,
        monthlyPoints: 0,
        todayPoints: 0,
        dailyLimit: POINTS_DAILY_CAP,
        badges: 0,
        level: 1,
      };
    }
  }

  const todayStr = new Date().toISOString().slice(0, 10);

  const [pointsRowRes, userRowRes] = await Promise.all([
    supabaseAdmin
      .from('users_points')
      .select('total_points, weekly_points, monthly_points, today_points, last_earned_date, badges, level')
      .eq('user_id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('users')
      .select('points, weeklypoints, monthlypoints')
      .eq('uid', userId)
      .maybeSingle(),
  ]);

  if (pointsRowRes.error) {
    return {
      success: false,
      reason: 'update_failed',
      message: pointsRowRes.error.message,
      pointsAwarded: 0,
      totalPoints: 0,
      weeklyPoints: 0,
      monthlyPoints: 0,
      todayPoints: 0,
      dailyLimit: POINTS_DAILY_CAP,
      badges: 0,
      level: 1,
    };
  }

  if (userRowRes.error) {
    return {
      success: false,
      reason: 'update_failed',
      message: userRowRes.error.message,
      pointsAwarded: 0,
      totalPoints: 0,
      weeklyPoints: 0,
      monthlyPoints: 0,
      todayPoints: 0,
      dailyLimit: POINTS_DAILY_CAP,
      badges: 0,
      level: 1,
    };
  }

  const existingRow = pointsRowRes.data;
  const userRow = userRowRes.data;

  const baseTotal = Number(existingRow?.total_points ?? userRow?.points ?? 0);
  const baseWeekly = Number(existingRow?.weekly_points ?? userRow?.weeklypoints ?? 0);
  let baseMonthly = Number(existingRow?.monthly_points ?? userRow?.monthlypoints ?? 0);
  if (shouldResetMonthlyPoints(existingRow?.last_earned_date)) {
    baseMonthly = 0;
  }
  const isNewDay = !existingRow?.last_earned_date || existingRow.last_earned_date !== todayStr;
  const currentTodayPoints = isNewDay ? 0 : Number(existingRow?.today_points ?? 0);

  const pointsAwarded = resolvePointsToAward(
    requestedPoints,
    currentTodayPoints,
    countTowardDailyLimit
  );

  if (pointsAwarded <= 0) {
    const badges = Math.floor(baseTotal / 100);
    const level = 1 + Math.floor(badges / 5);
    const atDailyCap = countTowardDailyLimit && currentTodayPoints >= POINTS_DAILY_CAP;
    return {
      success: true,
      reason: 'daily_limit_reached',
      message: atDailyCap
        ? `You have already reached today's ${POINTS_DAILY_CAP} point limit.`
        : `No points could be added right now.`,
      pointsAwarded: 0,
      totalPoints: baseTotal,
      weeklyPoints: baseWeekly,
      monthlyPoints: baseMonthly,
      todayPoints: currentTodayPoints,
      dailyLimit: POINTS_DAILY_CAP,
      badges,
      level,
    };
  }

  const totalPoints = baseTotal + pointsAwarded;
  const weeklyPoints = baseWeekly + pointsAwarded;
  const monthlyPoints = baseMonthly + pointsAwarded;
  const todayPoints = countTowardDailyLimit ? currentTodayPoints + pointsAwarded : currentTodayPoints;
  const badges = Math.floor(totalPoints / 100);
  const level = 1 + Math.floor(badges / 5);

  const [{ error: upsertError }, usersSync] = await Promise.all([
    supabaseAdmin.from('users_points').upsert(
      {
        user_id: userId,
        total_points: totalPoints,
        weekly_points: weeklyPoints,
        monthly_points: monthlyPoints,
        today_points: todayPoints,
        last_earned_date: todayStr,
        badges,
        level,
      },
      { onConflict: 'user_id' }
    ),
    supabaseAdmin
      .from('users')
      .update({
        points: totalPoints,
        weeklypoints: weeklyPoints,
        monthlypoints: monthlyPoints,
      })
      .eq('uid', userId),
  ]);

  if (upsertError) {
    return {
      success: false,
      reason: 'update_failed',
      message: upsertError.message,
      pointsAwarded: 0,
      totalPoints: baseTotal,
      weeklyPoints: baseWeekly,
      monthlyPoints: baseMonthly,
      todayPoints: currentTodayPoints,
      dailyLimit: POINTS_DAILY_CAP,
      badges: Math.floor(baseTotal / 100),
      level: 1 + Math.floor(Math.floor(baseTotal / 100) / 5),
    };
  }

  if (usersSync.error) {
    console.error('[server-points] users sync failed:', usersSync.error.message);
  }

  return {
    success: true,
    reason: 'awarded',
    message: options.successMessage || `Mission bonus claimed. +${pointsAwarded} points added.`,
    pointsAwarded,
    totalPoints,
    weeklyPoints,
    monthlyPoints,
    todayPoints,
    dailyLimit: POINTS_DAILY_CAP,
    badges,
    level,
  };
}
