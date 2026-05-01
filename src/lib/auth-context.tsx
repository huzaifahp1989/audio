"use client";

import React, { createContext, useContext, useEffect, useMemo, useState, useCallback } from 'react';
import { ensureUserProfile } from '@/lib/user-profile';
import { supabase } from '@/lib/supabase';
import { mobileAuthHelper } from '@/lib/mobile-auth';

type KidProfile = {
  uid: string;
  role: 'kid' | 'admin' | string;
  name: string;
  age: number;
  madrasahName?: string;
  contactNumber?: string;
  email: string;
  points: number;
  weeklyPoints?: number;
  monthlyPoints?: number;
  todayPoints?: number;
  dailyLimit?: number;
  badges?: number;
  level: string;
  streak?: number;
  lastStreakUpdate?: string;
  isFlagged?: boolean;
  parentEmail?: string;
  reminderOptIn?: boolean;
  reminderFrequency?: 'daily' | '3x_week' | 'weekly';
  reminderLastSentAt?: string | null;
};

interface AuthContextValue {
  user: { id: string; email?: string | null } | null;
  profile: KidProfile | null;
  loading: boolean;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateLocalProfile: (updates: Partial<KidProfile>) => void;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  profile: null,
  loading: true,
  logout: async () => {},
  refreshProfile: async () => {},
  updateLocalProfile: () => {},
});

const DAILY_LIMIT = 100;

const isPlaceholderName = (name: string | null | undefined): boolean => {
  if (!name) return true;
  const t = name.trim();
  if (!t) return true;
  return /^learner\b/i.test(t);
};

const getBestName = async (currentName: string | undefined | null, email: string | undefined | null) => {
  const { data: authData } = await supabase.auth.getUser();
  const meta = (authData?.user?.user_metadata as any) || {};
  const metaName = meta?.name || meta?.full_name || meta?.fullName || '';
  const best =
    (typeof metaName === 'string' && metaName.trim()) ? metaName.trim() :
    (typeof email === 'string' && email.includes('@')) ? email.split('@')[0] :
    '';
  if (!currentName || isPlaceholderName(currentName)) {
    return best || 'Friend';
  }
  return currentName;
};

