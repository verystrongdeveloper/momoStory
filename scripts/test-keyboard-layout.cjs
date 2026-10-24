const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
function load(file, mocks) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true },
  }).outputText;
  new Function('require', 'module', 'exports', code)(id => { assert.ok(Object.hasOwn(mocks, id), `Unexpected import ${id}`); return mocks[id]; }, mod, mod.exports);
  return mod.exports;
}
const events = new Map(), dimensionListeners = new Set();
let height = 800;
const rn = {
  Platform: { OS: 'android' }, KeyboardAvoidingView: 'KeyboardAvoidingView', StyleSheet: { create: value => value },
  Keyboard: { addListener: (name, fn) => { events.set(name, fn); return { remove: () => events.delete(name) }; } },
  Dimensions: { get: () => ({ height }), addEventListener: (_name, fn) => { dimensionListeners.add(fn); return { remove: () => dimensionListeners.delete(fn) }; } },
};
const keyboardHook = load('hooks/useKeyboardInset.ts', { react: React, 'react-native': rn });
const Home = load('app/index.tsx', {
  react: React, 'react-native': rn, '@/hooks/useKeyboardInset': keyboardHook,
  'react-native-safe-area-context': { useSafeAreaInsets: () => ({ top: 24, bottom: 20, left: 0, right: 0 }) },
  '@/components/layout/StoryContainer': 'StoryContainer',
}).default;
(async () => {
  let tree;
  const root = () => tree.root.findByType('KeyboardAvoidingView');
  const bottom = () => root().props.style.at(-1).paddingBottom;
  await React.act(async () => { tree = Renderer.create(React.createElement(Home)); });
  assert.equal(root().props.behavior, undefined, 'Android uses resize/remaining overlap instead of a second height reduction');
  assert.equal(bottom(), 20);
  await React.act(async () => events.get('keyboardDidShow')({ endCoordinates: { screenY: 500 } }));
  assert.equal(bottom(), 300, 'edge-to-edge keyboard overlap is covered when the OS does not resize');
  await React.act(async () => { height = 500; dimensionListeners.forEach(fn => fn()); });
  assert.equal(bottom(), 0, 'a late Android adjustResize update removes the extra keyboard inset');
  await React.act(async () => events.get('keyboardDidChangeFrame')({ endCoordinates: { screenY: 450 } }));
  assert.equal(bottom(), 50, 'changing keyboard height recomputes only the remaining overlap');
  await React.act(async () => events.get('keyboardDidHide')());
  assert.equal(bottom(), 20, 'safe area returns when the keyboard closes');
  await React.act(async () => tree.unmount());
  assert.equal(events.size, 0); assert.equal(dimensionListeners.size, 0);
  height = 800; rn.Platform.OS = 'ios';
  await React.act(async () => { tree = Renderer.create(React.createElement(Home)); });
  assert.equal(root().props.behavior, 'padding');
  await React.act(async () => events.get('keyboardWillShow')({ endCoordinates: { screenY: 500 } }));
  assert.equal(bottom(), 0, 'iOS keyboard avoidance is applied once by KeyboardAvoidingView');
  await React.act(async () => tree.unmount());
  console.log('PASS Android resized/overlay/changed keyboard geometry, no double inset, restored safe area, iOS avoidance and listener cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; });
