import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, LogOut, Menu, X, ChevronDown } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ALL_NAV_ITEMS,
  CHAT_ITEM,
  getRuntimeNavGroups,
  HOME_ITEM,
  isFitnessChallengeAvailableInCurrentRuntime,
  type NavGroupId,
  isGroupActive,
  isNavActive,
} from '@/lib/nav-config';
import { getKidLevelTitle } from '@/lib/level-names';

const SUPPORT_DONATE_URL = 'https://islam-media-donate.vercel.app/';

interface NavbarUser {
  name: string;
  points: number;
  level: string;
  badges?: number;
}

interface NavbarProps {
  username?: string;
  points?: number;
  level?: string;
  badges?: number;
  onLogout?: () => void | Promise<void>;
  user?: NavbarUser | null;
  loading?: boolean;
}

function SupportDonateLink({ compact = false }: { compact?: boolean }) {
  return (
    <a
      href={SUPPORT_DONATE_URL}
      target="_blank"
      rel="noopener noreferrer"
      title="Support with a little donation"
      aria-label="Support with a little donation"
      className={
        compact
          ? 'inline-flex items-center gap-1 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-2.5 py-2 text-xs font-bold text-white shadow-md transition hover:shadow-lg interactive-focus touch-target sm:px-3 sm:text-sm'
          : 'inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-500 to-rose-600 px-3.5 py-2.5 text-sm font-bold text-white shadow-md transition transition-bouncy hover:shadow-lg interactive-focus touch-target'
      }
    >
      <Heart size={compact ? 14 : 16} className="fill-white/90" aria-hidden />
      <span className="leading-tight">
        {compact ? 'Donate' : 'Support'}
        {!compact && <span className="hidden xl:inline"> · little gift</span>}
      </span>
    </a>
  );
}

