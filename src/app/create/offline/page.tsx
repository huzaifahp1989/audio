'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { CreateShell } from '@/components/CreateShell';
import { ClaimCreatePointsButton } from '@/components/ClaimCreatePointsButton';
import { FadeUp, Stagger, StaggerItem } from '@/components/Motion';
import {
  OFFLINE_ACTIVITIES,
  OFFLINE_COLOURING_SVGS,
  buildDotToDotSvg,
  buildMazeSvg,
  getOfflineActivity,
  KINDNESS_TASKS,
  MANNERS_TASKS,
  TRACE_WORDS,
  type OfflineActivity,
} from '@/data/offline-activities';
import { getDuaOfTheDay } from '@/data/kids-create-activities';
import { downloadSvgFile, downloadTextFile } from '@/lib/download-blob';

function PrintActions({
  onPrint,
  onDownload,
  downloadLabel = 'Download SVG',
}: {
  onPrint: () => void;
  onDownload?: () => void;
  downloadLabel?: string;
}) {
  return (
    <div className="no-print flex flex-wrap gap-2">
      <button
        type="button"
        onClick={onPrint}
        className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 font-bold text-white"
      >
        <Printer size={16} /> Print
      </button>
      {onDownload && (
        <button
          type="button"
          onClick={onDownload}
          className="inline-flex items-center gap-2 rounded-xl border border-sand-200 bg-white px-4 py-2.5 font-bold text-sand-900"
        >
          <Download size={16} /> {downloadLabel}
        </button>
      )}
    </div>
  );
}

function WorksheetFrame({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer?: string;
}) {
  return (
    <div className="offline-worksheet rounded-3xl border-2 border-sand-300 bg-white p-5 sm:p-8">
      <div className="mb-4 border-b border-dashed border-sand-300 pb-3 text-center">
        <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-teal-700">Kids Zone · Offline</p>
        <h2 className="mt-1 font-heading text-2xl font-extrabold text-sand-900">{title}</h2>
      </div>
      {children}
      <p className="mt-6 text-center text-xs text-sand-500">
        {footer || 'Islam Media Central · Kids Zone · Colour, learn, and have fun offline'}
      </p>
    </div>
  );
}

function ColouringPreview({ activityId, title }: { activityId: string; title: string }) {
  const svg = OFFLINE_COLOURING_SVGS[activityId];
  if (!svg) return null;
  return (
    <WorksheetFrame title={title}>
      <div
        className="mx-auto flex max-w-lg justify-center"
        dangerouslySetInnerHTML={{ __html: svg.replace(/<\?xml[^>]*>/, '') }}
      />
      <p className="mt-3 text-center text-sm text-sand-600">Use crayons or pencils. Colour neatly!</p>
    </WorksheetFrame>
  );
}

function DotPreview() {
  const svg = useMemo(() => buildDotToDotSvg(), []);
  return (
    <WorksheetFrame title="Crescent Dot-to-Dot">
      <div
        className="mx-auto flex max-w-md justify-center"
        dangerouslySetInnerHTML={{ __html: svg.replace(/<\?xml[^>]*>/, '') }}
      />
      <p className="mt-3 text-center text-sm text-sand-600">Start at 1 and connect every number in order.</p>
    </WorksheetFrame>
  );
}

function MazePreview() {
  const svg = useMemo(() => buildMazeSvg(), []);
  return (
    <WorksheetFrame title="Path to the Masjid">
      <div
        className="mx-auto flex max-w-lg justify-center"
        dangerouslySetInnerHTML={{ __html: svg.replace(/<\?xml[^>]*>/, '') }}
      />
      <p className="mt-3 text-center text-sm text-sand-600">Draw a line from START to the masjid without crossing walls.</p>
    </WorksheetFrame>
  );
}

