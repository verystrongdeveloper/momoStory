const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const React = require('react');
const Renderer = require('react-test-renderer');
global.IS_REACT_ACT_ENVIRONMENT = true;
const root = path.resolve(__dirname, '..');
function load(file, mocks) {
  const mod = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(path.join(root, file), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, esModuleInterop: true } }).outputText;
  new Function('require', 'module', 'exports', code)(id => Object.hasOwn(mocks, id) ? mocks[id] : require(id), mod, mod.exports);
  return mod.exports;
}
const rn = Object.fromEntries(['View', 'Text', 'Modal', 'Pressable', 'TextInput', 'ScrollView', 'TouchableOpacity', 'ActivityIndicator', 'Image'].map(name => [name, name]));
rn.StyleSheet = { create: value => value };
const translate = (key, values) => key === 'communityCommentCount' ? `${key}:${values.count}` : key;
const i18n = { useI18n: () => ({ t: translate, language: 'ko' }) };
const post = { id: '11111111-1111-4111-8111-111111111111', title: 'Public story', character: '호시노', preview_bg: 'BG_AbydosCouncilRoom', created_at: new Date().toISOString(), likes: 0, views: 1, comment_count: 0, liked: false, is_mine: true };
const detail = { ...post, script: 'title : Public story\n호시노 : hi\nendEvent', chat_messages: [{ sender: 'user', text: 'hi' }], comments: [] };
const validation = load('shared/community/validation.ts', {});
const chars = { avatarOf: () => 'avatar', displayCharacterName: name => name };
const button = (tree, key) => tree.root.findAllByType('TouchableOpacity').find(node => node.props.accessibilityLabel === key || node.findAllByType('Text').some(text => text.props.children === key));
const has = (tree, key) => tree.root.findAllByType('Text').some(text => text.props.children === key);
const hasCount = (tree, count) => tree.root.findAllByType('Text').some(text => JSON.stringify(text.props.children).includes(`communityCommentCount:${count}`));
(async () => {
  let tree, configured = true, published = 0, closed = 0, resolvePublish;
  const publishPayloads = [];
  const publishStory = { ...detail, chatMessages: detail.chat_messages.map(message => ({ ...message })) };
  const originalStory = JSON.stringify(publishStory);
  const errors = error => error.code === 'RATE_LIMIT' ? 'communityRateLimit' : 'communityFailed';
  const api = { communityConfigured: () => configured, communityErrorKey: errors, community: { publish: story => { publishPayloads.push(story); published++; return new Promise(resolve => { resolvePublish = resolve; }); } } };
  const Publish = load('components/community/PublishStoryModal.tsx', { react: React, 'react-native': rn, '@/i18n': i18n, '@/services/community/client': api }).default;
  await React.act(async () => { tree = Renderer.create(React.createElement(Publish, { story: publishStory, onClose: () => closed++ })); });
  assert.equal(tree.root.findAllByProps({ accessibilityRole: 'radio' })[0].props.accessibilityState.checked, true, 'chat is included by default when present');
  assert.equal(button(tree, 'communityPublish').props.disabled, true);
  await React.act(async () => tree.root.findByProps({ accessibilityRole: 'checkbox' }).props.onPress());
  assert.equal(button(tree, 'communityPublish').props.disabled, false);
  await React.act(async () => { button(tree, 'communityPublish').props.onPress(); button(tree, 'communityPublish').props.onPress(); });
  assert.equal(published, 1, 'double-click cannot duplicate publication');
  assert.deepEqual(publishPayloads.at(-1).chatMessages, publishStory.chatMessages);
  assert.ok(tree.root.findAllByProps({ accessibilityRole: 'radio' }).every(node => node.props.disabled), 'scope is locked while publishing');
  assert.equal(button(tree, 'cancel').props.disabled, true);
  await React.act(async () => tree.root.findByType('Modal').props.onRequestClose()); assert.equal(closed, 0);
  await React.act(async () => resolvePublish({ id: post.id }));
  assert.ok(has(tree, 'communityPublished'));
  assert.equal(button(tree, 'communityPublish'), undefined);
  await React.act(async () => tree.unmount());
  await React.act(async () => { tree = Renderer.create(React.createElement(Publish, { story: publishStory, onClose() {} })); });
  await React.act(async () => tree.root.findByProps({ accessibilityRole: 'checkbox' }).props.onPress());
  await React.act(async () => tree.root.findAllByProps({ accessibilityRole: 'radio' })[1].props.onPress());
  assert.equal(button(tree, 'communityPublish').props.disabled, true, 'changing scope requires reviewing the new content');
  assert.ok(has(tree, 'communityPublishStoryOnlyNotice'));
  assert.equal(has(tree, 'communityPublishNotice'), false, 'privacy notice matches selected content');
  await React.act(async () => tree.root.findByProps({ accessibilityRole: 'checkbox' }).props.onPress());
  await React.act(async () => button(tree, 'communityPublish').props.onPress());
  assert.deepEqual(publishPayloads.at(-1).chatMessages, [], 'story-only publish sends no chat');
  assert.equal(publishPayloads.at(-1).script, publishStory.script);
  assert.equal(publishPayloads.at(-1).id, publishStory.id, 'existing duplicate-post identity stays unchanged');
  assert.equal(JSON.stringify(publishStory), originalStory, 'publishing scope never changes the local story');
  await React.act(async () => resolvePublish({ id: post.id }));
  await React.act(async () => tree.unmount());
  await React.act(async () => { tree = Renderer.create(React.createElement(Publish, { story: publishStory, onClose() {} })); });
  assert.ok(has(tree, 'communityRepublishNotice'), 'publication explains existing-post replacement before consent');
  await React.act(async () => tree.root.findByProps({ accessibilityRole: 'checkbox' }).props.onPress());
  await React.act(async () => button(tree, 'communityPublish').props.onPress());
  await React.act(async () => resolvePublish({ id: post.id, updated: true }));
  assert.ok(has(tree, 'communityUpdated'), 'updated posts get a distinct success message');
  await React.act(async () => tree.unmount());
  for (const chatMessages of [undefined, []]) {
    await React.act(async () => { tree = Renderer.create(React.createElement(Publish, { story: { ...publishStory, chatMessages }, onClose() {} })); });
    const radios = tree.root.findAllByProps({ accessibilityRole: 'radio' });
    assert.equal(radios[0].props.disabled, true);
    assert.equal(radios[1].props.accessibilityState.checked, true, 'stories without chat default to story only');
    assert.ok(has(tree, 'communityPublishNoChat'));
    await React.act(async () => tree.unmount());
  }
  configured = false;
  await React.act(async () => { tree = Renderer.create(React.createElement(Publish, { story: detail, onClose() {} })); });
  assert.ok(has(tree, 'communitySetup'));
  assert.equal(button(tree, 'communityPublish').props.disabled, true);
  await React.act(async () => tree.unmount());

  let queries = [], likes = [], commentBodies = [], views = [], failComment = false;
  const playbackRoutes = [], playbackScripts = [];
  let pageTotal = 1;
  api.community.page = async options => { const posts = await api.community.list(options); return { posts, total: posts.length ? pageTotal : 0 }; };
  api.community.list = async options => { queries.push(options); return options.character && options.character !== post.character ? [] : [post]; };
  api.community.detail = async () => ({ ...detail, liked: likes.at(-1)?.[1] ?? false });
  api.community.view = async id => { views.push(id); };
  api.community.like = async (...args) => { likes.push(args); };
  api.community.comment = async (_id, text) => { if (failComment) throw { code: 'RATE_LIMIT' }; commentBodies.push(text); post.comment_count++; };
  api.community.report = async () => {};
  api.communityStory = value => ({ id: `community-${value.id}`, title: value.title, character: value.character, script: value.script, createdAt: 0, chatMessages: value.chat_messages });
  let stored = [], failSave = false;
  const storageListeners = new Set();
  const library = load('store/storyLibrary.ts', {
    '@/storage': {
      loadStories: () => stored,
      saveStories: value => { if (failSave) throw new Error('storage failed'); stored = value; storageListeners.forEach(listener => listener()); },
      subscribeStorage: listener => { storageListeners.add(listener); return () => storageListeners.delete(listener); },
    },
    '../shared/prompts/speakerNames': { canonicalCharacterName: name => name },
  });
  const Panel = load('components/community/CommunityPanel.tsx', {
    'expo-router': { useRouter: () => ({ push: route => playbackRoutes.push(route) }) },
    '@/store/eventStore': { setPendingEvent: (...args) => playbackScripts.push(args) },
    react: React, 'react-native': rn, '@expo/vector-icons': { Ionicons: 'Ionicons' }, '@/components/chat/CharacterFilter': 'CharacterFilter', '@/components/chat/Pagination': { __esModule: true, default: 'Pagination', PAGE_SIZE: 20 }, '@/i18n': i18n, '@/constants/characters': chars, '@/constants/eventAssets': { bgMap: { BG_AbydosCouncilRoom: 'background' } }, '@/components/CharacterAvatar': 'CharacterAvatar', '@/components/chat/CharacterChat': 'CharacterChat', '@/services/community/client': api, '@/shared/community/validation': validation, '@/store/storyLibrary': library }).default;
  await React.act(async () => { tree = Renderer.create(React.createElement(Panel)); });
  assert.ok(has(tree, 'communitySetup')); assert.equal(queries.length, 0);
  await React.act(async () => tree.unmount()); configured = true;
  await React.act(async () => { tree = Renderer.create(React.createElement(Panel)); });
  assert.equal(queries.at(-1).liked, false);
  const archiveGrid = () => tree.root.findAllByType('View').find(node => typeof node.props.onLayout === 'function');
  for (const width of [1794, 1800, 720, 360]) {
    await React.act(async () => archiveGrid().props.onLayout({ nativeEvent: { layout: { width } } }));
    const card = tree.root.findByProps({ accessibilityLabel: post.title });
    const columns = width >= 720 ? 3 : 2;
    const cardWidth = card.props.style.at(-1).width;
    assert.ok(cardWidth * columns + 12 * (columns - 1) <= width - 0.5, 'all columns fit even when onLayout rounds the actual CSS width up');
  }
  pageTotal = 41;
  await React.act(async () => button(tree, 'communityRefresh').props.onPress());
  assert.equal(tree.root.findByType('Pagination').props.totalPages, 3);
  await React.act(async () => tree.root.findByType('Pagination').props.onChange(3));
  assert.equal(queries.at(-1).offset, 40);
  await React.act(async () => tree.root.findByType('CharacterFilter').props.onChange('호시노'));
  assert.equal(queries.at(-1).offset, 0, 'filter resets archive page');
  pageTotal = 1;
  await React.act(async () => tree.root.findByType('CharacterFilter').props.onChange(''));
  assert.equal(tree.root.findByType('Image').props.source, 'background', 'community cards render the first story background behind the character');
  const avatarStyle = tree.root.findByType('CharacterAvatar').props.style;
  assert.equal(avatarStyle.position, 'absolute', 'native character layer must have explicit bounds without absoluteFillObject');
  for (const edge of ['top', 'right', 'bottom', 'left']) assert.equal(avatarStyle[edge], 0);
  assert.equal(avatarStyle.backgroundColor, 'transparent', 'story background remains visible behind the character');
  const thumbnailLoading = () => tree.root.findAllByProps({ accessibilityLabel: 'communityPreviewLoading' });
  assert.equal(thumbnailLoading().length, 1);
  await React.act(async () => tree.root.findByType('Image').props.onLoad());
  assert.equal(thumbnailLoading().length, 1, 'background alone cannot reveal an incomplete thumbnail');
  await React.act(async () => tree.root.findByType('CharacterAvatar').props.onLoad());
  assert.equal(thumbnailLoading().length, 0, 'thumbnail is revealed only after both images load');
  assert.ok(hasCount(tree, 0), 'cards explicitly show zero comments');
  await React.act(async () => tree.root.findByType('CharacterFilter').props.onChange('히나'));
  assert.equal(queries.at(-1).character, '히나'); assert.equal(queries.at(-1).offset, 0);
  assert.equal(tree.root.findAllByProps({ accessibilityLabel: post.title }).length, 0);
  await React.act(async () => tree.root.findByType('CharacterFilter').props.onChange('호시노'));
  assert.ok(hasCount(tree, 0));
  await React.act(async () => tree.root.findByType('CharacterFilter').props.onChange(''));
  post.comment_count = 7;
  await React.act(async () => button(tree, 'communityRefresh').props.onPress());
  assert.ok(hasCount(tree, 7), 'refresh displays the server total');
  assert.equal(thumbnailLoading().length, 1, 'reloaded cards start with a loading placeholder');
  await React.act(async () => tree.root.findByType('CharacterAvatar').props.onError());
  assert.equal(thumbnailLoading().length, 0, 'failed images do not leave an endless spinner');
  assert.ok(has(tree, 'communityPreviewUnavailable'));
  await React.act(async () => button(tree, 'communityLiked').props.onPress());
  assert.equal(queries.at(-1).liked, true);
  await React.act(async () => button(tree, 'communityPopular').props.onPress());
  assert.equal(queries.at(-1).sort, 'popular');
  for (const period of ['day', 'week', 'month', 'year', 'all']) {
    await React.act(async () => button(tree, `communityPeriod_${period}`).props.onPress());
    assert.equal(queries.at(-1).period, period);
    assert.equal(queries.at(-1).offset, 0);
  }
  await React.act(async () => tree.root.findByProps({ accessibilityLabel: 'communitySearch' }).props.onChangeText('Hello'));
  await React.act(async () => button(tree, 'communitySearchButton').props.onPress());
  assert.equal(queries.at(-1).query, 'Hello');
  await React.act(async () => tree.root.findByProps({ accessibilityLabel: post.title }).props.onPress());
  assert.deepEqual(views, [post.id]);
  failSave = true;
  await React.act(async () => button(tree, 'communityImport').props.onPress());
  assert.ok(has(tree, 'communityImportFailed')); assert.equal(stored.length, 0);
  failSave = false;
  await React.act(async () => button(tree, 'communityImport').props.onPress());
  assert.ok(has(tree, 'communityImportSuccess'));
  assert.equal(button(tree, 'communityImported').props.disabled, true);
  assert.equal(stored.length, 1);
  assert.equal(stored[0].id, `community-${post.id}`);
  assert.equal(stored[0].title, detail.title);
  assert.equal(stored[0].character, detail.character);
  assert.equal(stored[0].script, detail.script);
  assert.deepEqual(stored[0].chatMessages, detail.chat_messages);
  assert.notEqual(stored[0].chatMessages[0], detail.chat_messages[0], 'local chat is a separate copy');
  assert.ok(stored[0].createdAt > 0, 'import sorts by local save time');
  library.updateStory(stored[0].id, 'title : Local edit\n호시노 : edited\nendEvent');
  const edited = stored[0];
  library.importSharedStory(api.communityStory(detail));
  assert.equal(stored.length, 1, 'repeat imports do not duplicate');
  assert.equal(stored[0], edited, 'repeat imports preserve local edits');
  await React.act(async () => button(tree, 'communityLike').props.onPress());
  assert.deepEqual(likes, [[post.id, true]]); assert.ok(button(tree, 'communityUnlike'));
  assert.equal(button(tree, 'communityWatch').findAllByType('Text').length, 0, 'archive playback uses an icon without visible text');
  assert.equal(button(tree, 'communityWatch').findByType('Ionicons').props.name, 'play');
  await React.act(async () => button(tree, 'communityWatch').props.onPress());
  assert.equal(playbackRoutes.length, 0, 'posts with chat begin with chat playback');
  assert.equal(tree.root.findByType('CharacterChat').props.savedStory.script, detail.script);
  assert.equal(tree.root.findAllByType('TextInput').length, 0, 'archive player receives savedStory, not a writable chat');
  await React.act(async () => button(tree, 'previous').props.onPress());
  const originalChat = detail.chat_messages;
  detail.chat_messages = [];
  await React.act(async () => button(tree, 'communityRefresh').props.onPress());
  await React.act(async () => button(tree, 'communityWatch').props.onPress());
  assert.deepEqual(playbackRoutes, ['/event'], 'story-only posts open the story directly');
  assert.deepEqual(playbackScripts, [[detail.script]], 'archive playback uses the public script without resetting live conversations');
  assert.equal(tree.root.findAllByType('CharacterChat').length, 0, 'story-only playback skips the empty chat screen');
  detail.chat_messages = originalChat;
  await React.act(async () => button(tree, 'communityRefresh').props.onPress());
  const commentInput = () => tree.root.findByProps({ accessibilityLabel: 'communityCommentPlaceholder' });
  await React.act(async () => commentInput().props.onChangeText('😀'.repeat(301)));
  assert.equal(Array.from(commentInput().props.value).length, 300);
  await React.act(async () => button(tree, 'send').props.onPress());
  assert.equal(commentBodies.length, 1); assert.equal(commentInput().props.value, '');
  failComment = true;
  await React.act(async () => commentInput().props.onChangeText('keep my draft'));
  await React.act(async () => button(tree, 'send').props.onPress());
  assert.ok(has(tree, 'communityRateLimit')); assert.equal(commentInput().props.value, 'keep my draft');
  await React.act(async () => button(tree, 'previous').props.onPress());
  assert.ok(hasCount(tree, 8), 'returning from comments reloads the updated card count');
  await React.act(async () => tree.root.findByProps({ accessibilityLabel: post.title }).props.onPress());
  assert.equal(button(tree, 'communityImported').props.disabled, true, 'saved status survives reopening the post');
  await React.act(async () => library.deleteStory(`community-${post.id}`));
  assert.ok(button(tree, 'communityImport'), 'deleted local copy can be imported again');
  await React.act(async () => button(tree, 'communityImport').props.onPress());
  assert.equal(stored.length, 1);
  await React.act(async () => tree.unmount());
  // Verify the library menu opens the actual publish modal path.
  let libraryRows = [{ ...detail, createdAt: Date.now() }];
  let notifyLibrary;
  const Library = load('components/chat/StoryLibraryList.tsx', {
    '@/hooks/useKeyboardInset': { useKeyboardInset: () => 0 },
    './CharacterFilter': 'CharacterFilter', './Pagination': { __esModule: true, default: 'Pagination', PAGE_SIZE: 20 },
    '@/constants/eventAssets': { bgMap: {} }, '@/utils/parseEventScript': load('utils/parseEventScript.ts', {}),
    './StoryScriptEditor': 'StoryScriptEditor', './ChatMessageEditor': 'ChatMessageEditor', '@/store/temporaryChats': { getTemporaryChat: () => ({ getSnapshot: () => ({ isWaiting: false }), clear() {} }), forgetTemporaryRoom() {} }, '@/services/geminiKey': { getGeminiKey: () => '' }, '../../shared/conversation': require('../shared/conversation'),
    react: React, 'react-native': { ...rn, Platform: { OS: 'web' } }, '@expo/vector-icons': { Ionicons: 'Ionicons' }, '@/constants/characters': chars,
    '@/hooks/useLayout': { useLayout: () => ({ isCompact: true }) }, '@/components/CharacterAvatar': 'CharacterAvatar', '@/components/chat/StoryAssetPanel': 'StoryAssetPanel', './VideoExportModal': 'VideoExportModal', '@/components/community/PublishStoryModal': 'PublishStoryModal',
    '@/store/storyLibrary': { ...library, listStories: () => libraryRows, subscribeStories: listener => { notifyLibrary = listener; return () => {}; } }, '@/utils/insertStoryAsset': {}, '@/platform/clipboard': {}, '@/utils/storyFile': {}, '@/utils/storyPrompt': {}, '@/i18n': i18n,
  }).default;
  await React.act(async () => { tree = Renderer.create(React.createElement(Library, { onOpenStory() {} })); });
  assert.equal(tree.root.findAllByType('Image').length, 0, 'stories without BG keep the original library thumbnail');
  assert.equal(tree.root.findByType('CharacterAvatar').props.style[0].backgroundColor, '#f3d5dc');
  await React.act(async () => tree.root.findByType('CharacterFilter').props.onChange('히나'));
  assert.equal(tree.root.findAllByType('CharacterAvatar').length, 0, 'library filters by card character');
  await React.act(async () => tree.root.findByType('CharacterFilter').props.onChange('호시노'));
  assert.equal(tree.root.findAllByType('CharacterAvatar').length, 1);
  await React.act(async () => tree.root.findByProps({ accessibilityLabel: 'storyMenu' }).props.onPress());
  await React.act(async () => button(tree, 'communityPublish').props.onPress());
  assert.equal(tree.root.findByType('PublishStoryModal').props.story.id, post.id);
  await React.act(async () => tree.root.findByType('PublishStoryModal').props.onClose());
  libraryRows = Array.from({ length: 41 }, (_, i) => ({ ...detail, id: 'paged-' + i, title: 'Story ' + i, createdAt: i }));
  await React.act(async () => notifyLibrary());
  assert.equal(tree.root.findAllByType('CharacterAvatar').length, 20);
  await React.act(async () => tree.root.findByType('Pagination').props.onChange(3));
  assert.equal(tree.root.findAllByType('CharacterAvatar').length, 1);
  await React.act(async () => tree.root.findByType('CharacterFilter').props.onChange(''));
  assert.equal(tree.root.findByType('Pagination').props.page, 1, 'character selection resets library page');
  await React.act(async () => tree.root.findByType('Pagination').props.onChange(3));
  libraryRows = libraryRows.slice(0, 20);
  await React.act(async () => notifyLibrary());
  assert.equal(tree.root.findByType('Pagination').props.page, 1, 'deleting last page clamps library page');
  assert.equal(tree.root.findAllByType('CharacterAvatar').length, 20);
  await React.act(async () => tree.unmount());
  const Pagination = load('components/chat/Pagination.tsx', { react: React, 'react-native': rn, '@expo/vector-icons': { Ionicons: 'Ionicons' }, '@/i18n': i18n }).default;
  let changedPage;
  await React.act(async () => { tree = Renderer.create(React.createElement(Pagination, { page: 1, totalPages: 10, onChange: value => { changedPage = value; } })); });
  assert.equal(button(tree, 'paginationPrevious').props.disabled, true);
  assert.equal(tree.root.findAllByType('TouchableOpacity').length, 7, 'page buttons stay compact');
  await React.act(async () => button(tree, 'paginationNext').props.onPress());
  assert.equal(changedPage, 2);
  await React.act(async () => tree.update(React.createElement(Pagination, { page: 10, totalPages: 10, disabled: true, onChange() {} })));
  assert.ok(tree.root.findAllByType('TouchableOpacity').every(node => node.props.disabled));
  await React.act(async () => tree.update(React.createElement(Pagination, { page: 1, totalPages: 1, onChange() {} })));
  assert.equal(tree.toJSON(), null, 'single page hides pagination');
  await React.act(async () => tree.unmount());
  const translations = load('i18n/community.ts', {}).communityTranslations;
  const Filter = load('components/chat/CharacterFilter.tsx', { react: React, 'react-native': rn, '@/i18n': i18n, '@/constants/characters': { ...chars, CHARACTERS: [{ name: '호시노' }, { name: '히나' }, { name: '마리' }] } }).default;
  let filterSelection;
  await React.act(async () => { tree = Renderer.create(React.createElement(Filter, { value: '', characters: ['호시노', 'extra'], onChange: value => { filterSelection = value; } })); });
  assert.equal(tree.root.findAllByProps({ accessibilityRole: 'radio' }).length, 0, 'filter options stay collapsed');
  await React.act(async () => button(tree, 'characterFilter').props.onPress());
  assert.equal(tree.root.findAllByProps({ accessibilityRole: 'radio' }).length, 5, 'all plus unique known/local characters');
  await React.act(async () => button(tree, '히나').props.onPress());
  assert.equal(filterSelection, '히나');
  assert.equal(tree.root.findAllByType('Modal').length, 0, 'selection closes the picker');
  await React.act(async () => { tree.update(React.createElement(Filter, { value: '히나', onChange: value => { filterSelection = value; } })); });
  assert.ok(has(tree, '히나'), 'collapsed control shows current character');
  await React.act(async () => button(tree, 'characterFilter').props.onPress());
  await React.act(async () => tree.root.findByType('Modal').props.onRequestClose());
  assert.equal(filterSelection, '히나', 'dismissal preserves selection');
  await React.act(async () => tree.unmount());
  const Avatar = load('components/CharacterAvatar.tsx', { react: React, 'react-native': rn, '@/constants/characters': { ...chars, avatarCropOf: () => ({}) } }).default;
  let avatarLoaded = 0, avatarFailed = 0;
  await React.act(async () => { tree = Renderer.create(React.createElement(Avatar, { characterName: '호시노', onLoad: () => avatarLoaded++, onError: () => avatarFailed++ })); });
  await React.act(async () => { tree.root.findByType('Image').props.onLoad(); tree.root.findByType('Image').props.onError(); });
  assert.equal(avatarLoaded, 1); assert.equal(avatarFailed, 1);
  await React.act(async () => tree.unmount());
  for (const language of ['en', 'ja', 'zh']) assert.deepEqual(Object.keys(translations[language]).sort(), Object.keys(translations.ko).sort());
  console.log('PASS setup state, publish consent/duplicate guard, liked feed/search/sort, read-only chat-story playback, likes/comments/rate errors/Unicode lengths, library publish entry and four-language UI');
})().catch(error => { console.error(error); process.exitCode = 1; });
