import { CommunityValidationError, validateComment, validatePublicStory } from '../../../shared/community/validation.ts';
import type { AssetManifest } from '../../../shared/community/validation.ts';

export type Dependencies = {
  authenticate: (token: string) => Promise<string | null>;
  rpc: (actor: string, action: string, data: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
  assets: AssetManifest;
};
const headers = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info', 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const actions = new Set(['list', 'detail', 'publish', 'comment', 'like', 'view', 'deletePost', 'deleteComment', 'report']);
function response(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers }); }

async function readBody(request: Request): Promise<unknown> {
  if (Number(request.headers.get('content-length')) > 350_000 || !request.body) throw new CommunityValidationError('STORY_TOO_LONG');
  const reader = request.body.getReader(); const decoder = new TextDecoder();
  let text = '', bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read(); if (done) break;
      bytes += value.byteLength;
      if (bytes > 350_000) { await reader.cancel(); throw new CommunityValidationError('STORY_TOO_LONG'); }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally { reader.releaseLock(); }
}

export function createCommunityHandler(deps: Dependencies) {
  return async (request: Request): Promise<Response> => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
    if (request.method !== 'POST') return response({ error: 'METHOD_NOT_ALLOWED' }, 405);
    try {
      const token = request.headers.get('authorization')?.match(/^Bearer\s+(\S+)$/i)?.[1];
      if (!token || token.length > 8_192) return response({ error: 'UNAUTHORIZED' }, 401);
      // Verify against Auth, not merely a decoded JWT or user-supplied actor ID.
      const actor = await deps.authenticate(token);
      if (!actor) return response({ error: 'UNAUTHORIZED' }, 401);
      const body = await readBody(request) as { action?: unknown; data?: unknown };
      if (!body || typeof body !== 'object' || typeof body.action !== 'string' || !actions.has(body.action) || !body.data || typeof body.data !== 'object' || Array.isArray(body.data)) return response({ error: 'INVALID_REQUEST' }, 400);
      const raw = body.data as Record<string, unknown>;
      let data: Record<string, unknown> = {};
      if (body.action === 'publish') data = { ...validatePublicStory(raw, deps.assets) };
      else if (body.action === 'list') {
        if (raw.query !== undefined && (typeof raw.query !== 'string' || raw.query.length > 100)) return response({ error: 'INVALID_REQUEST' }, 400);
        if (raw.character !== undefined && (typeof raw.character !== 'string' || raw.character.length > 100)) return response({ error: 'INVALID_REQUEST' }, 400);
        if (raw.pagination !== undefined && typeof raw.pagination !== 'boolean') return response({ error: 'INVALID_REQUEST' }, 400);
        if (raw.liked !== undefined && typeof raw.liked !== 'boolean') return response({ error: 'INVALID_REQUEST' }, 400);
        if (raw.mine !== undefined && typeof raw.mine !== 'boolean') return response({ error: 'INVALID_REQUEST' }, 400);
        if (raw.period !== undefined && (typeof raw.period !== 'string' || !['all', 'day', 'week', 'month', 'year'].includes(raw.period))) return response({ error: 'INVALID_REQUEST' }, 400);
        data = { pagination: raw.pagination === true, query: raw.query ?? '', character: typeof raw.character === 'string' ? raw.character.trim() : '', liked: raw.liked === true, mine: raw.mine === true, sort: raw.sort === 'popular' ? 'popular' : 'latest', period: raw.period ?? 'all' };
      } else {
        if (typeof raw.id !== 'string' || !uuid.test(raw.id)) return response({ error: 'INVALID_REQUEST' }, 400);
        data.id = raw.id;
        if (body.action === 'comment') data.body = validateComment(raw.body);
        if (body.action === 'like') {
          if (typeof raw.liked !== 'boolean') return response({ error: 'INVALID_REQUEST' }, 400);
          data.liked = raw.liked;
        }
        if (body.action === 'deleteComment') {
          if (typeof raw.commentId !== 'string' || !uuid.test(raw.commentId)) return response({ error: 'INVALID_REQUEST' }, 400);
          data.commentId = raw.commentId;
        }
      }
      if (body.action === 'list' || body.action === 'detail') {
        if (raw.offset !== undefined && (!Number.isInteger(raw.offset) || Number(raw.offset) < 0 || Number(raw.offset) > 10000)) return response({ error: 'INVALID_REQUEST' }, 400);
        data.offset = raw.offset ?? 0;
      }
      const result = await deps.rpc(actor, body.action, data);
      if (result.error) {
        const code = result.error.message.includes('RATE_LIMIT') ? 'RATE_LIMIT' : result.error.message.includes('NOT_FOUND') || result.error.message.includes('foreign key') ? 'NOT_FOUND' : 'SERVER_ERROR';
        return response({ error: code }, code === 'RATE_LIMIT' ? 429 : code === 'NOT_FOUND' ? 404 : 500);
      }
      return response({ data: result.data });
    } catch (error) {
      if (error instanceof CommunityValidationError) return response({ error: error.code, line: error.line }, 400);
      if (error instanceof SyntaxError) return response({ error: 'INVALID_REQUEST' }, 400);
      return response({ error: 'SERVER_ERROR' }, 500);
    }
  };
}