export const Navbar: React.FC<NavbarProps> = ({ username, points, level, badges, onLogout, user, loading }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState<NavGroupId | null>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showFitnessChallenge, setShowFitnessChallenge] = useState(false);
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const desktopNavRef = useRef<HTMLDivElement>(null);

  const displayUsername = username || user?.name;
  const displayPoints = points !== undefined ? points : user?.points;
  const displayLevel = getKidLevelTitle(level || user?.level);
  const displayBadges = badges !== undefined ? badges : user?.badges;
  const visibleGroups = React.useMemo(
    () => getRuntimeNavGroups(showFitnessChallenge),
    [showFitnessChallenge]
  );

  // Close any open menus when the route changes.
  useEffect(() => {
    setIsMenuOpen(false);
    setOpenGroup(null);
  }, [pathname]);

  useEffect(() => {
    setShowFitnessChallenge(isFitnessChallengeAvailableInCurrentRuntime());
  }, []);

  // Close the desktop dropdown on outside click / Escape.
  useEffect(() => {
    if (!openGroup) return;
    const onClick = (e: MouseEvent) => {
      if (desktopNavRef.current && !desktopNavRef.current.contains(e.target as Node)) {
        setOpenGroup(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenGroup(null);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [openGroup]);

  const handleLogout = async (afterLogout?: () => void) => {
    try {
      setIsLoggingOut(true);
      if (onLogout) {
        await onLogout();
        afterLogout?.();
      }
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <nav className="app-navbar-safe sticky top-0 z-50 border-b border-sand-200/70 bg-white/80 shadow-[var(--nav-shadow)] backdrop-blur-xl backdrop-saturate-150">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-14 sm:h-[3.75rem]">
          {/* Logo — Kids Zone wordmark always visible */}
          <Link href="/" className="group flex min-w-0 items-center gap-2.5 sm:gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 shadow-sm ring-1 ring-white/70 transition-transform group-hover:scale-[1.04] sm:h-10 sm:w-10 sm:rounded-2xl">
              <span className="text-lg sm:text-xl" aria-hidden>
                🌙
              </span>
            </div>
            <div className="min-w-0">
              <h1 className="font-heading text-lg font-extrabold leading-tight tracking-tight text-teal-900 sm:text-xl">
                Kids Zone
              </h1>
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-sand-500 sm:block">
                Islamic Learning
              </p>
            </div>
          </Link>

          {/* Desktop Navigation - grouped dropdowns */}
          <div
            ref={desktopNavRef}
            className="hidden lg:flex items-center gap-1 rounded-2xl border border-sand-200/80 bg-white/70 p-1.5 shadow-sm"
          >
            <Link
              href={HOME_ITEM.href}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all transition-bouncy interactive-focus touch-target ${
                isNavActive(pathname, HOME_ITEM.href)
                  ? 'bg-gradient-to-r from-teal-50 to-teal-100/80 text-teal-800 shadow-sm ring-1 ring-teal-200/60'
                  : 'text-sand-800 hover:bg-teal-50/60 hover:text-teal-700'
              }`}
              aria-current={isNavActive(pathname, HOME_ITEM.href) ? 'page' : undefined}
            >
              <HOME_ITEM.icon size={16} />
              {HOME_ITEM.label}
            </Link>

            {visibleGroups.map((group) => {
              const groupActive = isGroupActive(pathname, group);
              const isOpen = openGroup === group.id;
              return (
                <div
                  key={group.id}
                  className="relative"
                  onMouseEnter={() => setOpenGroup(group.id)}
                  onMouseLeave={() => setOpenGroup(null)}
                >
                  <button
                    type="button"
                    onClick={() => setOpenGroup(isOpen ? null : group.id)}
                    aria-haspopup="menu"
                    aria-expanded={isOpen}
                    className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all transition-bouncy interactive-focus touch-target ${
                      groupActive || isOpen
                        ? 'bg-gradient-to-r from-teal-50 to-teal-100/80 text-teal-800 shadow-sm ring-1 ring-teal-200/60'
                        : 'text-sand-800 hover:bg-teal-50/60 hover:text-teal-700'
                    }`}
                  >
                    <span aria-hidden="true">{group.emoji}</span>
                    {group.label}
                    <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        role="menu"
                        className="absolute left-0 top-full z-50 mt-2 w-64 overflow-hidden rounded-2xl border border-sand-200/80 bg-white/95 p-1.5 shadow-xl backdrop-blur-xl"
                        initial={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                        animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
                        exit={reduceMotion ? undefined : { opacity: 0, y: -6 }}
                        transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
                      >
                        {group.items.map((item) => {
                          const active = isNavActive(pathname, item.href);
                          return (
                            <Link
                              key={item.href}
                              href={item.href}
                              role="menuitem"
                              className={`flex items-start gap-3 rounded-xl px-3 py-2.5 transition interactive-focus ${
                                active ? 'bg-teal-50 text-teal-800' : 'text-sand-800 hover:bg-teal-50/60'
                              }`}
                              aria-current={active ? 'page' : undefined}
                            >
                              <span className={`mt-0.5 ${active ? 'text-teal-600' : 'text-sand-500'}`}>
                                <item.icon size={18} />
                              </span>
                              <span>
                                <span className="block text-sm font-bold leading-tight">{item.label}</span>
                                <span className="block text-xs text-sand-600">{item.description}</span>
                              </span>
                            </Link>
                          );
                        })}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}

            <Link
              href={CHAT_ITEM.href}
              className={`flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all transition-bouncy interactive-focus touch-target ${
                isNavActive(pathname, CHAT_ITEM.href)
                  ? 'bg-gradient-to-r from-teal-50 to-teal-100/80 text-teal-800 shadow-sm ring-1 ring-teal-200/60'
                  : 'text-sand-800 hover:bg-teal-50/60 hover:text-teal-700'
              }`}
              aria-current={isNavActive(pathname, CHAT_ITEM.href) ? 'page' : undefined}
            >
              <CHAT_ITEM.icon size={16} />
              {CHAT_ITEM.label}
            </Link>
          </div>

          {/* Desktop User Actions */}
          <div className="hidden md:flex items-center gap-3">
            <SupportDonateLink />
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="w-20 h-8 bg-[#ede9fe] rounded-xl animate-pulse"></div>
                <div className="w-12 h-8 bg-[#ede9fe] rounded-xl animate-pulse"></div>
              </div>
            ) : displayUsername ? (
              <>
                <div className="flex items-center gap-2 rounded-xl border border-sand-200/60 bg-gradient-to-r from-sand-50 to-teal-50/50 px-4 py-2 shadow-sm">
                  <div className="text-right">
                    <p className="text-sm font-bold text-sand-900">{displayUsername}</p>
                    <p className="text-xs text-sand-600">{displayLevel || 'Beginner'}</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <div className="rounded-xl bg-gradient-to-br from-gold-400 to-gold-600 px-3 py-2 text-white shadow-md">
                    <p className="text-xs font-bold">⭐ {displayPoints || 0}</p>
                  </div>
                  <div className="rounded-xl bg-gradient-to-br from-teal-500 to-teal-700 px-3 py-2 text-white shadow-md">
                    <p className="text-xs font-bold">🏆 {displayBadges || 0}</p>
                  </div>
                </div>

                {onLogout && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      void handleLogout();
                    }}
                    disabled={isLoggingOut}
                    className="p-2 text-[#ff6b6b] hover:bg-[#fff5f5] rounded-xl transition interactive-focus disabled:opacity-50 disabled:cursor-not-allowed"
                    aria-label="Sign out"
                  >
                    <LogOut size={20} />
                  </button>
                )}
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Link
                  href="/signin"
                  className="px-4 py-2.5 text-[#1e1b4b] font-semibold hover:bg-[#ede9fe] rounded-xl transition interactive-focus touch-target"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="rounded-xl bg-gradient-to-r from-teal-500 to-teal-700 px-4 py-2.5 font-semibold text-white shadow-md transition transition-bouncy hover:shadow-lg interactive-focus touch-target"
                >
                  Sign Up
                </Link>
              </div>
            )}
          </div>

          {/* Tablet / phone: donate (phones) + auth + hamburger */}
          <div className="flex items-center gap-1.5 sm:gap-2 lg:hidden shrink-0">
            <span className="md:hidden">
              <SupportDonateLink compact />
            </span>
            {!loading && !displayUsername && (
              <>
                <Link
                  href="/signin"
                  className="rounded-xl border border-teal-200 bg-white px-2.5 py-2 text-xs font-bold text-teal-800 shadow-sm transition hover:bg-teal-50 interactive-focus touch-target sm:px-3.5 sm:text-sm"
                >
                  Sign In
                </Link>
                <Link
                  href="/signup"
                  className="rounded-xl bg-gradient-to-r from-teal-500 to-teal-700 px-2.5 py-2 text-xs font-bold text-white shadow-md transition hover:shadow-lg interactive-focus touch-target sm:px-3.5 sm:text-sm"
                >
                  Sign Up
                </Link>
              </>
            )}
            <button
              className="hidden sm:inline-flex p-2.5 text-[#1e1b4b] hover:bg-[#ede9fe] rounded-xl transition interactive-focus touch-target border border-[#ddd6fe]/60 bg-white/60"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              aria-expanded={isMenuOpen}
              aria-controls="mobile-main-menu"
              aria-label={isMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Tablet Menu (grouped) */}
        <AnimatePresence>
          {isMenuOpen && (
          <motion.div
            id="mobile-main-menu"
            className="lg:hidden py-4 border-t border-[#c4b5fd]/40"
            initial={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex flex-col gap-4">
              {visibleGroups.map((group) => (
                <div key={group.id}>
                  <p className="px-4 pb-1 text-xs font-bold uppercase tracking-[0.14em] text-sand-500">
                    {group.emoji} {group.label}
                  </p>
                  <div className="flex flex-col gap-1">
                    {group.items.map((item) => {
                      const active = isNavActive(pathname, item.href);
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all interactive-focus touch-target ${
                            active
                              ? 'bg-gradient-to-r from-[#ede9fe] to-[#ede9fe] text-[#6d28d9]'
                              : 'text-[#1e1b4b] hover:bg-[#f5f3ff] hover:text-[#6d28d9]'
                          }`}
                          onClick={() => setIsMenuOpen(false)}
                          aria-current={active ? 'page' : undefined}
                        >
                          <item.icon size={20} />
                          {item.label}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}

              {/* Home + Chat quick links */}
              <div className="flex flex-col gap-1">
                {[HOME_ITEM, CHAT_ITEM].map((item) => {
                  const active = isNavActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-3 rounded-xl font-semibold transition-all interactive-focus touch-target ${
                        active
                          ? 'bg-gradient-to-r from-[#ede9fe] to-[#ede9fe] text-[#6d28d9]'
                          : 'text-[#1e1b4b] hover:bg-[#f5f3ff] hover:text-[#6d28d9]'
                      }`}
                      onClick={() => setIsMenuOpen(false)}
                      aria-current={active ? 'page' : undefined}
                    >
                      <item.icon size={20} />
                      {item.label}
                    </Link>
                  );
                })}
              </div>

              <div className="mt-2 pt-4 border-t border-[#c4b5fd]/30">
                {loading ? (
                  <div className="px-4 py-3">
                    <div className="w-32 h-6 bg-[#ede9fe] rounded animate-pulse mb-2"></div>
                    <div className="w-20 h-4 bg-[#ede9fe] rounded animate-pulse"></div>
                  </div>
                ) : displayUsername ? (
                  <div className="space-y-3 px-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-[#1e1b4b]">{displayUsername}</p>
                        <p className="text-sm text-[#475569]">{displayLevel || 'Beginner'}</p>
                      </div>
                      <div className="flex gap-2">
                        <span className="text-sm font-bold text-[#f59e0b]">⭐ {displayPoints || 0}</span>
                        <span className="text-sm font-bold text-[#6d28d9]">🏆 {displayBadges || 0}</span>
                      </div>
                    </div>

                    {onLogout && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          void handleLogout(() => setIsMenuOpen(false));
                        }}
                        disabled={isLoggingOut}
                        className="w-full flex items-center justify-center gap-2 bg-[#fff5f5] text-[#ff6b6b] font-semibold px-4 py-3 rounded-xl transition interactive-focus touch-target disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <LogOut size={18} />
                        {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 px-4">
                    <Link
                      href="/signin"
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full text-center py-3 text-[#1e1b4b] font-semibold hover:bg-[#ede9fe] rounded-xl transition interactive-focus touch-target"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/signup"
                      onClick={() => setIsMenuOpen(false)}
                      className="w-full text-center py-3 bg-gradient-to-r from-teal-500 to-teal-700 text-white font-semibold rounded-xl transition interactive-focus touch-target"
                    >
                      Sign Up
                    </Link>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
        </AnimatePresence>
      </div>
    </nav>
  );
};

/** Exposed for potential reuse/testing. */
export const NAVBAR_ITEMS = ALL_NAV_ITEMS;
