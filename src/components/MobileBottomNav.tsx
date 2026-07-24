import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { LayoutGrid, LogOut, X } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import {
  BOTTOM_TABS,
  CHAT_ITEM,
  getRuntimeNavGroups,
  HOME_ITEM,
  isFitnessChallengeAvailableInCurrentRuntime,
  isNavActive,
} from '@/lib/nav-config';

export const MobileBottomNav = () => {
  const pathname = usePathname();
  const reduceMotion = useReducedMotion();
  const { user, profile, logout } = useAuth();
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [showFitnessChallenge, setShowFitnessChallenge] = useState(false);
  const visibleGroups = React.useMemo(
    () => getRuntimeNavGroups(showFitnessChallenge),
    [showFitnessChallenge]
  );

  // Close the sheet whenever the route changes.
  useEffect(() => {
    setIsSheetOpen(false);
  }, [pathname]);

  // Lock body scroll while the full menu sheet is open.
  useEffect(() => {
    if (!isSheetOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isSheetOpen]);

  useEffect(() => {
    setShowFitnessChallenge(isFitnessChallengeAvailableInCurrentRuntime());
  }, []);

  const displayName = profile?.name;
  const menuActive = isSheetOpen || visibleGroups.some((g) =>
    g.items.some((i) => !BOTTOM_TABS.includes(i) && isNavActive(pathname, i.href))
  ) || isNavActive(pathname, CHAT_ITEM.href);

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await logout();
      setIsSheetOpen(false);
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  return (
    <>
      {/* Full menu sheet */}
      <AnimatePresence>
        {isSheetOpen && (
          <motion.div
            className="fixed inset-0 z-[60] sm:hidden"
            initial={reduceMotion ? undefined : { opacity: 0 }}
            animate={reduceMotion ? undefined : { opacity: 1 }}
            exit={reduceMotion ? undefined : { opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              type="button"
              aria-label="Close menu"
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsSheetOpen(false)}
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Menu"
              className="absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl border-t border-violet-200/60 bg-white p-5 pb-[calc(env(safe-area-inset-bottom)+1.5rem)] shadow-2xl"
              initial={reduceMotion ? undefined : { y: '100%' }}
              animate={reduceMotion ? undefined : { y: 0 }}
              exit={reduceMotion ? undefined : { y: '100%' }}
              transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-sand-200" aria-hidden="true" />
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-heading text-lg font-bold text-sand-900">Explore everything</h2>
                <button
                  type="button"
                  onClick={() => setIsSheetOpen(false)}
                  aria-label="Close menu"
                  className="rounded-full p-2 text-sand-600 hover:bg-sand-100 interactive-focus"
                >
                  <X size={22} />
                </button>
              </div>

              <div className="space-y-4">
                {visibleGroups.map((group) => (
                  <div key={group.id}>
                    <p className="mb-1.5 text-xs font-bold uppercase tracking-[0.14em] text-sand-500">
                      {group.emoji} {group.label}
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {group.items.map((item) => {
                        const active = isNavActive(pathname, item.href);
                        return (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={() => setIsSheetOpen(false)}
                            className={`flex items-center gap-2.5 rounded-2xl px-3 py-3 text-base font-bold transition interactive-focus touch-target ${
                              active
                                ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-200/60'
                                : 'bg-sand-50 text-sand-800 hover:bg-violet-50 hover:text-violet-700'
                            }`}
                            aria-current={active ? 'page' : undefined}
                          >
                            <item.icon size={20} className={active ? 'text-violet-600' : 'text-sand-500'} />
                            <span>{item.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}

                {/* Home + Chat */}
                <div className="grid grid-cols-2 gap-2">
                  {[HOME_ITEM, CHAT_ITEM].map((item) => {
                    const active = isNavActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setIsSheetOpen(false)}
                        className={`flex items-center gap-2.5 rounded-2xl px-3 py-3 text-base font-bold transition interactive-focus touch-target ${
                          active
                            ? 'bg-violet-50 text-violet-700 ring-1 ring-violet-200/60'
                            : 'bg-sand-50 text-sand-800 hover:bg-violet-50 hover:text-violet-700'
                        }`}
                        aria-current={active ? 'page' : undefined}
                      >
                        <item.icon size={20} className={active ? 'text-violet-600' : 'text-sand-500'} />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Account actions */}
              <div className="mt-5 border-t border-sand-200 pt-4">
                {user && displayName ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between px-1">
                      <p className="font-bold text-sand-900">{displayName}</p>
                      <span className="text-sm font-bold text-gold-600">⭐ {profile?.points ?? 0}</span>
                    </div>
                    <button
                      type="button"
                      onClick={handleLogout}
                      disabled={isLoggingOut}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#fff5f5] px-4 py-3 font-bold text-[#ff6b6b] transition interactive-focus touch-target disabled:opacity-50"
                    >
                      <LogOut size={18} />
                      {isLoggingOut ? 'Signing Out...' : 'Sign Out'}
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <Link
                      href="/signin"
                      onClick={() => setIsSheetOpen(false)}
                      className="w-full rounded-2xl py-3 text-center font-bold text-sand-800 hover:bg-sand-100 interactive-focus touch-target"
                    >
                      Sign In
                    </Link>
                    <Link
                      href="/signup"
                      onClick={() => setIsSheetOpen(false)}
                      className="w-full rounded-2xl bg-gradient-to-r from-teal-500 to-teal-700 py-3 text-center font-bold text-white interactive-focus touch-target"
                    >
                      Sign Up
                    </Link>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Fixed bottom tab bar (phones only) */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-50 border-t border-sand-200/70 bg-white/95 backdrop-blur-xl sm:hidden"
      >
        <div className="mobile-tabbar-inset mx-auto grid max-w-lg grid-cols-5">
          {BOTTOM_TABS.map((item) => {
            const active = isNavActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex flex-col items-center justify-center gap-1 px-1 py-2.5 text-[11px] font-bold transition interactive-focus ${
                  active ? 'text-violet-700' : 'text-sand-500'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                <span
                  className={`flex h-9 w-9 items-center justify-center rounded-2xl transition ${
                    active ? 'bg-violet-100 text-violet-700' : 'text-sand-500'
                  }`}
                >
                  <item.icon size={20} />
                </span>
                <span>{item.shortLabel}</span>
              </Link>
            );
          })}

          <button
            type="button"
            onClick={() => setIsSheetOpen(true)}
            aria-label="Open full menu"
            aria-expanded={isSheetOpen}
            className={`flex flex-col items-center justify-center gap-1 px-1 py-2.5 text-[11px] font-bold transition interactive-focus ${
              menuActive ? 'text-violet-700' : 'text-sand-500'
            }`}
          >
            <span
              className={`flex h-9 w-9 items-center justify-center rounded-2xl transition ${
                menuActive ? 'bg-violet-100 text-violet-700' : 'text-sand-500'
              }`}
            >
              <LayoutGrid size={20} />
            </span>
            <span>Menu</span>
          </button>
        </div>
      </nav>
    </>
  );
};
