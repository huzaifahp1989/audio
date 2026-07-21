'use client';
import { useRouter } from 'next/navigation';
import React, { useEffect, useRef, useState } from 'react';
import { usePointsProgress } from '@/lib/points-progress-context';
import { useAuth } from '@/lib/auth-context';
import { completeGameSession } from '@/lib/complete-game-session';
import { ACTIVITY_BONUS_POINTS, MAX_DAILY_GAME_COMPLETIONS } from '@/lib/points-policy';
import { getAuthFetchHeaders } from '@/lib/auth-headers';
import {
  hangmanTopics,
  crosswordPuzzles,
  wordScramblePool,
  trueOrFalsePool,
  namesOfAllahPool,
} from '@/data/games';
import type { CrosswordPuzzle } from '@/data/games';
import { Star, Trophy, Target, Sparkles, ArrowLeft, Puzzle } from 'lucide-react';
import Link from 'next/link';
import { useAgeMode } from '@/lib/age-mode';
import { EarnMorePointsLinks } from '@/components/EarnMorePointsLinks';
import { FadeUp, Stagger, StaggerItem } from '@/components/Motion';

type GameId = 'hangman' | 'crossword' | 'scramble' | 'true-or-false' | 'names-of-allah';
type TaskKind = 'mcq' | 'hangman' | 'crossword' | 'scramble';

interface Option { id: string; text: string; }
interface Task {
  id: string; prompt: string; kind: TaskKind;
  options: Option[]; correctOptionId?: string; points: number;
  meta?: Record<string, any>;
}
interface GameSession { id: GameId; title: string; icon: string; tasks: Task[]; }

const gameCatalog: { id: GameId; title: string; description: string; icon: string; color: string }[] = [
  { id: 'hangman',        title: 'Islamic Hangman',   description: 'Guess Islamic words letter by letter',        icon: '🏗️', color: 'from-[#ec4899] to-[#db2777]' },
  { id: 'crossword',      title: 'Islamic Crossword', description: 'Fill in the Islamic crossword puzzle',        icon: '🔤', color: 'from-[#0d9488] to-[#0f766e]' },
  { id: 'scramble',       title: 'Word Scramble',     description: 'Unscramble mixed-up Islamic words',           icon: '🔀', color: 'from-[#14b8a6] to-[#0d9488]' },
  { id: 'true-or-false',  title: 'True or False',     description: 'Test your Islamic knowledge with T/F',       icon: '✅', color: 'from-[#f59e0b] to-[#d97706]' },
  { id: 'names-of-allah', title: '99 Names of Allah', description: "Match Allah's beautiful names to meanings",  icon: '☪️', color: 'from-[#3b82f6] to-[#2563eb]' },
];

const shuffle = <T,>(arr: T[]) => {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
};
const randomInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

const buildCrosswordGrid = (puzzle: CrosswordPuzzle): string[][] => {
  const grid: string[][] = Array.from({ length: puzzle.rows }, () =>
    Array.from({ length: puzzle.cols }, () => '')
  );
  for (const word of puzzle.words) {
    for (let i = 0; i < word.word.length; i++) {
      const r = word.direction === 'across' ? word.row : word.row + i;
      const c = word.direction === 'across' ? word.col + i : word.col;
      grid[r][c] = word.word[i];
    }
  }
  return grid;
};

const getCrosswordCellMeta = (puzzle: CrosswordPuzzle, r: number, c: number) => {
  let inGrid = false;
  let clueNumber: number | undefined;
  for (const word of puzzle.words) {
    for (let i = 0; i < word.word.length; i++) {
      const wr = word.direction === 'across' ? word.row : word.row + i;
      const wc = word.direction === 'across' ? word.col + i : word.col;
      if (wr === r && wc === c) {
        inGrid = true;
        if (i === 0) clueNumber = word.number;
      }
    }
  }
  return { inGrid, clueNumber };
};

