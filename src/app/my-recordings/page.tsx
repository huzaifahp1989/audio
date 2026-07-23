'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { Recording } from '@/types/stories';
import { useAuth } from '@/lib/auth-context';
import { Mic, Clock, Calendar, CheckCircle2, XCircle, Hourglass, Star, MessageSquare } from 'lucide-react';

function categoryLabel(rec: Recording): string {
  const raw = (rec.category || '').toLowerCase();
  if (raw === 'quran') return 'Quran';
  if (raw === 'nasheed') return 'Nasheed';
  if (raw === 'story' || rec.story_id) return 'Story';
  if (raw === 'hadith') return 'Hadith';
  if (rec.title?.toLowerCase().includes('surah')) return 'Quran';
  return 'Recording';
}

function statusMeta(status: Recording['status']) {
  switch (status) {
    case 'approved':
      return {
        label: 'Approved',
        className: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        Icon: CheckCircle2,
        helper: 'Admin approved this recording',
      };
    case 'rejected':
      return {
        label: 'Rejected',
        className: 'bg-rose-100 text-rose-800 border-rose-200',
        Icon: XCircle,
        helper: 'Admin asked you to try again',
      };
    default:
      return {
        label: 'Waiting for review',
        className: 'bg-amber-100 text-amber-900 border-amber-200',
        Icon: Hourglass,
        helper: 'An admin will check this soon',
      };
  }
}

export default function MyRecordingsPage() {
  const { user } = useAuth();
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRecordings = useCallback(async () => {
    try {
      const runQuery = async (orderColumn: 'submitted_at' | 'created_at') => {
        return await supabase
          .from('recordings')
          .select(
            `
            *,
            story:stories(title)
          `
          )
          .eq('user_id', user!.id)
          .order(orderColumn, { ascending: false });
      };

      let { data, error } = await runQuery('submitted_at');
      if (error && error.message?.includes('submitted_at')) {
        ({ data, error } = await runQuery('created_at'));
      }

      if (error) throw error;
      setRecordings(data || []);
    } catch (error) {
      console.error('Error fetching recordings:', error);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      fetchRecordings();
    } else {
      setLoading(false);
    }
  }, [fetchRecordings, user]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-islamic-light flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-2xl shadow-lg">
          <p className="text-xl text-gray-600 mb-4">Please sign in to view your recordings.</p>
          <Link href="/signin" className="inline-block bg-islamic-primary text-white px-6 py-2 rounded-lg font-bold">
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  const approvedCount = recordings.filter((r) => r.status === 'approved').length;
  const rejectedCount = recordings.filter((r) => r.status === 'rejected').length;
  const pendingCount = recordings.filter((r) => r.status !== 'approved' && r.status !== 'rejected').length;

  return (
    <div className="min-h-screen bg-islamic-light py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex flex-col gap-4 sm:flex-row sm:justify-between sm:items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">My Recordings</h1>
            <p className="mt-1 text-sm text-gray-600">
              See when an admin approves or rejects your Quran, nasheed, story, and hadith recordings.
            </p>
          </div>
          <Link
            href="/studio"
            className="bg-islamic-primary text-white px-6 py-2 rounded-full font-bold hover:bg-opacity-90 transition flex items-center justify-center"
          >
            <Mic size={18} className="mr-2" /> Record New
          </Link>
        </div>

        {!loading && recordings.length > 0 && (
          <div className="mb-6 grid grid-cols-3 gap-3">
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-3 text-center">
              <p className="text-xl font-black text-amber-900">{pendingCount}</p>
              <p className="text-xs font-semibold text-amber-800">Waiting</p>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-3 text-center">
              <p className="text-xl font-black text-emerald-900">{approvedCount}</p>
              <p className="text-xs font-semibold text-emerald-800">Approved</p>
            </div>
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-3 py-3 text-center">
              <p className="text-xl font-black text-rose-900">{rejectedCount}</p>
              <p className="text-xs font-semibold text-rose-800">Rejected</p>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-islamic-primary mx-auto"></div>
          </div>
        ) : recordings.length === 0 ? (
          <div className="bg-white rounded-3xl shadow-sm p-12 text-center border border-gray-100">
            <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mic size={32} className="text-gray-400" />
            </div>
            <h3 className="text-xl font-bold text-gray-700 mb-2">No recordings yet</h3>
            <p className="text-gray-500 mb-6">
              Record Quran, nasheeds, stories, or hadith — an admin will review them and award points.
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              <Link
                href="/studio"
                className="inline-block bg-islamic-primary text-white px-8 py-3 rounded-xl font-bold hover:shadow-lg transition"
              >
                Open Recording Studio
              </Link>
              <Link
                href="/stories"
                className="inline-block border-2 border-teal-200 bg-white text-teal-800 px-8 py-3 rounded-xl font-bold hover:bg-teal-50 transition"
              >
                Story Zone
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {recordings.map((rec) => {
              const submittedAt = rec.submitted_at || rec.created_at || new Date().toISOString();
              const durationSeconds = rec.duration ?? rec.duration_seconds ?? 0;
              const feedback = (rec.admin_notes || rec.admin_feedback || '').trim();
              const meta = statusMeta(rec.status);
              const StatusIcon = meta.Icon;

              return (
                <div
                  key={rec.id}
                  className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <div className="mb-2 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-teal-800">
                          {categoryLabel(rec)}
                        </span>
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm font-bold ${meta.className}`}
                        >
                          <StatusIcon size={14} />
                          {meta.label}
                        </span>
                      </div>
                      <h3 className="text-xl font-bold text-gray-800 mb-1">
                        {rec.story?.title || rec.title || 'Studio Recording'}
                      </h3>
                      <p className="text-sm text-gray-500 mb-2">{meta.helper}</p>
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                        <span className="flex items-center">
                          <Calendar size={14} className="mr-1" /> {formatDate(submittedAt)}
                        </span>
                        <span className="flex items-center">
                          <Clock size={14} className="mr-1" />{' '}
                          {Math.floor(durationSeconds / 60)}:
                          {(durationSeconds % 60).toString().padStart(2, '0')}
                        </span>
                        {rec.reviewed_at && (
                          <span className="flex items-center text-teal-700">
                            Reviewed {formatDate(rec.reviewed_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {rec.status === 'approved' && (
                      <div className="inline-flex items-center gap-2 self-start rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 font-bold text-amber-800">
                        <Star size={16} className="text-amber-500" />
                        {rec.points_awarded || 0} pts earned
                      </div>
                    )}
                  </div>

                  {feedback && (rec.status === 'approved' || rec.status === 'rejected') && (
                    <div
                      className={`rounded-xl border px-4 py-3 ${
                        rec.status === 'approved'
                          ? 'border-emerald-200 bg-emerald-50'
                          : 'border-rose-200 bg-rose-50'
                      }`}
                    >
                      <p
                        className={`mb-1 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide ${
                          rec.status === 'approved' ? 'text-emerald-800' : 'text-rose-800'
                        }`}
                      >
                        <MessageSquare size={12} />
                        Admin feedback
                      </p>
                      <p
                        className={`text-sm leading-relaxed ${
                          rec.status === 'approved' ? 'text-emerald-900' : 'text-rose-900'
                        }`}
                      >
                        {feedback}
                      </p>
                    </div>
                  )}

                  {rec.status === 'rejected' && (
                    <Link
                      href="/studio"
                      className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 underline-offset-2 hover:underline"
                    >
                      <Mic size={14} /> Record again and earn points
                    </Link>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
