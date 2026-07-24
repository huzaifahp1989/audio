'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight, Trophy } from 'lucide-react';
import {
  formatWeekLabel,
  groupWinnersByMonth,
  groupWinnersByWeek,
  type WeeklyWinnerAnnouncement,
} from '@/lib/weekly-winner-display';

export default function WinnersPage() {
  const [winners, setWinners] = useState<WeeklyWinnerAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<'all' | number>('all');

  useEffect(() => {
    let active = true;

    fetch('/api/weekly-winners?limit=250', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!active) return;
        setWinners(Array.isArray(data?.winners) ? data.winners : []);
      })
      .catch(() => {
        if (active) setWinners([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const monthGroups = useMemo(() => groupWinnersByMonth(winners), [winners]);
  const years = useMemo(
    () => [...new Set(monthGroups.map((group) => group.year).filter((year) => Number.isFinite(year)))],
    [monthGroups]
  );

  const visibleMonths = useMemo(() => {
    if (selectedYear === 'all') return monthGroups;
    return monthGroups.filter((group) => group.year === selectedYear);
  }, [monthGroups, selectedYear]);

  const totalMonths = monthGroups.length;
  const totalEntries = winners.length;
  const latestMonth = monthGroups[0]?.label ?? null;

  return (
    <div className="page-inner">
      <main className="mx-auto max-w-5xl">
        <section className="mb-6 rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-6 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-violet-800">
                <Trophy size={14} /> Kids Zone Winners
              </div>
              <h1 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">Previous winners by month and year</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600 md:text-base">
                Browse the Kids Zone winners archive grouped by month and year, with each winning week shown inside
                every month.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Link
                href="/leaderboard"
                className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-800 transition hover:bg-slate-50"
              >
                Current leaderboard
              </Link>
              <Link
                href="/rewards"
                className="inline-flex items-center justify-center rounded-2xl bg-violet-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-500"
              >
                Rewards page
              </Link>
            </div>
          </div>
        </section>

        <section className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Months listed</p>
            <p className="mt-2 text-3xl font-black text-violet-700">{loading ? '...' : totalMonths}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Winner entries</p>
            <p className="mt-2 text-3xl font-black text-sky-700">{loading ? '...' : totalEntries}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Latest month</p>
            <p className="mt-2 text-lg font-black text-slate-900">{loading ? 'Loading...' : latestMonth || 'No winners yet'}</p>
          </div>
        </section>

        <section className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedYear('all')}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                selectedYear === 'all' ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-violet-50'
              }`}
            >
              All years
            </button>
            {years.map((year) => (
              <button
                key={year}
                type="button"
                onClick={() => setSelectedYear(year)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  selectedYear === year ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-violet-50'
                }`}
              >
                {year}
              </button>
            ))}
          </div>
        </section>

        {loading ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500 shadow-sm">
            Loading winners archive...
          </section>
        ) : visibleMonths.length === 0 ? (
          <section className="rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-sm">
            <p className="text-lg font-bold text-slate-900">No winners found for this year yet.</p>
            <p className="mt-2 text-sm text-slate-600">Try another year filter or come back after the next winner announcement.</p>
          </section>
        ) : (
          <div className="space-y-6 pb-10">
            {visibleMonths.map((monthGroup) => {
              const weeks = groupWinnersByWeek(monthGroup.winners);

              return (
                <section
                  key={monthGroup.monthKey}
                  className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-violet-700">
                        <CalendarDays size={14} /> {monthGroup.year}
                      </div>
                      <h2 className="mt-3 text-2xl font-black text-slate-900">{monthGroup.label}</h2>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">
                      {monthGroup.winners.length} winner{monthGroup.winners.length === 1 ? '' : 's'} across {weeks.length} week
                      {weeks.length === 1 ? '' : 's'}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4">
                    {weeks.map((weekGroup) => (
                      <article
                        key={weekGroup.weekStartDate}
                        className="rounded-2xl border border-sky-100 bg-gradient-to-br from-sky-50 to-white p-4"
                      >
                        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="text-xs font-black uppercase tracking-[0.18em] text-sky-700">Winning week</p>
                            <h3 className="mt-1 text-lg font-black text-slate-900">{formatWeekLabel(weekGroup.weekStartDate)}</h3>
                          </div>
                          <span className="inline-flex items-center gap-1 text-sm font-bold text-violet-700">
                            {weekGroup.winners.length} winner{weekGroup.winners.length === 1 ? '' : 's'}
                            <ChevronRight size={16} />
                          </span>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                          {weekGroup.winners.map((winner) => (
                            <div
                              key={winner.id}
                              className="rounded-2xl border border-white bg-white px-4 py-4 shadow-sm"
                            >
                              <p className="text-lg font-black text-slate-900">{winner.winner_name}</p>
                              <p className="mt-1 text-sm text-slate-600">
                                {winner.madrasah_name?.trim() || 'Madrasah not listed'}
                              </p>
                            </div>
                          ))}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