export default function GamesPage() {
  const router = useRouter();
  const { user, refreshProfile, profile, updateLocalProfile } = useAuth() as any;
  const { showPointsProgress } = usePointsProgress();
  const { isYounger } = useAgeMode();
  const [selectedGameId, setSelectedGameId] = useState<GameId | null>(null);
  const [session, setSession] = useState<GameSession | null>(null);
  const [taskIndex, setTaskIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hangmanGuesses, setHangmanGuesses] = useState<Set<string>>(new Set());
  const [hangmanWrongCount, setHangmanWrongCount] = useState(0);
  const [crosswordInputs, setCrosswordInputs] = useState<Record<string, string>>({});
  const [crosswordPuzzleState, setCrosswordPuzzleState] = useState<CrosswordPuzzle | null>(null);
  const [crosswordSolved, setCrosswordSolved] = useState(false);
  const [crosswordErrors, setCrosswordErrors] = useState<Record<string, boolean>>({});
  const [crosswordChecked, setCrosswordChecked] = useState(false);
  const [scrambleInput, setScrambleInput] = useState('');
  const [scrambleCorrect, setScrambleCorrect] = useState(false);
  const [scrambleRevealed, setScrambleRevealed] = useState(false);
  const [points, setPoints] = useState(0);
  const pointsRef = useRef(0);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [mcqAnswered, setMcqAnswered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [gamesUsedToday, setGamesUsedToday] = useState(0);
  const gameBonusAwardedRef = useRef(false);

  useEffect(() => {
    if (!user?.id) {
      setGamesUsedToday(0);
      return;
    }
    getAuthFetchHeaders().then((headers) =>
      fetch(`/api/activities/daily-status?userId=${encodeURIComponent(user.id)}`, { headers })
    )
      .then((res) => res.json())
      .then((data) => {
        const gameRow = (data?.activities || []).find((row: { activity: string }) => row.activity === 'game');
        setGamesUsedToday(Number(gameRow?.used ?? 0));
      })
      .catch(() => setGamesUsedToday(0));
  }, [user?.id, profile?.todayPoints]);

  const showToast = (msg: string, ms = 2500) => { setToast(msg); setTimeout(() => setToast(null), ms); };
  const applyPointGain = (earned: number) => { setPoints(p => { const n = p + earned; pointsRef.current = n; return n; }); };

  const resetState = () => {
    setTaskIndex(0); setSelectedOption(null);
    setHangmanGuesses(new Set()); setHangmanWrongCount(0);
    setCrosswordInputs({}); setCrosswordPuzzleState(null);
    setCrosswordSolved(false); setCrosswordErrors({}); setCrosswordChecked(false);
    setScrambleInput(''); setScrambleCorrect(false); setScrambleRevealed(false);
    setPoints(0); pointsRef.current = 0; setFeedback(null);
    setMcqAnswered(false);
    gameBonusAwardedRef.current = false;
  };

  const finishGame = async () => {
    const gameTitle = session?.title || 'Game';
    let earnedBonus = 0;

    if (user?.id && !gameBonusAwardedRef.current) {
      gameBonusAwardedRef.current = true;
      setLoading(true);
      try {
        const result = await completeGameSession({
          userId: user.id,
          gameId: selectedGameId || 'game',
          gameTitle,
          difficulty: 'medium',
          tasksPlayed: session?.tasks.length || 0,
          trackCompetition: true,
        });
        earnedBonus = result.pointsAwarded;
        if (result.profile) {
          updateLocalProfile({
            points: result.profile.points,
            weeklyPoints: result.profile.weeklyPoints,
            monthlyPoints: result.profile.monthlyPoints,
            todayPoints: result.profile.todayPoints,
          });
        }
        if (earnedBonus > 0) {
          showToast(`⭐ +${earnedBonus} points for finishing the game!`);
          setGamesUsedToday((prev) => Math.min(MAX_DAILY_GAME_COMPLETIONS, prev + 1));
        } else if (result.message) {
          showToast(result.message);
        }
        await refreshProfile();
      } catch {
        gameBonusAwardedRef.current = false;
        showToast('Points not saved. Try again.');
      } finally {
        setLoading(false);
      }
    }

    setSelectedGameId(null);
    setSession(null);
    resetState();
    if (user?.id && earnedBonus > 0) {
      showPointsProgress({
        activity: 'game',
        activityLabel: gameTitle,
        pointsEarned: earnedBonus,
      });
    }
  };

  const quitGame = () => { setSelectedGameId(null); setSession(null); resetState(); };

  const buildGameSession = (gameId: GameId): GameSession | null => {
    const gameInfo = gameCatalog.find(g => g.id === gameId)!;
    let tasks: Task[] = [];
    switch (gameId) {
      case 'hangman': {
        const topics = Object.keys(hangmanTopics.topics);
        const topic = topics[randomInt(0, topics.length - 1)];
        const words = hangmanTopics.topics[topic] || [];
        const chosen = words[randomInt(0, Math.max(0, words.length - 1))];
        if (!chosen) return null;
        tasks = [{ id: `hangman-${topic}`, prompt: `${topic}: ${chosen.hint}`, kind: 'hangman', options: [], points: 20, meta: { word: chosen.word } }];
        break;
      }
      case 'crossword': {
        const puzzle = crosswordPuzzles[randomInt(0, crosswordPuzzles.length - 1)];
        tasks = [{ id: `crossword-${puzzle.id}`, prompt: puzzle.title, kind: 'crossword', options: [], points: 20, meta: { puzzleId: puzzle.id } }];
        break;
      }
      case 'scramble': {
        tasks = shuffle(wordScramblePool).slice(0, 8).map(w => ({ id: `scramble-${w.id}`, prompt: w.hint, kind: 'scramble' as TaskKind, options: [], points: 5, meta: { word: w.word, scrambled: w.scrambled } }));
        break;
      }
      case 'true-or-false': {
        tasks = shuffle(trueOrFalsePool).slice(0, 10).map(item => ({ id: item.id, prompt: item.prompt, kind: 'mcq' as TaskKind, options: item.options, correctOptionId: item.correctOptionId, points: item.points }));
        break;
      }
      case 'names-of-allah': {
        tasks = shuffle(namesOfAllahPool).slice(0, 10).map(item => ({ id: item.id, prompt: item.prompt, kind: 'mcq' as TaskKind, options: item.options, correctOptionId: item.correctOptionId, points: item.points }));
        break;
      }
      default: return null;
    }
    return { id: gameId, title: gameInfo.title, icon: gameInfo.icon, tasks };
  };

  useEffect(() => {
    if (!selectedGameId) return;
    const newSession = buildGameSession(selectedGameId);
    if (!newSession) { showToast('Failed to load game.'); setSelectedGameId(null); return; }
    setSession(newSession);
    if (selectedGameId === 'crossword') {
      const puzzleId = newSession.tasks[0]?.meta?.puzzleId;
      const puzzle = crosswordPuzzles.find(p => p.id === puzzleId) || null;
      setCrosswordPuzzleState(puzzle);
    }
  }, [selectedGameId]);

  const startGame = (gameId: GameId) => {
    if (!user?.id) { showToast('Please sign in to play and earn points'); return; }
    setSelectedGameId(gameId); resetState();
  };

  const currentTask = session?.tasks[taskIndex];
  const crosswordKey = (r: number, c: number) => `${r}-${c}`;

  const handleMcqAnswer = async (optionId: string) => {
    if (!currentTask || currentTask.kind !== 'mcq' || loading || selectedOption !== null) return;
    setSelectedOption(optionId);
    setMcqAnswered(true);
    const isCorrect = optionId === currentTask.correctOptionId;
    if (isCorrect) { setFeedback('✅ Correct! MashaAllah 🎉'); applyPointGain(currentTask.points); }
    else { setFeedback(`❌ Not quite. The answer was: ${currentTask.options.find(o => o.id === currentTask.correctOptionId)?.text}`); }
  };

  const handleMcqNext = async () => {
    setFeedback(null); setSelectedOption(null); setMcqAnswered(false);
    if (taskIndex < (session?.tasks.length ?? 0) - 1) setTaskIndex(p => p + 1);
    else await finishGame();
  };

  const handleHangmanGuess = async (letter: string) => {
    if (!currentTask || currentTask.kind !== 'hangman' || hangmanGuesses.has(letter) || hangmanWrongCount >= 6) return;
    const word = (currentTask.meta?.word as string)?.toUpperCase() || '';
    const newGuesses = new Set(hangmanGuesses); newGuesses.add(letter);
    setHangmanGuesses(newGuesses);
    if (word.includes(letter)) {
      const isComplete = [...word].every(ch => newGuesses.has(ch));
      if (isComplete) {
        setFeedback('🎉 MashaAllah! You guessed it!');
        applyPointGain(20);
        setTimeout(async () => { setFeedback(null); await finishGame(); }, 1500);
      }
    } else {
      const nw = hangmanWrongCount + 1; setHangmanWrongCount(nw);
      if (nw >= 6) { setFeedback(`Game Over! The word was ${word}`); setTimeout(async () => { setFeedback(null); await finishGame(); }, 2500); }
    }
  };

  const handleCrosswordInput = (r: number, c: number, value: string) => {
    const upper = value.toUpperCase().replace(/[^A-Z]/g, '').slice(-1);
    setCrosswordInputs(prev => ({ ...prev, [crosswordKey(r, c)]: upper }));
    setCrosswordChecked(false); setCrosswordErrors({});
  };

  const checkCrossword = async () => {
    if (!crosswordPuzzleState) return;
    const grid = buildCrosswordGrid(crosswordPuzzleState);
    const errors: Record<string, boolean> = {};
    let allCorrect = true;
    for (let r = 0; r < crosswordPuzzleState.rows; r++) {
      for (let c = 0; c < crosswordPuzzleState.cols; c++) {
        if (grid[r][c]) {
          const key = crosswordKey(r, c);
          if ((crosswordInputs[key] || '') !== grid[r][c]) { errors[key] = true; allCorrect = false; }
        }
      }
    }
    setCrosswordErrors(errors); setCrosswordChecked(true);
    if (allCorrect) {
      setCrosswordSolved(true); setFeedback('🎉 MashaAllah! Crossword completed!');
      applyPointGain(20);
      setTimeout(async () => { setFeedback(null); await finishGame(); }, 1800);
    } else { setFeedback('Some answers are incorrect. Keep trying!'); setTimeout(() => setFeedback(null), 2000); }
  };

  const handleScrambleSubmit = async () => {
    if (!currentTask || currentTask.kind !== 'scramble') return;
    const correct = currentTask.meta?.word as string;
    const isCorrect = scrambleInput.trim().toUpperCase() === correct;
    if (isCorrect) {
      setScrambleCorrect(true);
      setFeedback('Correct! MashaAllah 🎉');
      applyPointGain(currentTask.points);
    }
    else setFeedback(`Not quite! The answer was ${correct}`);
    setTimeout(async () => {
      setFeedback(null); setScrambleInput(''); setScrambleCorrect(false); setScrambleRevealed(false);
      if (taskIndex < (session?.tasks.length ?? 0) - 1) setTaskIndex(p => p + 1);
      else {
        await finishGame();
      }
    }, 900);
  };

  const revealScramble = () => { if (!currentTask) return; setScrambleRevealed(true); setScrambleInput(currentTask.meta?.word as string); };

  if (selectedGameId && session) {
    return (
      <div className="page-canvas py-8 px-4">
        <div className="max-w-3xl mx-auto">
          <button onClick={quitGame} className="flex items-center gap-2 text-[#134e4a] hover:text-[#0d9488] font-semibold mb-6">
            <ArrowLeft size={20} /> Back to Games
          </button>
          <div className="hero-panel p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{session.icon}</span>
                <div>
                  <h2 className="text-xl font-bold text-[#134e4a]">{session.title}</h2>
                  {session.tasks.length > 1 && <p className="text-sm text-[#475569]">Question {taskIndex + 1} of {session.tasks.length}</p>}
                </div>
              </div>
              <div className="bg-[#f0fdfa] px-4 py-2 rounded-xl">
                <p className="text-sm font-bold text-[#0d9488]">⭐ {points} pts</p>
              </div>
            </div>

            {currentTask?.kind === 'hangman' && (
              <div className="space-y-6">
                <div className="flex justify-center">
                  <svg width="120" height="130" viewBox="0 0 120 130" className="stroke-[#134e4a] fill-none stroke-2">
                    <line x1="10" y1="125" x2="110" y2="125" />
                    <line x1="40" y1="125" x2="40" y2="10" />
                    <line x1="40" y1="10" x2="80" y2="10" />
                    <line x1="80" y1="10" x2="80" y2="30" />
                    {hangmanWrongCount >= 1 && <circle cx="80" cy="40" r="10" />}
                    {hangmanWrongCount >= 2 && <line x1="80" y1="50" x2="80" y2="85" />}
                    {hangmanWrongCount >= 3 && <line x1="80" y1="58" x2="60" y2="73" />}
                    {hangmanWrongCount >= 4 && <line x1="80" y1="58" x2="100" y2="73" />}
                    {hangmanWrongCount >= 5 && <line x1="80" y1="85" x2="60" y2="110" />}
                    {hangmanWrongCount >= 6 && <line x1="80" y1="85" x2="100" y2="110" />}
                  </svg>
                </div>
                <p className="text-center text-[#475569] font-medium">Hint: {currentTask.prompt}</p>
                <div className="flex gap-2 justify-center flex-wrap">
                  {(currentTask.meta?.word as string)?.split('').map((char, idx) => (
                    <div key={idx} className="w-10 h-12 border-b-4 border-[#134e4a] flex items-center justify-center text-2xl font-bold text-[#134e4a]">
                      {hangmanGuesses.has(char.toUpperCase()) ? char.toUpperCase() : ''}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1.5 max-w-xs mx-auto">
                  {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(char => (
                    <button key={char} onClick={() => handleHangmanGuess(char)}
                      disabled={hangmanGuesses.has(char) || hangmanWrongCount >= 6}
                      className={`p-2 rounded-lg font-bold text-sm transition ${hangmanGuesses.has(char) ? ((currentTask.meta?.word as string)?.toUpperCase().includes(char) ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-400') : 'bg-[#ccfbf1] text-[#134e4a] hover:bg-[#0d9488] hover:text-white'}`}>
                      {char}
                    </button>
                  ))}
                </div>
                <p className="text-center text-sm text-[#475569]">Wrong guesses: {hangmanWrongCount}/6</p>
              </div>
            )}

            {currentTask?.kind === 'crossword' && crosswordPuzzleState && (() => {
              const solvedGrid = buildCrosswordGrid(crosswordPuzzleState);
              return (
                <div className="space-y-6">
                  <p className="text-lg font-semibold text-[#134e4a] text-center">{crosswordPuzzleState.title}</p>
                  <div className="overflow-x-auto">
                    <div className="inline-grid gap-0.5 mx-auto" style={{ gridTemplateColumns: `repeat(${crosswordPuzzleState.cols}, 2.5rem)` }}>
                      {Array.from({ length: crosswordPuzzleState.rows }, (_, r) =>
                        Array.from({ length: crosswordPuzzleState.cols }, (_, c) => {
                          const { inGrid, clueNumber } = getCrosswordCellMeta(crosswordPuzzleState, r, c);
                          const key = crosswordKey(r, c);
                          const val = crosswordInputs[key] || '';
                          const hasError = crosswordChecked && crosswordErrors[key];
                          const isCorrectCell = crosswordChecked && !crosswordErrors[key] && inGrid && !!val;
                          if (!inGrid) return <div key={key} className="w-10 h-10 bg-[#134e4a]" />;
                          return (
                            <div key={key} className="relative w-10 h-10">
                              {clueNumber && <span className="absolute top-0.5 left-0.5 text-[9px] font-bold text-[#134e4a] z-10 leading-none">{clueNumber}</span>}
                              <input type="text" maxLength={1} value={val} onChange={e => handleCrosswordInput(r, c, e.target.value)} disabled={crosswordSolved}
                                className={`w-10 h-10 border-2 text-center font-bold uppercase text-[#134e4a] text-base focus:outline-none focus:border-[#0d9488] transition ${hasError ? 'border-red-400 bg-red-50' : isCorrectCell ? 'border-emerald-400 bg-emerald-50' : 'border-[#5eead4] bg-[#fffdf9]'}`} />
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <p className="font-bold text-[#134e4a] mb-2">Across</p>
                      {crosswordPuzzleState.words.filter(w => w.direction === 'across').map(w => (
                        <p key={w.id} className="text-sm text-[#475569]"><span className="font-semibold text-[#134e4a]">{w.number}.</span> {w.clue}</p>
                      ))}
                    </div>
                    <div>
                      <p className="font-bold text-[#134e4a] mb-2">Down</p>
                      {crosswordPuzzleState.words.filter(w => w.direction === 'down').map(w => (
                        <p key={w.id} className="text-sm text-[#475569]"><span className="font-semibold text-[#134e4a]">{w.number}.</span> {w.clue}</p>
                      ))}
                    </div>
                  </div>
                  {!crosswordSolved && (
                    <button onClick={checkCrossword} disabled={loading} className="w-full py-3 bg-gradient-to-r from-[#0d9488] to-[#0f766e] text-white font-bold rounded-xl hover:opacity-90 transition disabled:opacity-60">
                      Check Answers
                    </button>
                  )}
                </div>
              );
            })()}

            {currentTask?.kind === 'scramble' && (
              <div className="space-y-6">
                <div className="text-center space-y-2">
                  <p className="text-sm text-[#475569]">Word {taskIndex + 1} of {session.tasks.length}</p>
                  <p className="text-[#134e4a] font-medium">Hint: <span className="font-semibold">{currentTask.prompt}</span></p>
                  <div className="flex gap-2 justify-center flex-wrap mt-4">
                    {(currentTask.meta?.scrambled as string)?.split('').map((ch, idx) => (
                      <div key={idx} className="w-10 h-10 bg-[#fbbf24] rounded-lg flex items-center justify-center text-xl font-bold text-white shadow">{ch}</div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3 max-w-sm mx-auto">
                  <input type="text" value={scrambleInput} onChange={e => setScrambleInput(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                    onKeyDown={e => e.key === 'Enter' && handleScrambleSubmit()} placeholder="Type your answer…"
                    disabled={scrambleCorrect}
                    className="flex-1 border-2 border-[#5eead4] rounded-xl px-4 py-3 text-[#134e4a] font-bold uppercase text-center focus:outline-none focus:border-[#0d9488]" />
                  <button onClick={handleScrambleSubmit} disabled={!scrambleInput || loading}
                    className="px-4 py-3 bg-[#0d9488] text-white font-bold rounded-xl hover:bg-[#0f766e] transition disabled:opacity-50">Go!</button>
                </div>
                <div className="flex justify-center">
                  <button onClick={revealScramble} disabled={scrambleRevealed} className="text-sm text-[#475569] hover:text-[#134e4a] underline disabled:opacity-40">Reveal answer (skip)</button>
                </div>
              </div>
            )}

            {currentTask?.kind === 'mcq' && (
              <div className="space-y-4">
                <p className="text-sm text-[#475569]">Question {taskIndex + 1} of {session.tasks.length}</p>
                <p className="text-lg font-semibold text-[#134e4a]">{currentTask.prompt}</p>
                <div className="space-y-3">
                  {currentTask.options.map(opt => {
                    const isSelected = selectedOption === opt.id;
                    const isCorrect = opt.id === currentTask.correctOptionId;
                    let cls = 'w-full text-left rounded-xl px-4 py-3 border-2 transition font-medium';
                    if (selectedOption && isSelected && isCorrect) cls += ' border-emerald-500 bg-emerald-50 text-emerald-700';
                    else if (selectedOption && isSelected && !isCorrect) cls += ' border-red-400 bg-red-50 text-red-700';
                    else if (selectedOption && isCorrect) cls += ' border-emerald-300 bg-emerald-50 text-emerald-700';
                    else cls += ' border-[#5eead4]/50 bg-white text-[#134e4a] hover:border-[#0d9488] hover:bg-[#f0fdfa]';
                    return <button key={opt.id} disabled={!!selectedOption || loading} onClick={() => handleMcqAnswer(opt.id)} className={cls}>{opt.text}</button>;
                  })}
                </div>
                {mcqAnswered && (
                  <button
                    onClick={handleMcqNext}
                    disabled={loading}
                    className="w-full py-3 bg-gradient-to-r from-[#0d9488] to-[#0f766e] text-white font-bold rounded-xl hover:opacity-90 transition disabled:opacity-60"
                  >
                    {taskIndex < (session?.tasks.length ?? 0) - 1 ? 'Next Question →' : 'See Results 🏆'}
                  </button>
                )}
              </div>
            )}

            {feedback && <div className="mt-4 p-4 bg-[#fffbeb] rounded-xl text-[#b45309] font-semibold text-center">{feedback}</div>}
          </div>
        </div>
        {toast && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#134e4a] text-white px-6 py-3 rounded-xl shadow-lg z-50">{toast}</div>}
      </div>
    );
  }

  return (
    <>
      <div className="page-canvas pattern-islamic">
        <div className="page-wrap max-w-5xl space-y-8">
          <EarnMorePointsLinks title="Earn more points today" />
          <FadeUp className="hero-panel text-center space-y-4 p-8">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#fffbeb] rounded-full border border-[#fbbf24]/30 mx-auto">
              <Sparkles size={16} className="text-[#f59e0b]" />
              <span className="text-sm font-semibold text-[#b45309]">Learn Through Play</span>
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-[#134e4a]">Islamic Games</h1>
            <p className="text-[#475569] text-lg max-w-2xl mx-auto">
              Finish up to {MAX_DAILY_GAME_COMPLETIONS} full games per day — +{ACTIVITY_BONUS_POINTS} points each ({gamesUsedToday}/{MAX_DAILY_GAME_COMPLETIONS} used today).
            </p>
          </FadeUp>
          <FadeUp delay={0.1}>
            <div className="feature-tile border-[#0d9488]/30 bg-gradient-to-r from-[#ecfeff] to-[#f0fdfa] p-5 text-center">
            <p className="text-[#115e59] font-bold text-base md:text-lg">
              Weekly competition updates are posted in Rewards and Leaderboard.
            </p>
            <p className="text-[#115e59] mt-2 text-sm md:text-base">
              Please continue taking part most days to win prizes. New games are added to help you gain more points.
            </p>
            <p className="text-[#115e59] mt-2 text-sm md:text-base font-semibold">
              Earn above 150 points during the week to enter the random winners draw. Leaderboard rank is for fun — winners are not chosen by who is #1.
            </p>
            <p className="text-[#115e59] mt-2 text-sm md:text-base font-semibold">
              Check the Rewards page for important announcements and your weekly and monthly achievements.
            </p>
            </div>
          </FadeUp>
          <Stagger className="mx-auto grid max-w-md grid-cols-3 gap-4" delayChildren={0.15}>
            {[{ icon: Star, label: 'Your Points', value: profile?.points || 0, color: 'text-[#f59e0b]' }, { icon: Trophy, label: 'Badges', value: profile?.badges || 0, color: 'text-[#0d9488]' }, { icon: Target, label: 'Games Played', value: profile?.gamesPlayed || 0, color: 'text-[#14b8a6]' }].map((stat, idx) => (
              <StaggerItem key={idx}>
                <div className="stat-pill rounded-xl p-4 text-center">
                  <stat.icon size={24} className={`mx-auto mb-2 ${stat.color}`} />
                  <p className="text-2xl font-bold text-[#134e4a]">{stat.value}</p>
                  <p className="text-xs text-[#475569]">{stat.label}</p>
                </div>
              </StaggerItem>
            ))}
          </Stagger>
          {/* ── Quran Memory Match ── */}
          <div
            className="rounded-2xl overflow-hidden border border-purple-300/40 shadow-sm cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all"
            onClick={() => router.push('/quran-match')}
            role="link"
          >
            <div className="bg-gradient-to-r from-purple-600 to-violet-700 p-5 flex items-center gap-5">
              <span className="text-5xl shrink-0">🧩</span>
              <div className="flex-1 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-black text-xl">Quran Memory Match</h3>
                  <span className="bg-yellow-400 text-yellow-900 text-xs font-black px-2 py-0.5 rounded-full">NEW</span>
                </div>
                <p className="text-purple-100 text-sm">Flip cards and match Quranic terms with their meanings — earn daily points!</p>
              </div>
              <span className="text-white text-2xl shrink-0">→</span>
            </div>
          </div>

          {/* ── Salah Steps ── */}
          <div
            className="rounded-2xl overflow-hidden border border-emerald-300/40 shadow-sm cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all"
            onClick={() => router.push('/games/salah-steps')}
            role="link"
          >
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-5 flex items-center gap-5">
              <span className="text-5xl shrink-0">🕌</span>
              <div className="flex-1 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-black text-xl">Salah Steps</h3>
                  <span className="bg-yellow-400 text-yellow-900 text-xs font-black px-2 py-0.5 rounded-full">NEW</span>
                </div>
                <p className="text-emerald-100 text-sm">Put Fajr through Isha in the right order — a fun way to learn the daily prayers!</p>
              </div>
              <span className="text-white text-2xl shrink-0">→</span>
            </div>
          </div>

          {/* ── Wudu Steps ── */}
          <div
            className="rounded-2xl overflow-hidden border border-sky-300/40 shadow-sm cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all"
            onClick={() => router.push('/games/wudu-steps')}
            role="link"
          >
            <div className="bg-gradient-to-r from-sky-600 to-cyan-700 p-5 flex items-center gap-5">
              <span className="text-5xl shrink-0">💧</span>
              <div className="flex-1 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-black text-xl">Wudu Steps</h3>
                  <span className="bg-yellow-400 text-yellow-900 text-xs font-black px-2 py-0.5 rounded-full">NEW</span>
                </div>
                <p className="text-sky-100 text-sm">Put the steps of wudu in the correct order and earn game points!</p>
              </div>
              <span className="text-white text-2xl shrink-0">→</span>
            </div>
          </div>

          {/* ── Names of Allah ── */}
          <div
            className="rounded-2xl overflow-hidden border border-blue-300/40 shadow-sm cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all"
            onClick={() => router.push('/games/names-flashcards')}
            role="link"
          >
            <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-5 flex items-center gap-5">
              <span className="text-5xl shrink-0">☪️</span>
              <div className="flex-1 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-black text-xl">Names of Allah</h3>
                  <span className="bg-yellow-400 text-yellow-900 text-xs font-black px-2 py-0.5 rounded-full">NEW</span>
                </div>
                <p className="text-blue-100 text-sm">Flashcards and match beautiful names to their meanings.</p>
              </div>
              <span className="text-white text-2xl shrink-0">→</span>
            </div>
          </div>

          {/* ── Prophet Facts ── */}
          <div
            className="rounded-2xl overflow-hidden border border-amber-300/40 shadow-sm cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all"
            onClick={() => router.push('/games/prophet-facts')}
            role="link"
          >
            <div className="bg-gradient-to-r from-amber-500 to-orange-600 p-5 flex items-center gap-5">
              <span className="text-5xl shrink-0">🌟</span>
              <div className="flex-1 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-black text-xl">Prophet ﷺ Facts</h3>
                  <span className="bg-yellow-400 text-yellow-900 text-xs font-black px-2 py-0.5 rounded-full">NEW</span>
                </div>
                <p className="text-amber-50 text-sm">Answer Seerah questions for kids — score 3/5 to earn points!</p>
              </div>
              <span className="text-white text-2xl shrink-0">→</span>
            </div>
          </div>

          {/* ── Word Search hunts ── */}
          <div
            className="rounded-2xl overflow-hidden border border-violet-300/40 shadow-sm cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all"
            onClick={() => router.push('/games/word-search')}
            role="link"
          >
            <div className="bg-gradient-to-r from-violet-600 to-indigo-700 p-5 flex items-center gap-5">
              <span className="text-5xl shrink-0">🔍</span>
              <div className="flex-1 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-black text-xl">Islamic Word Hunts</h3>
                  <span className="bg-gold-400 text-gold-900 text-xs font-black px-2 py-0.5 rounded-full">NEW</span>
                </div>
                <p className="text-violet-100 text-sm">Ramadan, Seerah &amp; Quran themed word searches with bonus quizzes!</p>
              </div>
              <span className="text-white text-2xl shrink-0">→</span>
            </div>
          </div>

          {/* ── Hajj Learning Games featured banner ── */}
          <div
            className="rounded-2xl overflow-hidden border border-[#3b82f6]/30 shadow-sm cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all"
            onClick={() => router.push('/games/hajj')}
            role="link"
          >
            <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-5 flex items-center gap-5">
              <span className="text-5xl shrink-0">🕌</span>
              <div className="flex-1 text-white">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="font-black text-xl">Hajj Learning Games</h3>
                  <span className="bg-yellow-400 text-yellow-900 text-xs font-black px-2 py-0.5 rounded-full">NEW</span>
                </div>
                <p className="text-blue-100 text-sm">5 interactive games — Tawaf, Safa &amp; Marwah, Ibrahim&apos;s Story, Hajj Quiz &amp; more!</p>
              </div>
              <span className="text-white text-2xl shrink-0">→</span>
            </div>
          </div>

          <Stagger className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3" delayChildren={0.2}>
            <StaggerItem>
              <Link
                href="/games/memory-match"
                className="feature-tile group rounded-2xl border-2 border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-6 text-left"
              >
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 shadow-md transition-transform group-hover:scale-110">
                  <span className="text-3xl">🃏</span>
                </div>
                <h3 className="mb-1 text-lg font-bold text-[#134e4a]">Islamic Memory Match</h3>
                <p className="mb-3 text-sm text-[#475569]">
                  {isYounger
                    ? 'Big picture cards — find the matching pairs!'
                    : 'Match Arabic terms with English meanings. Optional timer.'}
                </p>
                <span className="inline-block rounded-xl border border-amber-300 bg-white px-3 py-1 text-xs font-semibold text-amber-800">
                  🌟 Earn +{ACTIVITY_BONUS_POINTS} pts
                </span>
              </Link>
            </StaggerItem>
            {gameCatalog.map((game) => (
              <StaggerItem key={game.id}>
                <button
                  type="button"
                  onClick={() => startGame(game.id)}
                  className="feature-tile group w-full rounded-2xl p-6 text-left"
                >
                  <div
                    className={`mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-gradient-to-br ${game.color} shadow-md transition-transform group-hover:scale-110`}
                  >
                    <span className="text-3xl">{game.icon}</span>
                  </div>
                  <h3 className="mb-1 text-lg font-bold text-[#134e4a]">{game.title}</h3>
                  <p className="mb-3 text-sm text-[#475569]">{game.description}</p>
                  <span className="inline-block rounded-xl border border-[#0d9488]/30 bg-[#f0fdfa] px-3 py-1 text-xs font-semibold text-[#0f766e]">
                    🌟 Earn points
                  </span>
                </button>
              </StaggerItem>
            ))}
          </Stagger>
          <FadeUp delay={0.25}>
            <div className="feature-tile rounded-2xl border-[#0d9488]/20 bg-[#f0fdfa] p-6">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-[#0d9488]">
                  <Puzzle size={24} className="text-white" />
                </div>
                <div>
                  <h4 className="mb-1 font-bold text-[#0f766e]">Pro Tip</h4>
                  <p className="text-[#115e59]">
                    Try all 5 games to learn different aspects of Islam — hangman improves vocabulary, the crossword
                    tests spelling, word scramble sharpens recognition, and the quizzes deepen your knowledge of
                    Allah&apos;s names and Islamic facts!
                  </p>
                </div>
              </div>
            </div>
          </FadeUp>
        </div>
      </div>
      {toast && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-[#134e4a] text-white px-6 py-3 rounded-xl shadow-lg z-50">{toast}</div>}
    </>
  );
}
