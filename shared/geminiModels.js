// Shared by the installed app and Express. Never persist or log API credentials.
const CURRENT_MODELS = ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'];
const CURRENT_MODEL_SET = new Set(CURRENT_MODELS);
const FALLBACK_MODELS = ['gemini-3.7-flash', 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.5-flash-lite'];
const cache = new Map();
const TTL = 10 * 60 * 1000;
function normalizeModel(value) {
  return typeof value === 'string' && CURRENT_MODEL_SET.has(value) ? value : 'auto';
}
function compareModels(a, b) {
  const preview = id => /preview|experimental|(?:^|-)exp(?:-|$)/.test(id) ? 1 : 0;
  const family = id => /flash(?!-lite)/.test(id) ? 0 : /flash-lite/.test(id) ? 1 : 2;
  return preview(a.id) - preview(b.id) || family(a.id) - family(b.id) || b.id.localeCompare(a.id, 'en', { numeric: true });
}
async function listGeminiModels(apiKey, force = false) {
  if (!apiKey) throw new Error('MODEL_KEY_REQUIRED');
  const existing = cache.get(apiKey);
  if (existing?.flight) return existing.flight;
  if (!force && existing?.models && Date.now() - existing.time < TTL) return existing.models;
  const entry = { models: existing?.models, allModels: existing?.allModels, time: existing?.time || 0, preferred: undefined, flight: undefined };
  const flight = (async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    try {
      const models = new Map(); const seenTokens = new Set(); let token = '';
      do {
        const query = new URLSearchParams({ pageSize: '1000' });
        if (token) query.set('pageToken', token);
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?${query}`, { headers: { 'x-goog-api-key': apiKey }, signal: controller.signal });
        if (!response.ok) throw new Error('MODEL_LIST_FAILED');
        const data = await response.json();
        if (!Array.isArray(data.models)) throw new Error('MODEL_LIST_FAILED');
        for (const model of data.models) {
          const id = typeof model.name === 'string' ? model.name.replace(/^models\//, '') : '';
          if (!/^gemini-[a-z0-9][a-z0-9._-]{0,119}$/.test(id) || !Array.isArray(model.supportedGenerationMethods) || !model.supportedGenerationMethods.includes('generateContent')) continue;
          // Image/audio/live and task-specific models cannot serve this text conversation UI.
          if (/image|vision|tts|audio|live|embedding|robotics|computer-use|deep-research|nano-banana/.test(id)) continue;
          models.set(id, { id, label: typeof model.displayName === 'string' ? model.displayName : id });
        }
        token = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
        if (token && seenTokens.has(token)) throw new Error('MODEL_LIST_FAILED');
        seenTokens.add(token);
      } while (token);
      entry.allModels = [...models.values()].sort(compareModels);
      entry.models = CURRENT_MODELS.flatMap(id => models.has(id) ? [models.get(id)] : []); entry.time = Date.now();
      return entry.models;
    } finally { clearTimeout(timer); }
  })();
  entry.flight = flight; cache.set(apiKey, entry);
  // Limit retained in-memory key-scoped metadata on a long-running server.
  if (cache.size > 100) cache.delete(cache.keys().next().value);
  try { return await flight; } finally { entry.flight = undefined; }
}
async function modelOrder(apiKey, selection = 'auto', force = false) {
  const chosen = normalizeModel(selection);
  if (chosen !== 'auto') return [chosen];
  let models;
  try {
    await listGeminiModels(apiKey, force);
    models = cache.get(apiKey)?.allModels || [];
  }
  catch { return [...FALLBACK_MODELS]; }
  // Automatic mode stays in the Flash family; Pro remains an explicit choice.
  const order = models.filter(model => model.id.includes('flash')).map(model => model.id);
  const preferred = cache.get(apiKey)?.preferred;
  return preferred && order.includes(preferred) ? [preferred, ...order.filter(id => id !== preferred)] : order;
}
function rememberModel(apiKey, model) { const entry = cache.get(apiKey); if (entry) entry.preferred = model; }
function canFallback(status) { return [404, 410, 429, 503].includes(status); }
module.exports = { normalizeModel, listGeminiModels, modelOrder, rememberModel, canFallback };
