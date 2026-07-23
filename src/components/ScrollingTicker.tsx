"use client";

import React from 'react';

const messages = [
  "🎙️ Record Quran, nasheeds, stories & hadith — click here and earn points!",
  "🌟 Play today's quiz and earn points!",
  "🕌 Learn a new Surah every day!",
  "🏆 Check the leaderboard — can you reach the top?",
  "📖 Read a story and discover Islamic history!",
  "🎮 New games waiting for you — jump in!",
  "⭐ Complete your daily missions for bonus points!",
  "🌙 Learn the 99 Names of Allah — how many do you know?",
  "🎯 Challenge yourself with the Quran Quiz!",
  "🤝 Invite a friend and learn together!",
  "💎 Collect badges by completing activities!",
  "🌸 Say Bismillah and start learning today!",
  "🏅 Qualify with 150+ points — winners picked at random!",
  "📿 Recite and record your Quran — earn stars!",
  "🌍 Join kids from around the world learning Islam!",
  "✨ Every good deed counts — keep going!",
];

export function ScrollingTicker() {
  // Duplicate messages so the scroll feels continuous
  const doubled = [...messages, ...messages];

  return (
    <div className="scrolling-ticker-wrap relative overflow-hidden border-b border-violet-900/15 bg-gradient-to-r from-violet-900 via-violet-700 to-violet-900 py-1.5 text-white">
      <div className="scrolling-ticker-track flex whitespace-nowrap" style={{ animation: 'tickerScroll 60s linear infinite' }}>
        {doubled.map((msg, i) => (
          <span key={i} className="mx-8 inline-block shrink-0 text-xs font-semibold tracking-wide sm:text-sm">
            {msg}
          </span>
        ))}
      </div>
      <style>{`
        @keyframes tickerScroll {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .scrolling-ticker-wrap:hover .scrolling-ticker-track {
          animation-play-state: paused;
        }
      `}</style>
    </div>
  );
}
