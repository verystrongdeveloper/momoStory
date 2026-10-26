const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
function load(file, mocks = {}) {
  const absolute = path.resolve(__dirname, '..', file), mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true,
  } }).outputText;
  new Function('require', 'module', 'exports', code)(id => {
    if (Object.hasOwn(mocks, id)) return mocks[id];
    if (id.startsWith('.') && fs.existsSync(path.resolve(path.dirname(absolute), id + '.ts'))) return load(path.resolve(path.dirname(absolute), id + '.ts'), mocks);
    return createRequire(absolute)(id);
  }, mod, mod.exports);
  return mod.exports;
}
(async () => {
  const types = load('storage/types.ts');
  assert.equal(types.parsePreferences(null).notificationsEnabled, false);
  assert.equal(types.parsePreferences('{}').notificationPreview, false);
  assert.equal(types.parsePreferences('{}').chatNotifications, true);
  assert.equal(types.parsePreferences('{}').storyNotifications, true);
  assert.equal(types.parsePreferences('{"notificationsEnabled":"true"}').notificationsEnabled, false);
  let persisted;
  const storage = load('storage/index.ts', {
    './types': types, './prime': { readInitialSync: () => null },
    './secureStorage': { loadApiKey: async () => '', clearApiKey: async () => {} },
    './preferencesStorage': { loadPreferences: async () => types.DEFAULT_PREFERENCES, savePreferences: async value => { persisted = value; } },
    './storyStorage': { readStoryRecords: async () => [], writeStoryRecords: async () => {} },
    './migrate': { migrateLegacyStorage: async () => true },
  });
  await storage.hydrateStorage();
  storage.saveSetting('notificationsEnabled', true);
  storage.saveSetting('chatNotifications', false);
  storage.saveSetting('storyNotifications', false);
  storage.saveSetting('notificationPreview', true);
  assert.equal(persisted.notificationsEnabled, true);
  assert.equal(persisted.chatNotifications, false);
  assert.equal(types.parsePreferences(JSON.stringify(persisted)).storyNotifications, false);
  assert.equal(types.parsePreferences(JSON.stringify(persisted)).notificationPreview, true);

  let granted = false, checks = 0, requests = 0, sent = [], clears = 0;
  const rn = { Platform: { OS: 'android', Version: 33 }, NativeModules: { MomoNotifications: {
    enabled: async () => granted, clear: async () => { clears++; }, openSettings: async () => {},
    show: async (...args) => { sent.push(args); return granted; },
  } }, PermissionsAndroid: {
    PERMISSIONS: { POST_NOTIFICATIONS: 'notification-permission' }, RESULTS: { GRANTED: 'granted' },
    check: async () => { checks++; return granted; }, request: async () => { requests++; return granted ? 'granted' : 'denied'; },
  }, AppState: { currentState: 'active', addEventListener: () => ({ remove() {} }) },
  View: 'View', Text: 'Text', TouchableOpacity: 'Button', Switch: 'Switch', StyleSheet: { create: value => value } };
  const platform = load('platform/notifications.ts', { 'react-native': rn });
  assert.equal(await platform.requestNotifications(), false);
  assert.equal(requests, 1);
  granted = true; assert.equal(await platform.requestNotifications(), true);
  assert.equal(requests, 1, 'already granted permission does not prompt again');
  rn.Platform.Version = 32; checks = 0;
  assert.equal(await platform.requestNotifications(), true); assert.equal(checks, 0);
  rn.Platform.OS = 'web';
  assert.equal(platform.notificationsSupported(), false);
  assert.equal(await platform.showNotification('chat', 'channel', 'title', 'body'), false);
  rn.Platform.OS = 'android';
  await platform.showNotification('chat', 'channel', 'Hina', 'legacy reply', false, '히나');
  assert.deepEqual(sent.pop(), ['chat', 'channel', 'Hina', 'legacy reply', false], 'older APKs fall back to ordinary chat alerts');
  rn.NativeModules.MomoNotifications.showChat = async (channel, title, body, preview, character) => {
    sent.push(['chat', channel, title, body, preview, character]); return granted;
  };

  const chats = load('store/temporaryChats.ts');
  let queue = [], notifyQueue;
  const i18n = { useI18n: () => ({ language: 'ko', t: key => key }) };
  const Host = load('components/layout/NotificationHost.tsx', {
    react: React, 'react-native': rn, '@/storage': storage, '@/i18n': i18n,
    '@/platform/notifications': platform, '@/store/temporaryChats': chats,
    '@/constants/characters': { displayCharacterName: name => name },
    '@/store/videoExportJob': { getVideoExportQueue: () => queue, subscribeVideoExportJob: fn => { notifyQueue = fn; return () => {}; } },
  }).default;
  storage.saveSetting('chatNotifications', true); storage.saveSetting('notificationPreview', false);
  let tree;
  await React.act(async () => { tree = Renderer.create(React.createElement(Host)); });
  const chat = chats.getTemporaryChat('히나', 'secret-api-key');
  const add = (text, arrival) => chat.update(prev => ({ messages: [...prev.messages, { sender: 'character', text }] }), arrival);
  add('loaded history'); assert.equal(sent.length, 0, 'hydration and edits do not notify');
  const close = chat.openReader();
  add('visible', 'visible'); assert.equal(sent.length, 0, 'active reader does not notify');
  rn.AppState.currentState = 'background';
  add('background', 'background'); assert.equal(sent.length, 1);
  assert.equal(sent.at(-1)[3], 'notificationNewChat', 'preview is hidden by default');
  assert.equal(sent.at(-1)[5], '히나', 'chat alerts use the canonical character identity for the profile photo');
  close(); rn.AppState.currentState = 'active';
  storage.saveSetting('notificationPreview', true);
  add('new reply', 'new reply'); assert.equal(sent.at(-1)[3], 'new reply');
  await platform.showNotification('chat', 'channel', '日奈', 'localized reply', true, '히나');
  assert.deepEqual(sent.at(-1), ['chat', 'channel', '日奈', 'localized reply', true, '히나'], 'translated titles retain the same character photo');
  assert.ok(!JSON.stringify(sent).includes('secret-api-key'));
  storage.saveSetting('notificationsEnabled', false);
  const count = sent.length; add('muted', 'muted'); assert.equal(sent.length, count);
  storage.saveSetting('notificationsEnabled', true);
  const beforeStories = sent.length;
  chat.update({ storyScript: 'a muted story' });
  assert.equal(sent.length, beforeStories, 'story category can be disabled independently');
  storage.saveSetting('storyNotifications', true);
  storage.saveSetting('notificationPreview', false);
  chat.update({ storyScript: 'a finished story' });
  assert.equal(sent.length, beforeStories + 1);
  assert.deepEqual(sent.at(-1), ['story', 'storyNotifications', 'notificationStoryDone', 'MomoStory', false]);
  chat.update({ input: 'typing' }); chat.update({ storyScript: null });
  assert.equal(sent.length, beforeStories + 1, 'ordinary updates and reset do not announce completion');
  storage.saveSetting('notificationsEnabled', false);
  chat.update({ storyScript: 'another finished story' });
  assert.equal(sent.length, beforeStories + 1, 'master switch also gates story completion');
  storage.saveSetting('notificationsEnabled', true);
  storage.saveSetting('notificationPreview', true);
  rn.AppState.currentState = 'background';
  chat.update({ storyScript: 'background story' });
  assert.equal(sent.at(-1)[3], '히나', 'preview names the character without exposing the script');
  rn.AppState.currentState = 'active';
  await React.act(async () => { queue = [{ id: 1, status: 'done', title: 'story' }]; notifyQueue(); });
  assert.equal(sent.at(-1)[0], 'export');
  const doneCount = sent.length;
  await React.act(async () => { queue = [...queue]; notifyQueue(); });
  assert.equal(sent.length, doneCount, 'completion is announced once');
  await React.act(async () => { queue = [...queue, { id: 2, status: 'canceled' }]; notifyQueue(); });
  assert.equal(sent.length, doneCount, 'cancellation has no completion alert');
  await React.act(async () => tree.unmount());

  const Settings = load('components/layout/NotificationSettings.tsx', {
    react: React, 'react-native': rn, '@/storage': storage, '@/i18n': i18n, '@/platform/notifications': platform,
  }).default;
  storage.saveSetting('notificationsEnabled', false); granted = false;
  await React.act(async () => { tree = Renderer.create(React.createElement(Settings)); });
  const master = () => tree.root.findByProps({ accessibilityLabel: 'notificationsEnabled' });
  await React.act(async () => master().props.onValueChange(true));
  assert.equal(storage.getSetting('notificationsEnabled'), false, 'denial cannot enable app notifications');
  granted = true;
  await React.act(async () => master().props.onValueChange(true));
  assert.equal(storage.getSetting('notificationsEnabled'), true);
  await React.act(async () => tree.root.findByProps({ accessibilityLabel: 'storyNotifications' }).props.onValueChange(false));
  assert.equal(storage.getSetting('storyNotifications'), false, 'story setting switch persists');
  await React.act(async () => master().props.onValueChange(false));
  assert.equal(storage.getSetting('notificationsEnabled'), false); assert.ok(clears > 0);
  await React.act(async () => tree.unmount());
  console.log('PASS notification preferences persistence/migration, permission denial/grant, platform fallback, read/background chat gating, previews, completion deduplication and settings switches');
})().catch(error => { console.error(error); process.exitCode = 1; });
