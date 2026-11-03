const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
function load(file, mocks = {}) {
  const absolute = path.resolve(__dirname, '..', file), req = createRequire(absolute), mod = { exports: {} };
  const source = fs.readFileSync(absolute, 'utf8');
  const code = file.endsWith('.js') ? source : ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(id => Object.hasOwn(mocks, id) ? mocks[id] : id.startsWith('.') && fs.existsSync(path.resolve(path.dirname(absolute), id + '.ts')) ? load(path.relative(path.resolve(__dirname, '..'), path.resolve(path.dirname(absolute), id + '.ts')), mocks) : req(id), mod, mod.exports);
  return mod.exports;
}
(async () => {
  const images = require('../shared/chatImages');
  const image = { mimeType: 'image/png', data: 'aGVsbG8=' };
  assert.deepEqual(images.messageParts('', [image]), [{ inlineData: image }]);
  assert.throws(() => images.validateImages([{ mimeType: 'image/svg+xml', data: 'aGVsbG8=' }]), /INVALID/);
  assert.throws(() => images.validateImages([{ ...image, data: 'not base64' }]), /INVALID/);
  assert.throws(() => images.validateImages([image, image, image, image]), /INVALID/);
  assert.throws(() => images.checkImageBudget([], [{ ...image, data: 'a'.repeat(images.MAX_HISTORY_IMAGE_CHARS + 4) }]), /BUDGET/);
  const messages = [{ sender: 'user', text: '', images: [image] }, { sender: 'character', text: 'A picture.' }];
  const conversation = require('../shared/conversation');
  const history = conversation.conversationHistory({ id: 'room', messages, scripts: [] });
  assert.deepEqual(history[0].parts, [{ inlineData: image }]);
  const types = load('storage/types.ts');
  let rows = [];
  const library = load('store/storyLibrary.ts', { '@/storage': { loadStories: () => rows, saveStories: next => { rows = types.sanitizeStories(next); }, subscribeStorage: () => () => {} } });
  const story = library.saveStory('호시노', `title : Images
호시노 : Hello
endEvent`, messages);
  assert.deepEqual(rows[0].chatMessages[0].images, [image]);
  assert.equal(rows[0].hasImageHistory, true);
  library.appendRoomStory(story.id, `title : Second
호시노 : Hi
endEvent`, messages);
  library.updateRoom(story.id, { chatMessages: [], episodes: rows[0].episodes.map(episode => ({ ...episode, chatMessages: [] })), hasImageHistory: false });
  assert.equal(rows[0].hasImageHistory, true);
  library.updateStory(story.id, story.script, []);
  assert.equal(rows[0].hasImageHistory, true);
  assert.equal(library.publicationStory(rows[0], rows[0].episodes[0].id).hasImageHistory, true);
  assert.equal(types.parseStories(JSON.stringify(rows))[0].hasImageHistory, true);
  const validation = load('shared/community/validation.ts');
  const assets = require('../shared/community/assets.json');
  const publicInput = { ...story, clientId: story.id };
  for (const input of [publicInput, { ...publicInput, chatMessages: [] }, { ...publicInput, hasImageHistory: false }]) {
    assert.throws(() => validation.validatePublicStory(input, assets), error => error.code === 'IMAGE_HISTORY_PRIVATE');
  }
  // Existing native libraries migrate lazily from AsyncStorage to a filesystem document.
  const files = new Map();
  class File {
    constructor(_directory, name) { this.name = name; }
    get exists() { return files.has(this.name); }
    async text() { return files.get(this.name); }
    write(value) { files.set(this.name, value); }
    moveSync(destination, options) { assert.equal(options.overwrite, true); files.set(destination.name, files.get(this.name)); files.delete(this.name); }
  }
  const storage = load('storage/storyStorage.ts', {
    './types': types,
    'expo-file-system': { File, Paths: { document: 'document' } },
    '@react-native-async-storage/async-storage': { getItem: async () => JSON.stringify([story]) },
  });
  assert.equal((await storage.readStoryRecords())[0].id, story.id);
  await storage.writeStoryRecords(rows);
  assert.equal((await storage.readStoryRecords())[0].hasImageHistory, true);
  assert.equal((await storage.readStoryRecords())[0].chatMessages.length, 0);
  let sentParts;
  const controller = load('server/src/controllers/chatController.js', { '../services/geminiService': {
    apiKeyFrom: () => 'key', keyId: () => 'key', restoreConversation() {},
    getChat: async () => ({ sendMessage: async parts => { sentParts = parts; return { response: { text: () => 'I see it.' } }; } }),
  } });
  let code = 200, output;
  const response = { status(value) { code = value; return this; }, json(value) { output = value; } };
  await controller.sendChat({ body: { character: '호시노', message: '', images: [image] } }, response);
  assert.equal(code, 200); assert.equal(output.reply, 'I see it.');
  assert.deepEqual(sentParts, [{ inlineData: image }]);
  await controller.sendChat({ body: { character: '호시노', message: '', images: [{ mimeType: 'image/svg+xml', data: 'aGVsbG8=' }] } }, response);
  assert.equal(code, 400);
  const originalReader = global.FileReader;
  global.FileReader = class {
    readAsDataURL(file) { this.result = 'data:' + file.type + ';base64,aGVsbG8='; queueMicrotask(() => this.onload()); }
  };
  try {
    const web = load('platform/chatImagePicker.web.ts');
    const target = new EventTarget();
    const loads = [];
    const unbind = web.bindChatImagePaste(target, loadImages => loads.push(loadImages));
    const file = { type: 'image/png', size: 5 };
    function paste(files, text = '', items) {
      const event = new Event('paste', { cancelable: true });
      Object.defineProperty(event, 'clipboardData', { value: { items: items ?? files.map(file => ({ kind: 'file', type: file.type, getAsFile: () => file })), files, getData: () => text } });
      target.dispatchEvent(event);
      return event;
    }
    assert.equal(paste([file]).defaultPrevented, true, 'image-only paste consumes browser default');
    assert.deepEqual(await loads.at(-1)(), [image]);
    const count = loads.length;
    assert.equal(paste([], 'plain text').defaultPrevented, false);
    assert.equal(loads.length, count, 'text-only paste is untouched');
    assert.equal(paste([file], 'caption').defaultPrevented, false, 'mixed content keeps native text insertion');
    assert.deepEqual(await loads.at(-1)(), [image]);
    paste([file], '', []);
    assert.deepEqual(await loads.at(-1)(), [image], 'clipboard.files fallback supports copied image files');
    paste([{ ...file, size: images.MAX_IMAGE_BYTES + 1 }]);
    await assert.rejects(loads.at(-1)(), /INVALID_CHAT_IMAGES/);
    paste([{ ...file, type: 'image/svg+xml' }]);
    await assert.rejects(loads.at(-1)(), /INVALID_CHAT_IMAGES/);
    paste([file, file, file, file]);
    await assert.rejects(loads.at(-1)(), /INVALID_CHAT_IMAGES/);
    unbind();
    const beforeCleanup = loads.length;
    paste([file]);
    assert.equal(loads.length, beforeCleanup, 'unmount removes the paste handler');
  } finally { global.FileReader = originalReader; }
  console.log('PASS image validation/budgets, multimodal history, persistent image data, sticky room/episode privacy, archive validation and native library migration');
})().catch(error => { console.error(error); process.exitCode = 1; });
