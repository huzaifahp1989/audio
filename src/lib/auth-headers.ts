import { supabase } from '@/lib/supabase';

export async function getAuthFetchHeaders(extra?: Record<string, string>): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return {
    ...(extra || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export type AuthJsonFetchOptions = RequestInit & {
  /** Abort the request after this many milliseconds (default 25s). */
  timeoutMs?: number;
};

export async function authJsonFetch(url: string, init: AuthJsonFetchOptions = {}): Promise<Response> {
  const { timeoutMs = 25_000, ...fetchInit } = init;
  const headers = await getAuthFetchHeaders({
    'Content-Type': 'application/json',
    ...(fetchInit.headers as Record<string, string> | undefined),
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...fetchInit, headers, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
