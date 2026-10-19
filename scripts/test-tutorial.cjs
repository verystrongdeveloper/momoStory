const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
function load(file, mocks = {}) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '..', file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(id => Object.hasOwn(mocks, id) ? mocks[id] : require(id), mod, mod.exports);
  return mod.exports;
}
const content = load('components/guide/tutorialContent.ts');
const onboarding = load('components/guide/onboardingContent.ts');
const storageTypes = load('storage/types.ts', { '../utils/chatPresentation': { normalizeChatSound: () => 'pop' } });
assert.equal(storageTypes.DEFAULT_PREFERENCES.language, 'en');
for (const raw of [null, '{}', '{"language":"invalid"}', 'broken']) {
  assert.equal(storageTypes.parsePreferences(raw).language, 'en');
}
for (const code of ['ko', 'en', 'ja', 'zh']) {
  assert.equal(storageTypes.parsePreferences(JSON.stringify({ language: code })).language, code);
  assert.equal(onboarding.onboardingContent[code].terms.length, 6);
}
const ids = ['welcome', 'api', 'key', 'chat', 'story', 'library', 'editor', 'video', 'community', 'publish', 'limits', 'settings'];
for (const language of ['ko', 'en', 'ja', 'zh']) {
  const pages = content.getTutorialContent(language);
  assert.deepEqual(pages.map(page => page.id), ids);
  assert.ok(pages.every(page => page.title && page.paragraphs.length && page.paragraphs.every(text => typeof text === 'string' && text.length > 5)));
  assert.equal(pages.filter(page => page.aiStudio).length, 1);
  const limits = pages.find(page => page.id === 'limits').paragraphs.join(' ');
  for (const required of ['5', '10', '300', '100', '200KB']) assert.ok(limits.includes(required), `${language}: missing limit ${required}`);
  assert.ok(pages.find(page => page.id === 'editor').paragraphs.join(' ').includes('waitSecond = 2'));
  assert.ok(pages.find(page => page.id === 'video').paragraphs.join(' ').includes('Expo Go'));
}
const ko = Object.fromEntries(content.getTutorialContent('ko').map(page => [page.id, page.paragraphs.join('\n')]));
for (const word of ['좋아요한', '일간', '주간', '월간', '연간', '월요일', '신고', '조회수']) assert.ok(ko.community.includes(word));
for (const word of ['공개하기', '개인정보', '익명', '복구', '자동으로 바뀌지']) assert.ok(ko.publish.includes(word));
for (const word of ['채팅 포함', '스토리만', '10분', '저장 위치', '자동', '선택지']) assert.ok(ko.video.includes(word));
for (const word of ['80~150%', '미리듣기', '자동 번역', '업데이트']) assert.ok(ko.settings.includes(word));
let language = 'ko', flags = { termsAccepted: true, tutorialSeen: true }, closed = 0;
const listeners = new Set(), writes = [], links = [];
const rn = Object.fromEntries(['View', 'Text', 'ScrollView', 'TouchableOpacity', 'Pressable'].map(name => [name, name]));
rn.StyleSheet = { absoluteFill: {}, create: value => value }; rn.Linking = { openURL: async url => { links.push(url); } };
const Guide = load('components/guide/AppGuide.tsx', {
  react: React, 'react-native': rn, '@expo/vector-icons': { Ionicons: 'Ionicons' }, './tutorialContent': content,
  './onboardingContent': onboarding,
  '@/services/appLanguage': {
    APP_LANGUAGES: [{ code: 'ko', label: '한국어' }, { code: 'en', label: 'English' }, { code: 'ja', label: '日本語' }, { code: 'zh', label: '中文' }],
    setAppLanguage: value => { language = value; for (const listener of [...listeners]) listener(); },
  },
  '@/i18n': { useI18n: () => ({ language: React.useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener); }, () => language), t: key => key }) },
  '@/storage': {
    getSetting: key => flags[key], isStorageSynced: () => true,
    subscribeStorage: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    saveSetting: (key, value) => { flags[key] = value; writes.push([key, value]); for (const listener of [...listeners]) listener(); },
  },
}).default;
const textOf = value => Array.isArray(value) ? value.map(textOf).join('') : typeof value === 'object' ? '' : String(value ?? '');
const button = (tree, label) => tree.root.findAllByType('TouchableOpacity').find(node => node.findAllByType('Text').some(text => text.props.children === label));
const onManualClose = () => { closed++; };
(async () => {
  let tree;
  for (language of ['ko', 'en', 'ja', 'zh']) {
    await React.act(async () => { tree = Renderer.create(React.createElement(Guide, { manual: 'tutorial', onManualClose })); });
    const pages = content.getTutorialContent(language);
    for (let index = 0; index < pages.length; index++) {
      const texts = tree.root.findAllByType('Text').map(node => textOf(node.props.children));
      assert.ok(texts.includes(pages[index].title));
      assert.ok(texts.includes(`${index + 1} / ${pages.length}`));
      assert.ok(texts.some(text => text.includes(pages[index].paragraphs[0])));
      if (index === 0) assert.equal(button(tree, 'previous'), undefined);
      else assert.ok(button(tree, 'previous'));
      if (index < pages.length - 1) await React.act(async () => button(tree, 'next').props.onPress());
      else { assert.equal(button(tree, 'next'), undefined); await React.act(async () => button(tree, 'start').props.onPress()); }
    }
    await React.act(async () => tree.unmount());
  }
  assert.equal(closed, 4); assert.deepEqual(writes, [], 'opening the guide again must not reset existing onboarding or consent');
  language = 'ko';
  await React.act(async () => { tree = Renderer.create(React.createElement(Guide, { manual: null, onManualClose })); });
  assert.equal(tree.toJSON(), null, 'updated tutorial must not force existing users through it again');
  await React.act(async () => tree.unmount());
  flags = { termsAccepted: true, tutorialSeen: false };
  await React.act(async () => { tree = Renderer.create(React.createElement(Guide, { manual: null, onManualClose })); });
  assert.ok(button(tree, 'next'));
  await React.act(async () => button(tree, 'skip').props.onPress());
  assert.equal(flags.tutorialSeen, true); assert.equal(tree.toJSON(), null);
  await React.act(async () => tree.unmount());
  flags = { termsAccepted: false, tutorialSeen: false };
  language = 'en';
  await React.act(async () => { tree = Renderer.create(React.createElement(Guide, { manual: null, onManualClose })); });
  assert.ok(button(tree, 'Continue'));
  assert.equal(button(tree, 'agreeStart'), undefined, 'language selection must precede terms');
  assert.equal(tree.root.findAllByType('TouchableOpacity').find(node => node.props.accessibilityState?.selected).findByType('Text').props.children, 'English');
  for (const [code, label] of [['ko', '한국어'], ['ja', '日本語'], ['zh', '中文'], ['en', 'English']]) {
    await React.act(async () => button(tree, label).props.onPress());
    assert.ok(button(tree, onboarding.onboardingContent[code].continueLabel));
    await React.act(async () => button(tree, onboarding.onboardingContent[code].continueLabel).props.onPress());
    assert.ok(tree.root.findAllByType('Text').some(node => node.props.children === onboarding.onboardingContent[code].termsLead));
    assert.equal(button(tree, 'agreeStart').props.disabled, true);
    await React.act(async () => button(tree, onboarding.onboardingContent[code].changeLanguage).props.onPress());
  }
  await React.act(async () => button(tree, 'Continue').props.onPress());
  assert.equal(button(tree, 'agreeStart').props.disabled, true, 'consent is never accepted automatically');
  await React.act(async () => tree.root.findByType('Pressable').props.onPress());
  await React.act(async () => button(tree, 'Change language').props.onPress());
  await React.act(async () => button(tree, 'Continue').props.onPress());
  assert.equal(button(tree, 'agreeStart').props.disabled, true, 'changing language resets the consent checkbox');
  await React.act(async () => tree.root.findByType('Pressable').props.onPress());
  await React.act(async () => button(tree, 'agreeStart').props.onPress());
  assert.equal(flags.termsAccepted, true);
  assert.ok(button(tree, 'next'), 'tutorial follows explicit consent');
  await React.act(async () => tree.unmount());
  assert.equal(listeners.size, 0); assert.deepEqual(links, []);
  console.log('PASS 12 localized tutorial pages, community/privacy/quotas/rankings/editor/video/sound/version coverage, navigation and completion, no forced onboarding or automatic consent');
})().catch(error => { console.error(error); process.exitCode = 1; });
