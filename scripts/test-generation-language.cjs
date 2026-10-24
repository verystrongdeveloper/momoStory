const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
function load(file, mocks = {}, globals = {}) {
  const absolute = path.join(root, file);
  const localRequire = createRequire(absolute);
  const module = { exports: {} };
  const source = fs.readFileSync(absolute, 'utf8');
  const code = file.endsWith('.ts') ? ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
  }).outputText : source;
  new Function('require', 'module', 'exports', ...Object.keys(globals), code)(
    id => Object.hasOwn(mocks, id) ? mocks[id] : id === '../senseiMode' ? { getSenseiMode: () => 'mild' } : localRequire(id), module, module.exports, ...Object.values(globals));
  return module.exports;
}
const modelPolicy = { ...require('../shared/geminiModels'), normalizeModel: value => typeof value === 'string' && value.startsWith('gemini-test-') ? value : 'auto', modelOrder: async (_key, selection = 'auto') => selection === 'auto' ? ['gemini-test-flash', 'gemini-test-flash-lite'] : [selection], rememberModel() {} };
const { normalizeGenerationLanguage, withGenerationLanguage } = require('../shared/prompts/generationLanguage');
const languages = { ko: 'Korean', en: 'English', ja: 'Japanese', zh: 'Simplified Chinese' };
const names = { ko: '호시노', en: 'Hoshino', ja: 'ホシノ', zh: '星野' };
const content = { ko: '안녕', en: 'Hello', ja: 'こんにちは', zh: '你好' };
function output(instruction) {
  const code = Object.keys(languages).find(code => instruction.includes(`OUTPUT LANGUAGE: ${languages[code]}.`));
  assert.ok(code, 'Every request needs an explicit output language');
  if (instruction.includes('Write direction and reason')) return JSON.stringify({ characters: [], direction: content[code] });
  if (instruction.includes('Write the story title')) return `타이틀 : ${content[code]}\n호시노 : ${content[code]} [emotion : hoshino_smile.png]\nselection : (1)"${content[code]}"\nendEvent`;
  return content[code];
}
(async () => {
  const { splitChatReply } = load('utils/splitChatReply.ts');
  const { keepAssetSpeakers } = require('../shared/prompts/characterList');
  const { canonicalCharacterName, localizeStoryScript } = require('../shared/prompts/speakerNames');
  const parseScript = load('utils/parseEventScript.ts').default;
  const { insertAssetIntoScript } = load('utils/insertStoryAsset.ts');
  let stories = [];
  const library = load('store/storyLibrary.ts', { '@/storage': {
    loadStories: () => stories, saveStories: value => { stories = value; }, subscribeStorage() {},
  } });
  const departments = { ko: '대책위원회', en: 'Foreclosure Task Force', ja: '対策委員会', zh: '对策委员会' };
  for (const code of Object.keys(languages)) {
    const script = keepAssetSpeakers('타이틀 : 호시노\n호시노(대책위원회) : 호시노! [emotion : hoshino_smile.png, bg : BG_AbydosCouncilRoom.jpg, expression : Heart.png, music : Aira.mp3]\nselection : (1)"호시노" [speaker : 호시노, emotion : hoshino_smile.png]\nUnknown : excluded\nendEvent', ['호시노'], code);
    assert.ok(script.includes(`${names[code]}(${departments[code]}) : ${names[code]}!`));
    assert.ok(script.includes('[emotion : hoshino_smile.png, bg : BG_AbydosCouncilRoom.jpg, expression : Heart.png, music : Aira.mp3]'));
    assert.equal(script.includes('Unknown'), false);
    const lines = parseScript(script);
    assert.equal(lines[0].type, '타이틀');
    assert.equal(lines[0].text, names[code]);
    assert.equal(lines[1].character, `${names[code]}(${departments[code]})`);
    assert.equal(lines[2].character, names[code]);
    assert.equal(canonicalCharacterName(names[code]), '호시노');
    assert.ok(keepAssetSpeakers(`${names[code]} : hello`, ['호시노']).includes('hello'));
    assert.ok(localizeStoryScript(`${names[code]} : hello`, code).includes(`${names[code]} : hello`));
  }
  for (const prefix of ['타이틀 :', 'title :', 'TITLE：']) {
    const script = `${prefix} Test\nホシノ(対策委員会) : Hi\nendEvent`;
    assert.deepEqual(parseScript(script)[0], { type: '타이틀', text: 'Test' });
    const saved = library.importStory(script);
    assert.equal(saved.title, 'Test');
    assert.equal(saved.character, '호시노');
    assert.equal(library.updateStory(saved.id, `${prefix} Updated\nHoshino : hi`).title, 'Updated');
    const title = `${prefix} Test []`;
    assert.equal(insertAssetIntoScript(title, title.length - 1, 'bg', 'BG_Test.jpg').ok, false);
  }
  assert.deepEqual(splitChatReply('안녕. 선생!'), ['안녕.', '선생!']);
  assert.deepEqual(splitChatReply('Hello. Sensei!'), ['Hello.', 'Sensei!']);
  assert.deepEqual(splitChatReply('こんにちは。先生！元気？'), ['こんにちは。', '先生！', '元気？']);
  assert.deepEqual(splitChatReply('你好。老师！今天好吗？'), ['你好。', '老师！', '今天好吗？']);
  for (const bad of [undefined, null, {}, '__proto__', 'constructor', 'xx']) assert.equal(normalizeGenerationLanguage(bad), 'ko');
  for (const [code, name] of Object.entries(languages)) {
    for (const mode of ['chat', 'select', 'event']) {
      const prompt = withGenerationLanguage('persona remains', code, mode);
      assert.ok(prompt.startsWith('persona remains'));
      assert.ok(prompt.includes(`OUTPUT LANGUAGE: ${name}.`));
      if (mode === 'event') assert.ok(prompt.includes('타이틀, narration, selection, deleteEmotion, deleteAll, waitSecond, endEvent'));
    }
  }
  let selected = 'ko';
  const requests = [];
  const rest = load('services/geminiClient/rest.ts', { './errors': { throwIfOffline() {} }, '../geminiModel': { getGeminiModel: () => 'auto' }, '../../shared/geminiModels': modelPolicy }, {
    fetch: async (_url, options) => {
      const body = JSON.parse(options.body); requests.push(body);
      return { ok: true, text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: output(body.systemInstruction.parts[0].text) }] } }] }) };
    },
  });
  const direct = load('services/geminiClient/directClient.ts', {
    '../geminiModel': { getGeminiModel: () => 'auto' },
    '@/services/geminiKey': { getGeminiKey: () => 'test-only-key' },
    '@/services/appLanguage': { getAppLanguage: () => selected }, './rest': rest,
  }).directClient;
  for (const code of Object.keys(languages)) {
    selected = code;
    assert.equal((await direct.trigger('호시노')).triggerLine, content[code]);
    await direct.chat('호시노', '한국어 입력이어도 설정 언어로');
    assert.equal((await direct.chat('호시노', 'continue')).reply, content[code]);
    await direct.chat('호시노', 'third pair');
    const script = (await direct.createEvent('호시노')).eventScript;
    assert.ok(script.includes(`${code === 'ko' ? '타이틀' : 'title'} : ${content[code]}`));
    assert.ok(script.includes(`${names[code]} : ${content[code]}`));
    assert.ok(script.includes('emotion : hoshino_smile.png'));
    assert.ok(script.includes('endEvent'));
  }
  assert.ok(requests[6].contents.length > 1, 'Language change retains direct conversation history');
  await direct.chat('히나', 'keep other character');
  await rest.sendWithFallback('호시노', '', 'keep other key', undefined, 'other-key', 'en');
  await direct.reset('호시노');
  await assert.rejects(direct.createEvent('호시노'), /dialogHistory/);
  assert.equal((await direct.chat('호시노', 'fresh start')).eventReady, true);
  assert.equal(requests.at(-1).contents.length, 1, 'direct reset clears model history');
  await direct.chat('히나', 'continue other character');
  assert.equal(requests.at(-1).contents.length, 3, 'other characters keep their model history');
  await rest.sendWithFallback('호시노', '', 'continue other key', undefined, 'other-key', 'en');
  assert.equal(requests.at(-1).contents.length, 3, 'other API keys keep their model history');
  let attempt = 0;
  const fallbackRequests = [];
  const retryRest = load('services/geminiClient/rest.ts', { './errors': { throwIfOffline() {} }, '../geminiModel': { getGeminiModel: () => 'auto' }, '../../shared/geminiModels': modelPolicy }, {
    fetch: async (_url, options) => {
      const body = JSON.parse(options.body); fallbackRequests.push(body);
      if (attempt++ === 0) return { ok: false, status: 503, text: async () => '{"error":{"message":"busy"}}' };
      return { ok: true, text: async () => JSON.stringify({ candidates: [{ content: { parts: [{ text: output(body.systemInstruction.parts[0].text) }] } }] }) };
    },
  });
  assert.equal(await retryRest.sendWithFallback('호시노', '', 'hello', undefined, 'test-only-key', 'ja'), content.ja);
  assert.equal(fallbackRequests.length, 2);
  assert.ok(fallbackRequests.every(request => request.systemInstruction.parts[0].text.includes('OUTPUT LANGUAGE: Japanese.')));
  await direct.trigger('room-test', 'chat');
  for (let i = 0; i < 5; i++) assert.equal((await direct.chat('room-test', `general ${i}`, 'chat')).eventReady, false);
  await direct.trigger('room-test', 'bond');
  assert.equal(requests.at(-1).contents.length, 1, 'direct rooms have separate AI histories');
  for (let i = 0; i < 3; i++) assert.equal((await direct.chat('room-test', `bond ${i}`, 'bond')).eventReady, true, 'one completed user dialogue pair enables generation');
  await direct.reset('room-test', 'bond');
  await direct.chat('room-test', 'continue general', 'chat');
  assert.equal(requests.at(-1).contents.length, 13, 'bond reset preserves general chat history');
  // One generation keeps its initial language even if settings change during selection.
  const snapshots = [];
  selected = 'en';
  const snapshot = load('services/geminiClient/directClient.ts', {
    '../geminiModel': { getGeminiModel: () => 'auto' },
    '@/services/geminiKey': { getGeminiKey: () => 'snapshot-key' },
    '@/services/appLanguage': { getAppLanguage: () => selected },
    './rest': { ...rest, sendWithFallback: async (_char, session, _message, _system, _key, language) => {
      snapshots.push(language);
      if (session === 'select') { selected = 'ja'; return '{"characters":[],"direction":"continue"}'; }
      return session === 'event' ? '타이틀 : Hello\n호시노 : Hello\nendEvent' : 'Hello';
    } },
  }).directClient;
  await snapshot.trigger('호시노'); await snapshot.chat('호시노', 'a'); await snapshot.chat('호시노', 'b'); await snapshot.chat('호시노', 'c'); await snapshot.createEvent('호시노');
  assert.deepEqual(snapshots, ['en', 'en', 'en', 'en', 'en', 'en']);

  const transportCalls = [];
  const transport = load('services/geminiClient/expressTransport.ts', {
    '../geminiModel': { getGeminiModel: () => 'auto' },
    '@/services/geminiKey': { getGeminiKey: () => 'test-only-key' },
    '@/services/appLanguage': { getAppLanguage: () => selected }, './errors': { throwIfOffline() {} },
  }, { fetch: async (_url, options) => { transportCalls.push(JSON.parse(options.body)); return { ok: true, json: async () => ({}) }; } }).expressTransport;
  for (const code of Object.keys(languages)) {
    selected = code;
    await transport.trigger('호시노'); await transport.chat('호시노', 'hi'); await transport.createEvent('호시노');
    assert.ok(transportCalls.slice(-3).every(body => body.language === code));
  }
  await transport.reset('호시노');
  assert.equal(transportCalls.at(-1).character, '호시노');
  assert.equal(transportCalls.at(-1).apiKey, 'test-only-key');

  const models = [], sdkRequests = [], sdkMessages = [];
  class FakeSDK {
    getGenerativeModel(options) {
      assert.equal(options.model, 'gemini-test-pro', 'Express greeting, chat, selection and script honor the selected model');
      return { startChat({ history }) {
        models.push({ instruction: options.systemInstruction, history: [...history] });
        const log = [...history];
        return {
          getHistory: async () => log,
          sendMessage: async message => {
            sdkRequests.push(options.systemInstruction); sdkMessages.push(message);
            const text = output(options.systemInstruction);
            log.push({ role: 'user', parts: [{ text: message }] }, { role: 'model', parts: [{ text }] });
            return { response: { text: () => text } };
          },
        };
      } };
    }
  }
  const service = load('server/src/services/geminiService.js', { '@google/generative-ai': { GoogleGenerativeAI: FakeSDK }, '../../../shared/geminiModels': modelPolicy });
  const chat = load('server/src/controllers/chatController.js', { '../services/geminiService': service });
  const controllerMocks = { '../services/geminiService': service, './chatController': chat };
  const trigger = load('server/src/controllers/triggerController.js', controllerMocks);
  const event = load('server/src/controllers/eventController.js', controllerMocks);
  async function invoke(handler, language, extra = {}) {
    let status = 200, data;
    const response = { status(value) { status = value; return this; }, json(value) { data = value; return this; } };
    await handler({ body: { character: '호시노', apiKey: 'test-only-key', model: 'gemini-test-pro', language, ...extra } }, response);
    assert.equal(status, 200); return data;
  }
  for (const code of Object.keys(languages)) {
    assert.equal((await invoke(trigger.sendTrigger, code)).triggerLine, content[code]);
    await invoke(chat.sendChat, code, { message: 'one' });
    assert.equal((await invoke(chat.sendChat, code, { message: 'two' })).reply, content[code]);
    await invoke(chat.sendChat, code, { message: 'three' });
    const result = await invoke(event.createEvent, code);
    assert.ok(result.eventScript.includes(`${names[code]} : ${content[code]}`));
    assert.ok(result.eventScript.includes(`${code === 'ko' ? '타이틀' : 'title'} : ${content[code]}`));
  }
  assert.ok(models.some(model => model.instruction.includes('OUTPUT LANGUAGE: English.') && model.history.length >= 6), 'SDK language switch keeps history');
  const fallback = await invoke(chat.sendChat, 'invalid', { message: 'continue' });
  assert.equal(fallback.reply, content.ko);
  await invoke(chat.sendChat, 'en', { character: '히나', message: 'keep other character' });
  await invoke(chat.sendChat, 'en', { apiKey: 'other-key', message: 'keep other key' });
  assert.deepEqual(await invoke(chat.resetChat, 'en'), { ok: true });
  assert.deepEqual(chat.getDialogHistory('호시노', 'test-only-key'), []);
  assert.equal(chat.getDialogHistory('히나', 'test-only-key').length, 1);
  assert.equal(chat.getDialogHistory('호시노', 'other-key').length, 1);
  assert.equal((await invoke(chat.sendChat, 'en', { message: 'fresh start' })).eventReady, true);
  assert.equal(models.at(-1).history.length, 0, 'Express reset clears cached SDK sessions');
  await invoke(trigger.sendTrigger, 'en', { character: 'room-test', room: 'chat' });
  for (let i = 0; i < 5; i++) assert.equal((await invoke(chat.sendChat, 'en', { character: 'room-test', room: 'chat', message: `general ${i}` })).eventReady, false);
  await invoke(trigger.sendTrigger, 'en', { character: 'room-test', room: 'bond' });
  assert.equal(models.at(-1).history.length, 0, 'Express rooms have separate AI histories');
  for (let i = 0; i < 3; i++) assert.equal((await invoke(chat.sendChat, 'en', { character: 'room-test', room: 'bond', message: `bond ${i}` })).eventReady, true);
  await invoke(chat.resetChat, 'en', { character: 'room-test', room: 'bond' });
  const modelCount = models.length;
  await invoke(chat.sendChat, 'en', { character: 'room-test', room: 'chat', message: 'continue general' });
  assert.equal(models.length, modelCount, 'bond reset preserves the general SDK session');
  assert.deepEqual(chat.getDialogHistory('room-test', 'test-only-key'), []);
  const roomContext = { id: 'saved-room-1', messages: Array.from({ length: 10 }, (_, i) => [
    { sender: 'user', text: 'saved question ' + i }, { sender: 'character', text: 'saved reply ' + i },
  ]).flat(), scripts: ['title : Prior episode\n호시노 : remembered event\nendEvent'] };
  selected = 'en';
  await direct.chat('호시노', 'resume persisted room', 'bond', roomContext);
  const restoredDirect = JSON.stringify(requests.at(-1).contents);
  assert.ok(restoredDirect.includes('remembered event') && restoredDirect.includes('saved question 0') && restoredDirect.includes('saved reply 9'));
  await direct.createEvent('호시노', roomContext);
  assert.ok(requests.at(-1).contents.at(-1).parts[0].text.includes('remembered event'), 'direct story continuation includes previous episodes');
  await transport.chat('호시노', 'resume', 'bond', roomContext);
  assert.deepEqual(transportCalls.at(-1).context, roomContext);
  await transport.createEvent('호시노', roomContext);
  assert.deepEqual(transportCalls.at(-1).context, roomContext);
  await invoke(chat.sendChat, 'en', { context: roomContext, message: 'resume room after server restart' });
  const restoredSDK = JSON.stringify(models.at(-1).history);
  assert.ok(restoredSDK.includes('remembered event') && restoredSDK.includes('saved question 0') && restoredSDK.includes('saved reply 9'));
  await invoke(event.createEvent, 'en', { context: roomContext });
  assert.ok(sdkMessages.at(-1).includes('remembered event') && sdkMessages.at(-1).includes('saved question 0'), 'Express story uses persisted conversation and prior episodes');
  const anotherRoom = { id: 'saved-room-2', messages: [{ sender: 'user', text: 'other room' }, { sender: 'character', text: 'other answer' }], scripts: [] };
  await invoke(chat.sendChat, 'en', { context: anotherRoom, message: 'independent room' });
  assert.equal(JSON.stringify(models.at(-1).history).includes('remembered event'), false, 'rooms for the same character never share restored history');
  console.log('PASS ko/en/ja/zh: direct + Express greeting/chat/selection/story, mid-generation snapshot, language switching with history, invalid default, canonical script/asset preservation (mocked Gemini, no paid API calls)');
})().catch(error => { console.error(error); process.exitCode = 1; });