function TracePreview() {
  return (
    <WorksheetFrame title="Arabic Tracing Sheet">
      <div className="space-y-6">
        {TRACE_WORDS.map((w) => (
          <div key={w.id} className="rounded-2xl border border-sand-200 p-4">
            <p className="text-sm font-bold text-teal-800">
              {w.english} — {w.tip}
            </p>
            <p className="mt-2 text-center font-arabic text-4xl text-sand-300 sm:text-5xl" dir="rtl">
              {w.arabic}
            </p>
            <div className="mt-3 space-y-2">
              {[0, 1].map((i) => (
                <div key={i} className="h-10 border-b-2 border-dashed border-sand-300" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </WorksheetFrame>
  );
}

function ChecklistPreview({
  title,
  tasks,
}: {
  title: string;
  tasks: Array<{ id: string; label: string; emoji: string }>;
}) {
  return (
    <WorksheetFrame title={title}>
      <p className="mb-4 text-center text-sm text-sand-600">Tick each box when you finish the deed.</p>
      <ul className="space-y-3">
        {tasks.map((t) => (
          <li key={t.id} className="flex items-center gap-3 rounded-xl border border-sand-200 px-3 py-3">
            <span className="inline-block h-7 w-7 shrink-0 rounded border-2 border-sand-400" aria-hidden />
            <span className="text-xl" aria-hidden>
              {t.emoji}
            </span>
            <span className="font-bold text-sand-900">{t.label}</span>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-sm text-sand-600">Parent sign: ______________________</p>
    </WorksheetFrame>
  );
}

function DuaCardPreview() {
  const dua = useMemo(() => getDuaOfTheDay(), []);
  return (
    <WorksheetFrame title="Dua Practice Card" footer="Keep this card by your bed or dinner table">
      <div className="rounded-2xl border-2 border-teal-200 bg-teal-50/50 p-6 text-center">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-teal-700">{dua.title}</p>
        <p className="mt-3 font-arabic text-3xl leading-relaxed text-teal-950 sm:text-4xl" dir="rtl">
          {dua.arabic}
        </p>
        <p className="mt-3 text-lg font-bold text-sand-800">{dua.transliteration}</p>
        <p className="mt-1 text-sand-600">{dua.meaning}</p>
      </div>
      <p className="mt-4 text-center text-sm text-sand-600">Say it three times today. Cut out and decorate!</p>
    </WorksheetFrame>
  );
}

function ActivityPreview({ activity }: { activity: OfflineActivity }) {
  switch (activity.id) {
    case 'colour-crescent':
    case 'colour-lantern':
    case 'colour-masjid':
      return <ColouringPreview activityId={activity.id} title={activity.title} />;
    case 'dot-crescent':
      return <DotPreview />;
    case 'salah-maze':
      return <MazePreview />;
    case 'trace-arabic':
      return <TracePreview />;
    case 'kindness-checklist':
      return <ChecklistPreview title={activity.title} tasks={KINDNESS_TASKS} />;
    case 'manners-checklist':
      return <ChecklistPreview title={activity.title} tasks={MANNERS_TASKS} />;
    case 'dua-card':
      return <DuaCardPreview />;
    default:
      return null;
  }
}

function downloadForActivity(activity: OfflineActivity) {
  if (activity.kind === 'colouring') {
    const svg = OFFLINE_COLOURING_SVGS[activity.id];
    if (svg) downloadSvgFile(`kids-zone-${activity.id}.svg`, svg);
    return;
  }
  if (activity.id === 'dot-crescent') {
    downloadSvgFile('kids-zone-dot-to-dot.svg', buildDotToDotSvg());
    return;
  }
  if (activity.id === 'salah-maze') {
    downloadSvgFile('kids-zone-masjid-maze.svg', buildMazeSvg());
    return;
  }
  // Text/HTML-ish printable for checklists & cards — print is primary; also offer a simple text sheet
  if (activity.kind === 'checklist' || activity.kind === 'card' || activity.kind === 'trace') {
    const lines = [
      `Kids Zone · ${activity.title}`,
      activity.blurb,
      '',
      ...(activity.id === 'kindness-checklist'
        ? KINDNESS_TASKS.map((t, i) => `[ ] ${i + 1}. ${t.label}`)
        : activity.id === 'manners-checklist'
          ? MANNERS_TASKS.map((t, i) => `[ ] ${i + 1}. ${t.label}`)
          : activity.id === 'trace-arabic'
            ? TRACE_WORDS.map((w) => `${w.english}: ${w.arabic} (${w.tip})`)
            : (() => {
                const d = getDuaOfTheDay();
                return [d.title, d.arabic, d.transliteration, d.meaning];
              })()),
      '',
      'Parent sign: _______________',
    ];
    downloadTextFile(`kids-zone-${activity.id}.txt`, lines.join('\n'), 'text/plain');
  }
}

export default function OfflineActivitiesPage() {
  const printRef = useRef<HTMLDivElement>(null);
  const [selectedId, setSelectedId] = useState(OFFLINE_ACTIVITIES[0].id);
  const activity = getOfflineActivity(selectedId) || OFFLINE_ACTIVITIES[0];
  const canDownloadSvg =
    activity.kind === 'colouring' || activity.id === 'dot-crescent' || activity.id === 'salah-maze';

  const handlePrint = () => {
    window.print();
  };

  return (
    <CreateShell title="Offline Activities">
      <FadeUp>
        <p className="no-print text-sm text-sand-600">
          Print or download worksheets to use without a screen — colouring, checklists, tracing, mazes, and dua
          cards. Ask a parent to help print!
        </p>
      </FadeUp>

      <Stagger className="no-print grid gap-2 sm:grid-cols-2" delayChildren={0.08}>
        {OFFLINE_ACTIVITIES.map((item) => (
          <StaggerItem key={item.id}>
            <button
              type="button"
              onClick={() => setSelectedId(item.id)}
              className={`w-full rounded-2xl border-2 px-4 py-3 text-left transition ${
                selectedId === item.id
                  ? 'border-teal-500 bg-teal-50'
                  : 'border-sand-200 bg-white hover:border-teal-200'
              }`}
            >
              <span className="text-2xl" aria-hidden>
                {item.emoji}
              </span>
              <p className="mt-1 font-extrabold text-sand-900">{item.title}</p>
              <p className="text-xs text-sand-600">{item.blurb}</p>
              <p className="mt-1 text-[11px] font-bold uppercase tracking-wide text-teal-700">
                {item.ages} · {item.minutes}
              </p>
            </button>
          </StaggerItem>
        ))}
      </Stagger>

      <FadeUp delay={0.12}>
        <PrintActions
          onPrint={handlePrint}
          onDownload={() => downloadForActivity(activity)}
          downloadLabel={canDownloadSvg ? 'Download SVG' : 'Download text sheet'}
        />
      </FadeUp>

      <FadeUp delay={0.16}>
        <div ref={printRef} className="print-area">
          <ActivityPreview activity={activity} />
        </div>
      </FadeUp>

      <div className="no-print">
        <ClaimCreatePointsButton
          activity="creative"
          ready
          readyLabel="I finished an offline activity — claim points"
          disabledLabel="Finish offline, then claim"
        />
      </div>
    </CreateShell>
  );
}
