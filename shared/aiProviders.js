// Provider-qualified selections share the existing model preference. Legacy Gemini values stay valid.
const providers = ['gemini', 'openrouter', 'venice'];
const endpoints = { openrouter: 'https://openrouter.ai/api/v1', venice: 'https://api.venice.ai/api/v1' };
function parseSelection(value) {
  const match = typeof value === 'string' && /^(openrouter|venice):([a-zA-Z0-9][a-zA-Z0-9._/:+-]{0,199})$/.exec(value);
  return match ? { provider: match[1], model: match[2] } : { provider: 'gemini', model: typeof value === 'string' ? value : 'auto' };
}
function qualifyModel(provider, model) { return provider === 'gemini' ? model : `${provider}:${model}`; }
function readProviderKeys(raw) {
  try {
    const data = JSON.parse(raw);
    if (data?.format === 'momo-provider-keys-v1') return Object.fromEntries(providers.map(provider => [provider, typeof data[provider] === 'string' ? data[provider] : '']));
  } catch { /* Existing installations store a plain Gemini key. */ }
  return { gemini: raw, openrouter: '', venice: '' };
}
async function listProviderModels(provider, apiKey, signal) {
  if (!endpoints[provider]) throw new Error('UNKNOWN_PROVIDER');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 15000);
  try {
    const response = await fetch(`${endpoints[provider]}/models${provider === 'venice' ? '?type=text' : ''}`, {
      headers: { Authorization: `Bearer ${apiKey}` }, signal: controller.signal,
    });
    if (!response.ok) throw new Error(`MODEL_LIST_FAILED (${response.status})`);
    const data = await response.json();
    if (!Array.isArray(data.data)) throw new Error('MODEL_LIST_FAILED');
    return data.data.filter(row => {
      if (typeof row.id !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._/:+-]{0,199}$/.test(row.id)) return false;
      if (provider === 'venice') return !row.type || row.type === 'text';
      return row.architecture?.output_modalities?.includes('text') && !row.id.endsWith(':batch');
    }).map(row => ({ id: row.id, label: row.name || row.id, free: provider === 'openrouter' && row.pricing?.prompt === '0' && row.pricing?.completion === '0' }))
      .sort((a, b) => Number(b.free) - Number(a.free) || a.label.localeCompare(b.label));
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', abort); }
}
module.exports = { providers, endpoints, parseSelection, qualifyModel, readProviderKeys, listProviderModels };
