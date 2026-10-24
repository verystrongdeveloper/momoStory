import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, Platform } from 'react-native';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { StoryRecord } from '@/storage/types';
import assets from '@/shared/community/assets.json';
import { validatePublicStory, validateComment } from '@/shared/community/validation';

export type RankingPeriod = 'all' | 'day' | 'week' | 'month' | 'year';
export type CommunityPost = { id: string; title: string; character: string; preview_bg?: string | null; created_at: string; likes: number; period_likes?: number; views: number; comment_count: number; liked: boolean; is_mine: boolean };
export type CommunityComment = { id: string; body: string; created_at: string; is_mine: boolean };
export type CommunityDetail = Omit<CommunityPost, 'comment_count'> & { script: string; chat_messages: NonNullable<StoryRecord['chatMessages']>; comments: CommunityComment[] };
export class CommunityError extends Error {
  constructor(public code: string, public line?: number) { super(code); }
}
const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim() ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ?? '';
export const communityConfigured = () => /^https:\/\/[a-z0-9.-]+(?::\d+)?$/i.test(url) && !!key;
let instance: SupabaseClient | undefined;
let sessionFlight: Promise<string> | undefined;

async function timedFetch(input: RequestInfo | URL, init?: RequestInit) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  const abort = () => controller.abort();
  init?.signal?.addEventListener('abort', abort, { once: true });
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timer); init?.signal?.removeEventListener('abort', abort); }
}
function client() {
  if (!communityConfigured()) throw new CommunityError('NOT_CONFIGURED');
  if (!instance) {
    instance = createClient(url, key, {
      auth: { storage: Platform.OS === 'web' ? undefined : AsyncStorage, storageKey: 'momo.community.session', persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
      global: { fetch: timedFetch },
    });
    if (Platform.OS !== 'web') {
      const auth = instance.auth;
      AppState.addEventListener('change', state => state === 'active' ? auth.startAutoRefresh() : auth.stopAutoRefresh());
      if (AppState.currentState === 'active') auth.startAutoRefresh();
    }
  }
  return instance;
}
async function token() {
  if (!sessionFlight) {
    sessionFlight = (async () => {
      const { data, error } = await client().auth.getSession();
      if (error) throw new CommunityError('AUTH_FAILED');
      if (data.session) return data.session.access_token;
      const result = await client().auth.signInAnonymously();
      if (result.error || !result.data.session) throw new CommunityError('AUTH_FAILED');
      return result.data.session.access_token;
    })().finally(() => { sessionFlight = undefined; });
  }
  return sessionFlight;
}
async function call<T>(action: string, data: Record<string, unknown>): Promise<T> {
  try {
    const accessToken = await token();
    const response = await timedFetch(`${url}/functions/v1/community`, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ action, data }) });
    const result = await response.json();
    if (!response.ok || result.error) throw new CommunityError(result.error ?? 'SERVER_ERROR', result.line);
    return result.data as T;
  } catch (error) {
    if (error instanceof CommunityError) throw error;
    throw new CommunityError('NETWORK_ERROR');
  }
}
export const community = {
  list: (options: { liked: boolean; query: string; character?: string; sort: 'latest' | 'popular'; period?: RankingPeriod; offset: number }) => call<CommunityPost[]>('list', options),
  page: (options: { liked: boolean; query: string; character?: string; sort: 'latest' | 'popular'; period?: RankingPeriod; offset: number }) => call<{ posts: CommunityPost[]; total: number }>('list', { ...options, pagination: true }),
  detail: (id: string, offset = 0) => call<CommunityDetail>('detail', { id, offset }),
  publish: (story: StoryRecord) => {
    const clean = validatePublicStory({ title: story.title, character: story.character, script: story.script, chatMessages: story.chatMessages ?? [], clientId: story.id }, assets);
    return call<{ id: string; alreadyPublished?: boolean; updated?: boolean }>('publish', { ...clean });
  },
  comment: (id: string, text: string) => call('comment', { id, body: validateComment(text) }),
  like: (id: string, liked: boolean) => call('like', { id, liked }),
  view: (id: string) => call('view', { id }),
  deletePost: (id: string) => call('deletePost', { id }),
  deleteComment: (id: string, commentId: string) => call('deleteComment', { id, commentId }),
  report: (id: string) => call('report', { id }),
};
export function communityStory(detail: CommunityDetail): StoryRecord {
  return { id: `community-${detail.id}`, title: detail.title, character: detail.character, script: detail.script, chatMessages: detail.chat_messages, createdAt: new Date(detail.created_at).getTime() };
}
export function communityErrorKey(error: unknown) {
  const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
  if (code === 'NOT_CONFIGURED') return 'communitySetup';
  if (code === 'RATE_LIMIT') return 'communityRateLimit';
  if (code === 'INVALID_COMMENT') return 'communityCommentLimit';
  if (code === 'NOT_FOUND') return 'communityNotFound';
  if (code === 'AUTH_FAILED' || code === 'UNAUTHORIZED') return 'communityAuthFailed';
  if (code.startsWith('INVALID_') || code === 'STORY_TOO_LONG' || code === 'MISSING_END') return 'communityInvalidStory';
  return 'communityFailed';
}
