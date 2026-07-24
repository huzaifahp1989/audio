'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { CalendarDays, ChevronRight, Filter, Trophy } from 'lucide-react';
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
  const [selectedMonthKey, setSelectedMonthKey] = useState<'all' | string>('all');

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

  const monthsForSelectedYear = useMemo(() => {
    if (selectedYear === 'all') return monthGroups;
    return monthGroups.filter((group) => group.year === selectedYear);
  }, [monthGroups, selectedYear]);

  const visibleMonths = useMemo(() => {
    const yearFiltered = selectedYear === 'all' ? monthGroups : monthGroups.filter((group) => group.year === selectedYear);
    if (selectedMonthKey === 'all') return yearFiltered;
    return yearFiltered.filter((group) => group.monthKey === selectedMonthKey);
  }, [monthGroups, selectedMonthKey, selectedYear]);

  const totalMonths = monthGroups.length;
  const totalEntries = winners.length;
  const latestMonth = monthGroups[0]?.label ?? null;
  const visibleWinnerCount = visibleMonths.reduce((sum, group) => sum + group.winners.length, 0);

  useEffect(() => {
    if (selectedMonthKey === 'all') return;
    const exists = monthsForSelectedYear.some((group) => group.monthKey === selectedMonthKey);
    if (!exists) setSelectedMonthKey('all');
  }, [monthsForSelectedYear, selectedMonthKey]);

  return (
    <div className="page-inner">
      <main className="mx-auto max-w-5xl">
        <section className="mb-6 rounded-3xl border border-violet-200 bg-gradient-to-br from-violet-50 via-white to-cyan-50 p-6 shadow-sm">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-violet-100 px-3 py-1 text-xs font-black uppercase tracking-[0.18em] text-violet-800">
                <Trophy size={14} /> Kids Zone Winners
              </div>
              <h1 className="mt-3 text-3xl font-black text-slate-900 md:text-4xl">Previous Kids Zone winners</h1>
              <p className="mt-2 text-sm leading-6 text-slate-600 md:text-base">
                Browse the archive by month and year. Each monthly section shows the winning weeks and the children
                announced in that month.
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
          <div className="flex items-center gap-2 text-sm font-bold text-slate-700">
            <Filter size={16} className="text-violet-600" />
            Filter archive
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {([
              { key: 'all', label: 'All years' },
              ...years.map((year) => ({ key: String(year), label: String(year) })),
            ]).map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setSelectedYear(item.key === 'all' ? 'all' : Number(item.key))}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  (item.key === 'all' ? selectedYear === 'all' : selectedYear === Number(item.key))
                    ? 'bg-violet-600 text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-violet-50'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSelectedMonthKey('all')}
              className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                selectedMonthKey === 'all' ? 'bg-sky-600 text-white' : 'bg-sky-50 text-sky-800 hover:bg-sky-100'
              }`}
            >
              All months
            </button>
            {monthsForSelectedYear.map((group) => (
              <button
                key={group.monthKey}
                type="button"
                onClick={() => setSelectedMonthKey(group.monthKey)}
                className={`rounded-full px-4 py-2 text-sm font-bold transition ${
                  selectedMonthKey === group.monthKey
                    ? 'bg-sky-600 text-white'
                    : 'bg-sky-50 text-sky-800 hover:bg-sky-100'
                }`}
              >
                {group.label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-sm text-slate-600">
            Showing <span className="font-bold text-slate-900">{visibleMonths.length}</span> month
            {visibleMonths.length === 1 ? '' : 's'} and <span className="font-bold text-slate-900">{visibleWinnerCount}</span>{' '}
            winner entry{visibleWinnerCount === 1 ? '' : 'ies'}.
          </p>
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
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2">
                <CalendarDays className="text-violet-600" size={18} />
                <h2 className="text-xl font-black text-slate-900">Monthly archive</h2>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {visibleMonths.map((group) => {
                  const weekCount = groupWinnersByWeek(group.winners).length;
                  return (
                    <button
                      key={`summary-${group.monthKey}`}
                      type="button"
                      onClick={() => setSelectedMonthKey(group.monthKey)}
                      className={`rounded-2xl border p-4 text-left transition ${
                        selectedMonthKey === group.monthKey
                          ? 'border-violet-300 bg-violet-50 shadow-sm'
                          : 'border-slate-200 bg-slate-50 hover:border-violet-200 hover:bg-violet-50/60'
                      }`}
                    >
                      <p className="text-xs font-black uppercase tracking-[0.18em] text-violet-700">{group.year}</p>
                      <h3 className="mt-2 text-lg font-black text-slate-900">{group.label}</h3>
                      <p className="mt-2 text-sm text-slate-600">
                        {group.winners.length} winner{group.winners.length === 1 ? '' : 's'} across {weekCount} week
                        {weekCount === 1 ? '' : 's'}
                      </p>
                    </button>
                  );
                })}
              </div>
            </section>

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
                      <p className="mt-1 text-sm text-slate-600">
                        Monthly winner archive for {monthGroup.label}.
                      </p>
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
