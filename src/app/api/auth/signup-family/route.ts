import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ensureUserRecords } from '@/lib/ensure-user-records';
import {
  MAX_FAMILY_MEMBERS,
  countFamilyMembers,
  createSiblingAuthEmail,
  isValidUsername,
  normalizeFamilyEmail,
  normalizeUsername,
} from '@/lib/family-accounts';

export const dynamic = 'force-dynamic';

interface SignupLearner {
  name: string;
  username: string;
  age: number;
  city: string;
  madrasahName: string | null;
}

export async function POST(request: NextRequest) {
  const createdUids: string[] = [];

  try {
    const body = await request.json();
    const { familyEmail: rawEmail, password, learners } = body as {
      familyEmail: string;
      password: string;
      learners: SignupLearner[];
    };

    if (!rawEmail || !password || !Array.isArray(learners) || learners.length === 0) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const familyEmail = normalizeFamilyEmail(rawEmail);
    if (!familyEmail.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid family email.' }, { status: 400 });
    }

    if (learners.length > MAX_FAMILY_MEMBERS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_FAMILY_MEMBERS} learners per family` },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const validatedLearners: SignupLearner[] = [];
    const seenUsernames = new Set<string>();

    for (let i = 0; i < learners.length; i++) {
      const learner = learners[i];
      const name = String(learner.name || '').trim();
      const username = normalizeUsername(String(learner.username || ''));
      const age =
        typeof learner.age === 'number' ? learner.age : parseInt(String(learner.age || ''), 10);
      const city = String(learner.city || '').trim();
      const madrasahName = learner.madrasahName ? String(learner.madrasahName).trim() : null;

      if (!name || name.length < 2) {
        return NextResponse.json(
          { error: `Learner ${i + 1}: Please enter a full name (minimum 2 characters).` },
          { status: 400 }
        );
      }
      if (!isValidUsername(username)) {
        return NextResponse.json(
          {
            error: `Learner ${i + 1}: Username must be 3-20 characters and use only letters, numbers, or underscores.`,
          },
          { status: 400 }
        );
      }
      if (seenUsernames.has(username)) {
        return NextResponse.json(
          { error: `Learner ${i + 1}: Username "${username}" is duplicated in this form.` },
          { status: 400 }
        );
      }
      seenUsernames.add(username);

      if (!Number.isFinite(age) || age < 1 || age > 120) {
        return NextResponse.json(
          { error: `Learner ${i + 1}: Please enter a valid age (1-120).` },
          { status: 400 }
        );
      }
      if (!city) {
        return NextResponse.json(
          { error: `Learner ${i + 1}: Please enter a city or town.` },
          { status: 400 }
        );
      }

      validatedLearners.push({ name, username, age, city, madrasahName });
    }

    const existingCount = await countFamilyMembers(familyEmail);
    if (existingCount + validatedLearners.length > MAX_FAMILY_MEMBERS) {
      return NextResponse.json(
        {
          error: `This family already has ${existingCount} learner(s). Adding ${validatedLearners.length} more would exceed the maximum of ${MAX_FAMILY_MEMBERS}.`,
        },
        { status: 400 }
      );
    }

    for (const learner of validatedLearners) {
      const { data: existingUsername, error: usernameErr } = await supabaseAdmin
        .from('users')
        .select('uid')
        .eq('username', learner.username)
        .maybeSingle();

      if (usernameErr?.code === '42703') {
        return NextResponse.json(
          { error: 'Family usernames are not set up yet. Run SETUP_FAMILY_USERNAMES.sql in Supabase.' },
          { status: 503 }
        );
      }
      if (existingUsername?.uid) {
        return NextResponse.json(
          { error: `Username "${learner.username}" is already taken.` },
          { status: 409 }
        );
      }
    }

    const createdUsers: Array<{
      uid: string;
      name: string;
      username: string;
      email: string;
    }> = [];

    for (const learner of validatedLearners) {
      const siblingEmail = createSiblingAuthEmail(familyEmail, learner.username);

      const { data: authData, error: authErr } = await supabaseAdmin.auth.admin.createUser({
        email: siblingEmail,
        password,
        email_confirm: true,
        user_metadata: {
          name: learner.name,
          username: learner.username,
          family_email: familyEmail,
          age: learner.age,
          city: learner.city,
          madrasahName: learner.madrasahName,
          needsSignupForm: false,
          signupFormCompletedAt: new Date().toISOString(),
        },
      });

      if (authErr || !authData.user?.id) {
        for (const uid of createdUids) {
          await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {});
        }
        const msg = authErr?.message || 'Could not create account.';
        return NextResponse.json(
          { error: `Failed to create account for ${learner.name}: ${msg}` },
          { status: 400 }
        );
      }

      const uid = authData.user.id;
      createdUids.push(uid);

      const baseProfile: Record<string, unknown> = {
        uid,
        role: 'kid',
        name: learner.name,
        username: learner.username,
        family_email: familyEmail,
        age: learner.age,
        city: learner.city,
        madrasahname: learner.madrasahName || null,
        email: siblingEmail,
        points: 0,
        weeklypoints: 0,
        monthlypoints: 0,
        level: 'Beginner',
      };

      let profileRes = await supabaseAdmin
        .from('users')
        .upsert(baseProfile, { onConflict: 'uid' });

      if (profileRes.error?.code === '42703') {
        const { username: _u, family_email: _f, city: _c, ...legacy } = baseProfile;
        profileRes = await supabaseAdmin.from('users').upsert(legacy, { onConflict: 'uid' });
      }

      if (profileRes.error) {
        for (const rollbackUid of createdUids) {
          await supabaseAdmin.auth.admin.deleteUser(rollbackUid).catch(() => {});
        }
        return NextResponse.json(
          { error: `Failed to create profile for ${learner.name}: ${profileRes.error.message}` },
          { status: 500 }
        );
      }

      const ensureResult = await ensureUserRecords(uid);
      if (!ensureResult.ok) {
        console.error(`[signup-family] ensureUserRecords failed for ${uid}:`, ensureResult.error);
      }

      createdUsers.push({
        uid,
        name: learner.name,
        username: learner.username,
        email: siblingEmail,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Successfully created ${createdUsers.length} learner account(s). Each child can sign in with their username or the family email using the same password.`,
      users: createdUsers,
    });
  } catch (error: unknown) {
    for (const uid of createdUids) {
      await supabaseAdmin.auth.admin.deleteUser(uid).catch(() => {});
    }
    console.error('Family signup error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create family accounts';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
