'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Palette, Sparkles } from 'lucide-react';
import { Button } from '@/components';
import { FadeUp, Stagger, StaggerItem } from '@/components/Motion';
import { CREATE_HUB_ACTIVITIES } from '@/data/kids-create-activities';

export default function CreateHubPage() {
  const router = useRouter();

  return (
    <div className="page-inner">
      <div className="mx-auto max-w-4xl space-y-6">
        <FadeUp>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="outline" onClick={() => router.push('/')}>
              ← Home
            </Button>
          </div>
        </FadeUp>

        <FadeUp delay={0.06}>
          <header className="page-header">
            <p className="inline-flex items-center gap-2 rounded-xl border border-gold-200 bg-gold-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.14em] text-gold-800">
              <Palette size={14} /> Create & Play
            </p>
            <h1 className="mt-3 font-heading text-3xl font-extrabold text-sand-900 md:text-4xl">
              Fun Islamic activities
            </h1>
            <p className="mt-2 max-w-2xl text-sand-600">
              Colour, draw, trace Arabic, go on a story adventure, say today&apos;s dua, practice good manners,
              complete a kindness hunt, or print Offline Activities for home. Finish an activity to claim points
              (once per type each day), save art to My Gallery, and unlock stickers.
            </p>
          </header>
        </FadeUp>

        <Stagger className="grid gap-3 sm:grid-cols-2" stagger={0.05} delayChildren={0.12}>
          {CREATE_HUB_ACTIVITIES.map((item) => (
            <StaggerItem key={item.href}>
              <Link
                href={item.href}
                className="feature-tile relative flex h-full flex-col rounded-2xl p-4"
              >
                {item.badge && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-xl bg-amber-400 px-2 py-0.5 text-[10px] font-black text-amber-950">
                    <Sparkles size={10} /> {item.badge}
                  </span>
                )}
                <span className="text-3xl" aria-hidden>
                  {item.emoji}
                </span>
                <span className="mt-2 text-lg font-extrabold text-sand-900">{item.title}</span>
                <span className="mt-1 text-sm text-sand-600">{item.blurb}</span>
                <span className="mt-3 text-xs font-bold text-teal-700">{item.pointsNote}</span>
              </Link>
            </StaggerItem>
          ))}
        </Stagger>
      </div>
    </div>
  );
}
