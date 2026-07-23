import { NextResponse, NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { ensureUserRecords } from '@/lib/ensure-user-records';
import { awardPointsWithDailyCapByUserId } from '@/lib/server-points';

async function updateRecordingReview(
  id: string,
  fields: Record<string, unknown>,
  feedback: string | undefined
) {
  const withNotes = feedback !== undefined ? { ...fields, admin_notes: feedback } : fields;
  let { error } = await supabaseAdmin.from('recordings').update(withNotes).eq('id', id);

  // Older schemas use admin_feedback instead of admin_notes
  if (error && feedback !== undefined && error.message?.includes('admin_notes')) {
    const withFeedback = { ...fields, admin_feedback: feedback };
    ({ error } = await supabaseAdmin.from('recordings').update(withFeedback).eq('id', id));
  }

  return error;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
    const body = await request.json();
    const { points, publish, feedback } = body;

    const updateError = await updateRecordingReview(
      id,
      {
        status: 'approved',
        points_awarded: points,
        is_published: publish,
        reviewed_at: new Date().toISOString(),
      },
      typeof feedback === 'string' ? feedback : undefined
    );

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    const { data: recording } = await supabaseAdmin
      .from('recordings')
      .select('user_id')
      .eq('id', id)
      .single();

    if (recording?.user_id && Number(points) > 0) {
      const userId = String(recording.user_id);
      await ensureUserRecords(userId);
      const award = await awardPointsWithDailyCapByUserId(userId, Number(points), {
        successMessage: `+${Number(points)} points for your story recording!`,
      });

      if (!award.success && award.reason === 'update_failed') {
        return NextResponse.json({ error: award.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
