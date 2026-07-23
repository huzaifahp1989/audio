import { NextResponse, NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

async function updateRecordingReview(
  id: string,
  fields: Record<string, unknown>,
  feedback: string | undefined
) {
  const withNotes = feedback !== undefined ? { ...fields, admin_notes: feedback } : fields;
  let { error } = await supabaseAdmin.from('recordings').update(withNotes).eq('id', id);

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
    const { feedback } = body;

    const error = await updateRecordingReview(
      id,
      {
        status: 'rejected',
        is_published: false,
        reviewed_at: new Date().toISOString(),
      },
      typeof feedback === 'string' ? feedback : undefined
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
