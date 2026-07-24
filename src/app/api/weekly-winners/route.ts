import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedLimit = Number(searchParams.get('limit') || 50);
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(Math.trunc(requestedLimit), 1), 250) : 50;

    const { data, error } = await supabaseAdmin
      .from('weekly_winner_announcements')
      .select('id, winner_name, madrasah_name, week_start_date, created_at')
      .order('week_start_date', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      if (error.code === '42P01') {
        return NextResponse.json({ winners: [] });
      }
      throw error;
    }

    return NextResponse.json({ winners: data || [] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unexpected error';
    return NextResponse.json({ winners: [], error: message }, { status: 500 });
  }
}
