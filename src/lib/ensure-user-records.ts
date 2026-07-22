import { supabaseAdmin } from '@/lib/supabase-admin';
import { normalizeFamilyEmail, normalizeUsername, parseAge } from '@/lib/family-accounts';

function isPlaceholderName(name: string | null | undefined): boolean {
  if (!name) return true;
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (/^learner\b/i.test(trimmed)) return true;
  if (/^user[-_][a-z0-9]+$/i.test(trimmed)) return true;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed);
}

export type EnsureUserRecordsResult = {
  ok: boolean;
  userId: string;
  createdUser: boolean;
  createdPoints: boolean;
  error?: string;
};

/**
 * Server-side: guarantee public.users + users_points rows exist for a signed-up auth user.
 * Required before awarding points or showing on the leaderboard.
 */
export async function ensureUserRecords(userId: string): Promise<EnsureUserRecordsResult> {
  const uid = String(userId || '').trim();
  if (!uid) {
    return { ok: false, userId: '', createdUser: false, createdPoints: false, error: 'Missing user id.' };
  }

  // Fast path for quiz submit and other hot paths: skip auth.admin lookup when rows exist.
  {
    const [userProbe, pointsProbe] = await Promise.all([
      supabaseAdmin.from('users').select('uid').eq('uid', uid).maybeSingle(),
      supabaseAdmin.from('users_points').select('user_id').eq('user_id', uid).maybeSingle(),
    ]);
    if (!userProbe.error && !pointsProbe.error && userProbe.data?.uid && pointsProbe.data?.user_id) {
      return { ok: true, userId: uid, createdUser: false, createdPoints: false };
    }
  }

  let authName = '';
  let authEmail = '';
  let metaAge: number | null = null;
  let metaUsername = '';
  let metaFamilyEmail = '';
  let metaCity = '';
  try {
    const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.getUserById(uid);
    if (authErr) {
      console.warn('[ensureUserRecords] auth lookup failed:', authErr.message);
    } else {
      const meta = (authData.user?.user_metadata as Record<string, unknown>) || {};
      authName = String(meta.name || meta.full_name || meta.fullName || '').trim();
      authEmail = String(authData.user?.email || '').trim();
      metaAge = parseAge(meta.age);
      metaUsername = normalizeUsername(String(meta.username || ''));
      metaFamilyEmail = normalizeFamilyEmail(String(meta.family_email || meta.familyEmail || authEmail || ''));
      metaCity = String(meta.city || meta.town || meta.location || '').trim();
    }
  } catch (err: any) {
    console.warn('[ensureUserRecords] auth lookup threw:', err?.message || err);
  }

  const fallbackName = authName || (authEmail.includes('@') ? authEmail.split('@')[0] : `Learner-${uid.slice(0, 8)}`);
  const fallbackEmail = authEmail || `user-${uid.slice(0, 8)}@local`;
  const fallbackFamilyEmail = metaFamilyEmail || normalizeFamilyEmail(fallbackEmail);
  const fallbackAge = metaAge ?? 10;
  const today = new Date().toISOString().slice(0, 10);

  let existingUser: Record<string, unknown> | null = null;
  {
    const full = await supabaseAdmin
      .from('users')
      .select('uid, name, email, age, username, family_email')
      .eq('uid', uid)
      .maybeSingle();

    if (full.error?.code === '42703') {
      const basic = await supabaseAdmin.from('users').select('uid, name, email, age').eq('uid', uid).maybeSingle();
      if (basic.error) {
        return { ok: false, userId: uid, createdUser: false, createdPoints: false, error: basic.error.message };
      }
      existingUser = (basic.data as Record<string, unknown> | null) || null;
    } else if (full.error) {
      return { ok: false, userId: uid, createdUser: false, createdPoints: false, error: full.error.message };
    } else {
      existingUser = (full.data as Record<string, unknown> | null) || null;
    }
  }

  let createdUser = false;
  if (!existingUser?.uid) {
    const insertPayload: Record<string, unknown> = {
      uid,
      role: 'kid',
      name: fallbackName,
      age: fallbackAge,
      email: fallbackEmail,
      family_email: fallbackFamilyEmail,
      madrasahname: '',
      points: 0,
      weeklypoints: 0,
      monthlypoints: 0,
      level: 'Beginner',
    };
    if (metaUsername) insertPayload.username = metaUsername;
    if (metaCity) insertPayload.city = metaCity;

    let insertUserErr = (await supabaseAdmin.from('users').upsert(insertPayload, { onConflict: 'uid' })).error;

    if (insertUserErr?.code === '42703') {
      const { username: _u, family_email: _f, city: _c, ...legacyPayload } = insertPayload;
      insertUserErr = (await supabaseAdmin.from('users').upsert(legacyPayload, { onConflict: 'uid' })).error;
      if (!insertUserErr && metaCity) {
        for (const col of ['city', 'town', 'location'] as const) {
          const cityErr = (await supabaseAdmin.from('users').update({ [col]: metaCity }).eq('uid', uid)).error;
          if (!cityErr || cityErr.code !== '42703') break;
        }
      }
    } else if (!insertUserErr && metaCity) {
      // city may be missing from schema on some envs — ignore 42703
      const cityErr = (await supabaseAdmin.from('users').update({ city: metaCity }).eq('uid', uid)).error;
      if (cityErr?.code === '42703') {
        for (const col of ['town', 'location'] as const) {
          const alt = (await supabaseAdmin.from('users').update({ [col]: metaCity }).eq('uid', uid)).error;
          if (!alt || alt.code !== '42703') break;
        }
      }
    }

    if (insertUserErr) {
      console.error('[ensureUserRecords] users insert failed:', insertUserErr.message);
      return { ok: false, userId: uid, createdUser: false, createdPoints: false, error: insertUserErr.message };
    }
    createdUser = true;
  } else {
    const patch: Record<string, unknown> = {};
    if (isPlaceholderName(String(existingUser.name || '')) && !isPlaceholderName(fallbackName)) {
      patch.name = fallbackName;
    }
    if (!existingUser.email && fallbackEmail) {
      patch.email = fallbackEmail;
    }
    if (!existingUser.family_email && fallbackFamilyEmail) {
      patch.family_email = fallbackFamilyEmail;
    }
    if (!existingUser.username && metaUsername) {
      patch.username = metaUsername;
    }
    // Never clobber an existing age; only fill when missing and metadata has age.
    const existingAge = existingUser.age as number | null | undefined;
    if ((existingAge == null || existingAge === 0) && metaAge != null) {
      patch.age = metaAge;
    }
    if (Object.keys(patch).length > 0) {
      const { error: patchErr } = await supabaseAdmin.from('users').update(patch).eq('uid', uid);
      if (patchErr?.code === '42703') {
        const { username: _u, family_email: _f, ...legacyPatch } = patch;
        if (Object.keys(legacyPatch).length > 0) {
          await supabaseAdmin.from('users').update(legacyPatch).eq('uid', uid);
        }
      }
    }
  }

  const { data: existingPoints, error: readPointsErr } = await supabaseAdmin
    .from('users_points')
    .select('user_id')
    .eq('user_id', uid)
    .maybeSingle();

  if (readPointsErr) {
    return { ok: false, userId: uid, createdUser, createdPoints: false, error: readPointsErr.message };
  }

  let createdPoints = false;
  if (!existingPoints?.user_id) {
    const { error: insertPointsErr } = await supabaseAdmin.from('users_points').upsert(
      {
        user_id: uid,
        total_points: 0,
        weekly_points: 0,
        monthly_points: 0,
        today_points: 0,
        badges: 0,
        level: 1,
        last_earned_date: today,
      },
      { onConflict: 'user_id' }
    );

    if (insertPointsErr) {
      console.error('[ensureUserRecords] users_points insert failed:', insertPointsErr.message);
      return { ok: false, userId: uid, createdUser, createdPoints: false, error: insertPointsErr.message };
    }
    createdPoints = true;
  }

  return { ok: true, userId: uid, createdUser, createdPoints };
}