const mapProfile = (userRow: any, pointsRow?: any): KidProfile => {
  const todayPoints = pointsRow?.today_points ?? 0;
  const points = pointsRow?.total_points ?? userRow.points ?? 0;
  const weeklyPoints = pointsRow?.weekly_points ?? userRow.weeklyPoints ?? userRow.weeklypoints ?? 0;
  const monthlyPoints = pointsRow?.monthly_points ?? userRow.monthlyPoints ?? userRow.monthlypoints ?? 0;
  // Prioritize badges/level from pointsRow (users_points), fall back to userRow (users)
  const badges = pointsRow?.badges ?? userRow.badges ?? 0;
  const level = pointsRow?.level ? `Level ${pointsRow.level}` : (userRow.level || 'Beginner');

  return {
    uid: userRow.uid,
    role: userRow.role,
    name: userRow.name,
    age: userRow.age,
    madrasahName: userRow.madrasahName ?? userRow.madrasahname ?? userRow.madrasah_name,
    contactNumber: userRow.contactNumber ?? userRow.contactnumber ?? userRow.contact_number,
    email: userRow.email,
    points,
    weeklyPoints,
    monthlyPoints,
    todayPoints,
    dailyLimit: DAILY_LIMIT,
    badges,
    level,
    streak: userRow.streak || 0,
    lastStreakUpdate: userRow.last_streak_update,
    isFlagged: userRow.is_flagged || false,
    parentEmail: userRow.parent_email ?? userRow.parentEmail,
    reminderOptIn: userRow.reminder_opt_in ?? userRow.reminderOptIn ?? false,
    reminderFrequency: userRow.reminder_frequency ?? userRow.reminderFrequency ?? 'weekly',
    reminderLastSentAt: userRow.reminder_last_sent_at ?? null,
  };
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<{ id: string; email?: string | null } | null>(null);
  const [profile, setProfile] = useState<KidProfile | null>(null);
  const [loading, setLoading] = useState(true);

  // Define refreshProfile early so it can be used in effects
  const refreshProfile = useCallback(async () => {
    if (!user) return;
    
    console.log('Manually refreshing profile for:', user.id);
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .eq('uid', user.id)
      .maybeSingle();
    
    if (error) {
      console.error('Profile refresh error:', error.message);
    } else if (data) {
      const { data: pointsRow, error: pointsError } = await supabase
        .from('users_points')
        .select('total_points, weekly_points, monthly_points, today_points, badges, level')
        .eq('user_id', user.id)
        .maybeSingle();

      if (pointsError) {
        console.warn('users_points fetch error on refresh:', pointsError.message);
      }

      const mapped = mapProfile(data, pointsRow);
      const finalName = await getBestName(mapped.name, mapped.email);
      if (finalName !== mapped.name && finalName && !isPlaceholderName(finalName)) {
        const { error: updateErr } = await supabase.from('users').update({ name: finalName }).eq('uid', user.id);
        if (updateErr) {}
      }
      setProfile({ ...mapped, name: finalName });
    } else {
      console.log('No profile data found for user; ensuring default profile');
      const created = await ensureUserProfile(user.id);
      if (created) {
        const { data: refetched } = await supabase
          .from('users')
          .select('*')
          .eq('uid', user.id)
          .maybeSingle();
          
        if (refetched) {
          const { data: pointsRow, error: pointsError } = await supabase
            .from('users_points')
            .select('total_points, weekly_points, monthly_points, today_points, badges, level')
            .eq('user_id', user.id)
            .maybeSingle();

          if (pointsError) {
            console.warn('users_points fetch error after ensure:', pointsError.message);
          }

          const mapped = mapProfile(refetched, pointsRow);
          setProfile(mapped);
        }
      }
    }
  }, [user]);

  const updateLocalProfile = useCallback((updates: Partial<KidProfile>) => {
    setProfile(prev => {
      if (!prev) return null;
      return { ...prev, ...updates };
    });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const initAuth = async () => {
      try {
        // First, try to get existing session
        const { data: sessionData, error: sessionErr } = await supabase.auth.getSession();
        
        const sessionUser = sessionData.session?.user;
        const isInvalidRefresh =
          !!sessionErr?.message &&
          (sessionErr.message.includes('Refresh Token Not Found') || sessionErr.message.includes('Invalid Refresh Token'));

        if (isMounted && sessionUser) {
          // Set user but keep loading=true until profile is fetched
          setUser({ id: sessionUser.id, email: sessionUser.email });
          // loading will be set false by the profile effect after profile loads
          return;
        }

        if (isInvalidRefresh) {
          await new Promise((r) => setTimeout(r, 200));
          const { data: retryData } = await supabase.auth.getSession();
          const retryUser = retryData.session?.user;
          if (isMounted && retryUser) {
            setUser({ id: retryUser.id, email: retryUser.email });
            // loading will be set false by the profile effect after profile loads
            return;
          }
        }

        // No session; stay signed out. UI can prompt to sign in.
        if (isMounted) {
          setLoading(false);
        }
      } catch (err) {
        console.error('Auth init error:', err);
        // Leave user null on error
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    initAuth();

    // Also listen for auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      console.log('Auth event:', event, 'Session:', session?.user?.id);
      if (isMounted) {
        const u = session?.user ? { id: session.user.id, email: session.user.email } : null;
        console.log('Auth state changed:', u?.id);
        setUser(u);
        
        // If user signed in, ensure profile is loaded
        if (u && event === 'SIGNED_IN') {
          console.log('User signed in, loading profile...');
          try {
            const { data, error } = await supabase
              .from('users')
              .select('*')
              .eq('uid', u.id)
              .maybeSingle();
            
            if (error) {
              console.error('Profile load error on sign in:', error);
              // Try to create profile if it doesn't exist
              const created = await ensureUserProfile(u.id);
              if (created) {
                const { data: newData } = await supabase
                  .from('users')
                  .select('*')
                  .eq('uid', u.id)
                  .maybeSingle();
                if (newData) {
                  const { data: pointsRow, error: pointsError } = await supabase
                    .from('users_points')
                    .select('total_points, weekly_points, monthly_points, today_points, badges, level')
                    .eq('user_id', u.id)
                    .maybeSingle();
                  
                  if (pointsError) {
                    console.warn('users_points fetch error on sign in:', pointsError.message);
                  }
                  
                  const mapped = mapProfile(newData, pointsRow);
                  const finalName = await getBestName(mapped.name, mapped.email);
                  if (finalName !== mapped.name && finalName && !isPlaceholderName(finalName)) {
                    const { error: updateErr } = await supabase.from('users').update({ name: finalName }).eq('uid', u.id);
                    if (updateErr) {}
                  }
                  setProfile({ ...mapped, name: finalName });
                }
              }
            } else if (data) {
              const { data: pointsRow, error: pointsError } = await supabase
                .from('users_points')
                .select('total_points, weekly_points, monthly_points, today_points, badges, level')
                .eq('user_id', u.id)
                .maybeSingle();
              
              if (pointsError) {
                console.warn('users_points fetch error on sign in:', pointsError.message);
              }
              
              const mapped = mapProfile(data, pointsRow);
              const finalName = await getBestName(mapped.name, mapped.email);
              if (finalName !== mapped.name && finalName && !isPlaceholderName(finalName)) {
                const { error: updateErr } = await supabase.from('users').update({ name: finalName }).eq('uid', u.id);
                if (updateErr) {}
              }
              setProfile({ ...mapped, name: finalName });
            }
          } catch (err) {
            console.error('Error loading profile on sign in:', err);
          }
        } else if (!u && event === 'SIGNED_OUT') {
          setProfile(null);
        }
      }
    });

    return () => {
      isMounted = false;
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []);

  // Initial profile load
  useEffect(() => {
    (async () => {
      if (!user) {
        console.log('No user, clearing profile');
        setProfile(null);
        setLoading(false);
        return;
      }
      setLoading(true);
      // Safety timeout — never stay stuck loading for more than 5 seconds
      const safetyTimer = setTimeout(() => setLoading(false), 5000);
      try {
        await refreshProfile();
      } finally {
        clearTimeout(safetyTimer);
        setLoading(false);
      }
    })();
  }, [user, refreshProfile]);

  // Real-time subscription
  useEffect(() => {
    if (!user) return;
    
    console.log('Setting up real-time subscription for user:', user.id);
    const channel = supabase
      .channel(`user-profile-${user.id}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'users',
        filter: `uid=eq.${user.id}`,
      }, (payload: any) => {
        console.log('Real-time update received (users):', payload);
        refreshProfile();
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'users_points',
        filter: `user_id=eq.${user.id}`,
      }, (payload: any) => {
        console.log('Real-time update received (users_points):', payload);
        refreshProfile();
      })
      .subscribe();
    
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refreshProfile]);

  // Re-fetch on window focus (vital for mobile app state consistency) - with debounce
  useEffect(() => {
    let debounceTimer: NodeJS.Timeout | null = null;
    
    const handleFocus = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        if (user) {
          console.log('Window focused, refreshing profile...');
          refreshProfile();
        }
      }, 1000); // 1 second debounce
    };

    const handleVisibilityChange = () => {
      if (!user) return;
      if (document.visibilityState === 'visible') {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          console.log('Tab visible, refreshing profile...');
          refreshProfile();
        }, 1000); // 1 second debounce
      }
    };

    const handleOnline = () => {
      if (!user) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        console.log('Network reconnected, refreshing profile...');
        refreshProfile();
      }, 1000); // 1 second debounce
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('online', handleOnline);
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [user, refreshProfile]);

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    logout: async () => {
      try {
        console.log('🔓 Starting logout process...');
        
        // Clear state immediately for faster UI feedback
        setUser(null);
        setProfile(null);
        
        // Sign out from Supabase auth
        try {
          const { error } = await supabase.auth.signOut({ scope: 'local' });
          if (error) {
            console.warn('⚠️ Supabase signOut had issues:', error.message);
          } else {
            console.log('✅ Supabase auth cleared');
          }
        } catch (supabaseErr) {
          console.error('❌ Supabase signOut error:', supabaseErr);
        }

        // Clear all storage
        try {
          mobileAuthHelper.clearAllStorage();
          console.log('✅ Storage cleared');
        } catch (storageErr) {
          console.error('❌ Storage clear error:', storageErr);
        }

        // Redirect to signin
        console.log('🔄 Redirecting to signin...');
        if (typeof window !== 'undefined') {
          // Small delay to ensure state is cleared before redirect
          setTimeout(() => {
            window.location.href = '/signin';
          }, 100);
        }
      } catch (err) {
        console.error('🚨 Logout exception:', err);
        
        // Fallback: force clear everything and redirect
        try {
          setUser(null);
          setProfile(null);
          mobileAuthHelper.clearAllStorage();
          await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
        } catch {}
        
        if (typeof window !== 'undefined') {
          window.location.href = '/signin';
        }
      }
    },
    refreshProfile,
    updateLocalProfile,
  }), [user, profile, loading, refreshProfile, updateLocalProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
