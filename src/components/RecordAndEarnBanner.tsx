'use client';

import Link from 'next/link';
import { Mic, Star } from 'lucide-react';

/**
 * Homepage promo for recording Quran, nasheeds, stories & hadith to earn points.
 */
export function RecordAndEarnBanner() {
  return (
    <section
      className="feature-tile stagger-in overflow-hidden rounded-3xl border-teal-200 bg-gradient-to-br from-teal-50 via-white to-emerald-50 p-5 sm:p-6"
      aria-labelledby="record-earn-title"
    >
      <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex items-start gap-4">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-teal-800 text-white shadow-md">
            <Mic size={28} />
          </div>
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-100 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-teal-900">
              <Star size={12} /> Record &amp; Earn Points
            </div>
            <h2 id="record-earn-title" className="mt-2 font-heading text-2xl font-extrabold text-teal-950 md:text-3xl">
              Record Quran, Nasheeds, Stories &amp; Hadith
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-sand-700 md:text-base">
              Click here and earn points — we check your recordings, then approve or reject them on{' '}
              <span className="font-semibold text-teal-800">My Recordings</span>.
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row md:flex-col md:items-stretch">
          <Link
            href="/studio"
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-teal-600 to-teal-800 px-5 py-3.5 text-sm font-bold text-white shadow-lg transition hover:-translate-y-0.5 hover:shadow-xl"
          >
            <Mic size={18} />
            Click here &amp; earn points
          </Link>
          <Link
            href="/my-recordings"
            className="inline-flex items-center justify-center gap-2 rounded-2xl border-2 border-teal-200 bg-white px-5 py-3 text-sm font-bold text-teal-900 transition hover:bg-teal-50"
          >
            My Recordings
          </Link>
        </div>
      </div>
    </section>
  );
}
