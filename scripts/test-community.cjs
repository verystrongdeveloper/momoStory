const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const root = path.resolve(__dirname, '..');
const cache = new Map();
function load(file) {
  const absolute = path.resolve(root, file);
  if (cache.has(absolute)) return cache.get(absolute);
  if (absolute.endsWith('.json')) return JSON.parse(fs.readFileSync(absolute, 'utf8'));
  const mod = { exports: {} }; cache.set(absolute, mod.exports);
  const output = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  new Function('require', 'module', 'exports', output)(id => id.startsWith('.') ? load(path.resolve(path.dirname(absolute), id)) : require(id), mod, mod.exports);
  cache.set(absolute, mod.exports); return mod.exports;
}
const validation = load('shared/community/validation.ts');
const assets = require('../shared/community/assets.json');
const { validatePublicStory, validateComment } = validation;
const sample = { clientId: 'one', title: 'Test', character: '호시노', script: 'title : Test\n호시노(대책위원회) : Hello [emotion : hoshino_smile.png, bg : BG_AbydosCouncilRoom.jpg, music : Aira.mp3, animation : shakeX]\nselection : (1)"Hi" (2)(Wave) [speaker : Hoshino, dialogue : Welcome, emotion : hoshino_smile.png]\nwaitSecond : 1\nnarration : End\nendEvent', chatMessages: [{ sender: 'user', text: 'hi' }, { sender: 'character', text: 'hello', showImage: true }] };
const invalid = (changes, code) => assert.throws(() => validatePublicStory({ ...sample, ...changes }, assets), error => error.code === code);
(async () => {
  assert.deepEqual(validatePublicStory({ ...sample, apiKey: 'must-not-upload', author: 'forged', preferences: {} }, assets), sample);
  assert.equal(validatePublicStory({ ...sample, character: '마리', script: 'title : Test\n마리 : 안녕하세요, 선생님.\nendEvent' }, assets).character, '마리');
  const fubuki = { ...sample, clientId: 'fubuki', character: '후부키', script: 'title : Test\n후부키(생활안전국) : 잠깐 쉬자. [emotion : fubuki_default.png]\nselection : (1)"좋아" [speaker : Fubuki, dialogue : 여기 앉아., emotion : fubuki_smug.png]\nendEvent' };
  assert.equal(validatePublicStory(fubuki, assets).character, '후부키');
  const kei = { ...sample, clientId: 'kei', character: '케이', script: 'title : Test\n케이(초현상특무부) : 같이 확인해요. [emotion : kei_default.png]\nselection : (1)"좋아" [speaker : Kei, dialogue : 이쪽이에요., emotion : kei_smile.png]\nendEvent' };
  assert.equal(validatePublicStory(kei, assets).character, '케이');
  const koyuki = { ...sample, clientId: 'koyuki', character: '코유키', script: 'title : Test\n코유키(세미나) : 같이 해 봐요! [emotion : koyuki_happy.png]\nendEvent' };
  for (const speaker of ['코유키', 'Koyuki', 'コユキ', '小雪']) for (const emotion of assets.emotions.코유키) {
    validatePublicStory({ ...koyuki, script: `title : Test\n${speaker}(세미나) : hi [emotion : ${emotion}]\nselection : (1)"Hi" [speaker : ${speaker}, dialogue : Hello, emotion : ${emotion}]\nendEvent` }, assets);
  }
  invalid({ ...koyuki, script: 'title : Test\n코유키 : hi [emotion : koyuki_missing.png]\nendEvent' }, 'INVALID_ASSET');
  for (const speaker of ['케이', 'Kei', 'ケイ', '凯伊']) for (const emotion of assets.emotions.케이) {
    validatePublicStory({ ...kei, script: `title : Test\n${speaker}(초현상특무부) : hi [emotion : ${emotion}]\nselection : (1)"Hi" [speaker : ${speaker}, dialogue : Hello, emotion : ${emotion}]\nendEvent` }, assets);
  }
  invalid({ ...kei, script: 'title : Test\n케이 : hi [emotion : kei_missing.png]\nendEvent' }, 'INVALID_ASSET');
  for (const speaker of ['후부키', 'Fubuki', 'フブキ', '吹雪']) for (const emotion of assets.emotions.후부키) {
    validatePublicStory({ ...fubuki, script: `title : Test\n${speaker}(생활안전국) : hi [emotion : ${emotion}]\nendEvent` }, assets);
  }
  for (const speaker of ['호시노', 'Hoshino', 'ホシノ', '星野', 'Hina', 'ヒナ', '日奈', '마리', 'Mari', 'マリー', '玛丽']) validatePublicStory({ ...sample, script: `타이틀 : Test\n${speaker} : hi\nendEvent` }, assets);
  for (const animation of ['shakeX', 'shakeY', 'slideX', 'slideY']) validatePublicStory({ ...sample, script: `title : Test\nanimation : ${animation}\n호시노 : hi\nendEvent` }, assets);
  validatePublicStory({ ...sample, script: 'title : Test\nbg : BG_AbydosCouncilRoom.jpg\n[music : Aira.mp3]\n호시노 : hi\nendEvent' }, assets);
  for (const row of [
    'narration : (머리를 쓰다듬었다.) [expression : Headpat.png]',
    'narration : 반응 [emotion : hoshino_smile, expression : sweat.png, animation : slideY, sound : SE_Crow_04.wav]',
    'selection : (1)"Hi" [speaker : Hoshino, dialogue : Welcome, expression : sweat.png, animation : shakeX, sound : SE_Crow_04.wav]',
    '호시노 : hi [emotion : hoshino_smile] [expression : sweat.png] [animation : shakeY]',
    '[emotion : hoshino_smile] [expression : Headpat.png] [animation : slideY]',
    'expression : Headpat.png',
    'emotion : hoshino_smile',
  ]) validatePublicStory({ ...sample, script: `title : Test\n호시노 : hi\n${row}\nendEvent` }, assets);
  for (const row of [
    'narration : hi [expression : missing.png]',
    'selection : (1)"Hi" [expression : missing.png]',
    '[expression : missing.png]',
  ]) invalid({ script: `title : Test\n${row}\nendEvent` }, 'INVALID_ASSET');
  for (const row of [
    'narration : hi [animation : jump]',
    'selection : (1)"Hi" [animation : jump]',
    '[animation : jump]',
  ]) invalid({ script: `title : Test\n${row}\nendEvent` }, 'INVALID_COMMAND');
  invalid({ script: 'title : Test\n호시노 : hi [music : Aira.mp3] [music : none]\nendEvent' }, 'INVALID_METADATA');
  const bracketProse = 'title : Test\nnarration : 화면에 [시스템 완전 락다운]이라는 글자가 점멸했다. [sound : SE_Denied_01.mp3]\n코유키(세미나) : 표지에 [샬레 중앙 단말기 비상 복구 지침서]라고 적혀 있어요! [emotion : koyuki_happy.png, animation : shakeY]\nnarration : 콘솔 창에 [인증 성공]이라는 문구가 떠올랐다. [sound : SE_Confirm_02.mp3]\nselection : (1)"[인증 성공]이라고 뜨네." (2)"좋아."\nendEvent';
  validatePublicStory({ ...koyuki, script: bracketProse }, assets);
  const parsedProse = load('utils/parseEventScript.ts').default(bracketProse);
  assert.ok(parsedProse.find(line => line.type === 'narration' && line.text.includes('[시스템 완전 락다운]') && line.soundFile === 'SE_Denied_01.mp3'));
  assert.ok(parsedProse.find(line => line.type === 'dialogue' && line.text.includes('[샬레 중앙 단말기 비상 복구 지침서]') && line.emotion === 'koyuki_happy' && line.animationType === 'shakeY'));
  assert.ok(parsedProse.find(line => line.type === 'narration' && line.text.includes('[인증 성공]') && line.soundFile === 'SE_Confirm_02.mp3'));
  assert.equal(parsedProse.find(line => line.type === 'selection').options[0], '[인증 성공]이라고 뜨네.');
  for (const bad of ['[unknownEffect : anything]', '[emotion koyuki_happy.png]', '[emotion : koyuki_missing.png]', '[emotion : koyuki_happy.png, emotion : koyuki_default.png]']) {
    assert.throws(() => validatePublicStory({ ...koyuki, script: `title : Test\n코유키 : [안내 문구]를 확인해요. ${bad}\nendEvent` }, assets), 'literal brackets must not bypass effect validation');
  }
  for (const separator of [':', '=']) validatePublicStory({ ...sample, script: `title : Test\n\n호시노 : hi\n\nwaitSecond ${separator} 2\n\nendEvent` }, assets);
  const broken = '\n\ntitle : Test\n\n호시노 : hi [emotion : missing.png]\n\nwaitSecond = 31\n\nendEvent';
  const diagnostics = validation.diagnoseStoryScript(broken, assets);
  assert.deepEqual(diagnostics.map(issue => [issue.code, issue.line]), [['INVALID_ASSET', 5], ['INVALID_COMMAND', 7]]);
  assert.equal(broken.slice(diagnostics[0].start, diagnostics[0].end), '호시노 : hi [emotion : missing.png]');
  assert.throws(() => validatePublicStory({ ...sample, script: broken }, assets), error => error.line === 5 && error.code === 'INVALID_ASSET');
  assert.deepEqual(validation.diagnoseStoryScript('title : Test\r\n\r\nwaitSecond = 2\r\n호시노 : hello\r\nendEvent', assets), []);
  const crlf = 'title : Test\r\n\r\nUnknown : hi\r\nendEvent';
  const crlfIssue = validation.diagnoseStoryScript(crlf, assets)[0];
  assert.equal(crlfIssue.line, 3); assert.equal(crlf.slice(crlfIssue.start, crlfIssue.end), 'Unknown : hi');
  invalid({ title: 'x'.repeat(101) }, 'INVALID_TITLE');
  invalid({ script: 'title : Test\nendEvent' }, 'INVALID_STRUCTURE');
  invalid({ script: 'title : Test\n호시노 : hi' }, 'MISSING_END');
  invalid({ script: 'title : Test\nUnknown : hi\nendEvent' }, 'INVALID_SPEAKER');
  invalid({ script: 'title : Test\nignored garbage\nendEvent' }, 'INVALID_SPEAKER');
  invalid({ script: 'title : Test\n호시노 : hi [bg : https://evil/image.jpg]\nendEvent' }, 'INVALID_ASSET');
  invalid({ script: 'title : Test\n호시노 : hi [emotion : nonexistent.png]\nendEvent' }, 'INVALID_ASSET');
  invalid({ script: 'title : Test\n호시노 : hi [animation : jump]\nendEvent' }, 'INVALID_COMMAND');
  invalid({ script: 'title : Test\n호시노 : hi [music : Aira.mp3, music : none]\nendEvent' }, 'INVALID_METADATA');
  invalid({ script: 'title : Test\nselection : (1)""\nendEvent' }, 'INVALID_SELECTION');
  invalid({ script: 'title : Test\nselection : (2)"hi"\nendEvent' }, 'INVALID_SELECTION');
  invalid({ script: 'title : Test\nselection : (1)"hi" garbage\nendEvent' }, 'INVALID_SELECTION');
  invalid({ script: 'title : Test\nwaitSecond : 31\n호시노 : hi\nendEvent' }, 'INVALID_COMMAND');
  invalid({ script: `title : Test\n${'waitSecond : 30\n'.repeat(5)}호시노 : hi\nendEvent` }, 'INVALID_COMMAND');
  invalid({ chatMessages: [{ sender: 'typing', text: 'bad' }] }, 'INVALID_CHAT');
  invalid({ chatMessages: Array.from({ length: 301 }, () => ({ sender: 'user', text: 'hi' })) }, 'STORY_TOO_LONG');
  invalid({ chatMessages: Array.from({ length: 20 }, () => ({ sender: 'user', text: 'x'.repeat(3000) })) }, 'STORY_TOO_LONG');
  assert.equal(validateComment('  hello  '), 'hello');
  assert.equal(Array.from(validateComment('😀'.repeat(300))).length, 300);
  for (const value of ['', '   ', 'x'.repeat(301), '😀'.repeat(301), 'hi\u0000', {}]) assert.throws(() => validateComment(value), /INVALID_COMMENT/);

  const { createCommunityHandler } = load('supabase/functions/community/handler.ts');
  let calls = [], dbError = null;
  const handler = createCommunityHandler({ assets, authenticate: async token => token === 'valid' ? 'trusted-actor' : null, rpc: async (...args) => { calls.push(args); return { data: { ok: true }, error: dbError }; } });
  const invoke = (action, data = {}, token = 'valid') => handler(new Request('https://example.com', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ action, data }) }));
  assert.equal((await invoke('publish', sample, 'invalid')).status, 401);
  assert.equal(calls.length, 0);
  assert.equal((await invoke('publish', { ...sample, author: 'forged' })).status, 200);
  assert.equal(calls[0][0], 'trusted-actor'); assert.deepEqual(calls[0][2], sample);
  assert.equal((await invoke('publish', { ...sample, script: 'invalid' })).status, 400);
  assert.equal(calls.length, 1);
  assert.equal((await invoke('publish', fubuki)).status, 200);
  assert.equal(calls.at(-1)[2].character, '후부키', 'Edge validation accepts Fubuki before forwarding to PostgreSQL');
  assert.equal((await invoke('list', { character: '후부키' })).status, 200);
  assert.equal((await invoke('publish', kei)).status, 200);
  assert.equal(calls.at(-1)[2].character, '케이');
  assert.equal((await invoke('list', { character: '케이' })).status, 200);
  assert.equal((await invoke('publish', koyuki)).status, 200);
  assert.equal(calls.at(-1)[2].character, '코유키');
  assert.equal((await invoke('list', { character: '코유키' })).status, 200);
  assert.equal((await invoke('list', { offset: -1 })).status, 400);
  assert.equal((await invoke('list', { query: {} })).status, 400);
  for (const character of [null, {}, ['호시노'], 'x'.repeat(101)]) assert.equal((await invoke('list', { character })).status, 400);
  assert.equal((await invoke('list', { character: ' 호시노 ' })).status, 200);
  assert.equal(calls.at(-1)[2].character, '호시노');
  assert.equal((await invoke('list', { liked: 'true' })).status, 400);
  for (const mine of ['true', null, 1, {}]) assert.equal((await invoke('list', { mine })).status, 400);
  assert.equal((await invoke('list', { mine: true, author: 'forged', actor: 'forged' })).status, 200);
  assert.equal(calls.at(-1)[0], 'trusted-actor', 'my-post ownership always uses verified authentication');
  assert.equal(calls.at(-1)[2].mine, true);
  assert.equal('author' in calls.at(-1)[2], false);
  assert.equal('actor' in calls.at(-1)[2], false);
  for (const period of ['invalid', ['day'], {}, null]) assert.equal((await invoke('list', { period })).status, 400);
  for (const period of ['all', 'day', 'week', 'month', 'year']) {
    assert.equal((await invoke('list', { period })).status, 200);
    assert.equal(calls.at(-1)[2].period, period);
  }
  assert.equal((await invoke('like', { id: 'invalid', liked: true })).status, 400);
  assert.equal((await invoke('like', { id: '11111111-1111-4111-8111-111111111111', liked: 'false' })).status, 400);
  assert.equal((await invoke('comment', { id: '11111111-1111-4111-8111-111111111111', body: 'x'.repeat(301) })).status, 400);
  const giant = await handler(new Request('https://example.com', { method: 'POST', headers: { Authorization: 'Bearer valid' }, body: ' '.repeat(350001) }));
  assert.equal(giant.status, 400);
  dbError = { message: 'RATE_LIMIT' }; assert.equal((await invoke('list')).status, 429);
  dbError = { message: 'NOT_FOUND' }; assert.equal((await invoke('list')).status, 404);
  dbError = { message: 'private internal database details' };
  assert.deepEqual(await (await invoke('list')).json(), { error: 'SERVER_ERROR' });
  assert.equal((await handler(new Request('https://example.com', { method: 'OPTIONS' }))).status, 204);

  const db = await PGlite.create();
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls; create schema auth; create table auth.users(id uuid primary key);`);
    await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/202610180001_community.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/202610180002_community_rankings.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/202610190001_community_comment_counts.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/202610200001_add_mari.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/202610200002_community_preview_backgrounds.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/202610200003_fix_community_preview_backgrounds.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/202610210001_community_character_filter.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/202610210002_community_pagination.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/202610210003_add_fubuki.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/202610220001_add_kei.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/202610240001_community_republish.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/202610240002_add_koyuki.sql'), 'utf8'));
    await db.exec(fs.readFileSync(path.join(root, 'supabase/migrations/202610250001_community_my_posts.sql'), 'utf8'));
    const actor = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
    await db.query('insert into auth.users values($1),($2)', [actor, other]);
    await db.query("insert into public.community_posts(author, client_id, title, character, script) values($1, 'mari-migration-check', 'Mari', '마리', 'test')", [actor]);
    await db.query("delete from public.community_posts where client_id = 'mari-migration-check'");
    const rpc = async (action, data = {}, user = actor) => (action === 'list'
      ? await db.query('select public.community_list($1::uuid, $2::jsonb) as result', [user, JSON.stringify(data)])
      : await db.query('select public.community_api($1::uuid, $2::text, $3::jsonb) as result', [user, action, JSON.stringify(data)])).rows[0].result;
    const koyukiActor = '99999999-9999-4999-8999-999999999999';
    await db.query('insert into auth.users values($1)', [koyukiActor]);
    const koyukiPost = await rpc('publish', koyuki, koyukiActor);
    assert.ok(koyukiPost.id);
    const koyukiPage = await rpc('list', { character: '코유키', pagination: true }, koyukiActor);
    assert.equal(koyukiPage.total, 1);
    assert.equal(koyukiPage.posts[0].character, '코유키');
    assert.equal((await rpc('detail', { id: koyukiPost.id }, koyukiActor)).script, koyuki.script);
    await rpc('deletePost', { id: koyukiPost.id }, koyukiActor);
    // Publish, filter and read Fubuki through the real SQL API as a separate actor.
    const fubukiPost = await rpc('publish', fubuki, other);
    assert.ok(fubukiPost.id);
    const fubukiPage = await rpc('list', { character: '후부키', pagination: true }, other);
    assert.equal(fubukiPage.total, 1);
    assert.equal(fubukiPage.posts[0].character, '후부키');
    assert.equal((await rpc('detail', { id: fubukiPost.id }, other)).script, fubuki.script);
    await rpc('deletePost', { id: fubukiPost.id }, other);
    await db.query('delete from public.community_limits where actor = $1', [other]);
    const keiPost = await rpc('publish', kei, other);
    assert.ok(keiPost.id);
    const keiPage = await rpc('list', { character: '케이', pagination: true }, other);
    assert.equal(keiPage.total, 1);
    assert.equal(keiPage.posts[0].character, '케이');
    assert.equal((await rpc('detail', { id: keiPost.id }, other)).script, kei.script);
    await rpc('deletePost', { id: keiPost.id }, other);
    await db.query('delete from public.community_limits where actor = $1', [other]);
    await db.query("insert into public.community_posts(author, client_id, title, character, script) values($1, 'preview-check', 'Preview fixture', '호시노', E'title : Preview fixture\\nbg : BG_First.jpg\\n호시노 : hi [bg : BG_Second.jpg]')", [actor]);
    assert.equal((await rpc('list', { query: 'Preview fixture' }))[0].preview_bg, 'BG_First', 'standalone background commands use the first asset');
    await db.query("delete from public.community_posts where client_id = 'preview-check'");
    await db.query("insert into public.community_posts(author, client_id, title, character, script) select $1, 'filter-' || i, 'Filter fixture ' || i, case when i <= 21 then '호시노' else '히나' end, 'test' from generate_series(1, 23) i", [actor]);
    assert.equal((await rpc('list', { query: 'Filter fixture' })).length, 20);
    const firstPage = await rpc('list', { query: 'Filter fixture', pagination: true });
    assert.equal(firstPage.total, 23); assert.equal(firstPage.posts.length, 20);
    const lastPage = await rpc('list', { query: 'Filter fixture', pagination: true, offset: 20 });
    assert.equal(lastPage.total, 23); assert.equal(lastPage.posts.length, 3);
    assert.equal(new Set([...firstPage.posts, ...lastPage.posts].map(p => p.id)).size, 23);
    const emptyPage = await rpc('list', { query: 'Filter fixture', character: '마리', pagination: true });
    assert.deepEqual(emptyPage, { total: 0, posts: [] });
    const hinaPage = await rpc('list', { query: 'Filter fixture', character: '히나', pagination: true });
    assert.equal(hinaPage.total, 2); assert.equal(hinaPage.posts.length, 2);
    const filteredHina = await rpc('list', { query: 'Filter fixture', character: '히나' });
    assert.equal(filteredHina.length, 2, 'character filter applies before pagination');
    assert.ok(filteredHina.every(post => post.character === '히나'));
    assert.equal((await rpc('list', { query: 'Filter fixture', character: '호시노', offset: 20 })).length, 1);
    assert.equal((await rpc('list', { query: 'Filter fixture', character: '마리' })).length, 0);
    assert.equal((await rpc('list', { query: 'Filter fixture', character: '히나', sort: 'popular', period: 'day' })).length, 2);
    await db.query('insert into public.community_likes(post_id, actor) values($1, $2)', [filteredHina[0].id, actor]);
    assert.equal((await rpc('list', { query: 'Filter fixture', character: '히나', liked: true })).length, 1);
    assert.equal((await rpc('list', { query: 'Filter fixture', character: '호시노', liked: true })).length, 0);
    await db.query("delete from public.community_posts where client_id like 'filter-%'");
    const cooldown = async (action, user = actor) => db.query("update public.community_limits set last_at = now() - interval '2 minutes' where actor = $1 and action = $2", [user, action]);
    const first = await rpc('publish', sample);
    assert.ok(first.id);
    assert.equal((await rpc('publish', sample)).alreadyPublished, true);
    await assert.rejects(() => rpc('publish', { ...sample, clientId: 'two' }), /RATE_LIMIT/);
    for (let i = 2; i <= 5; i++) { await cooldown('publish'); await rpc('publish', { ...sample, clientId: `story-${i}` }); }
    await cooldown('publish');
    await assert.rejects(() => rpc('publish', { ...sample, clientId: 'six' }), /RATE_LIMIT/);
    const list = await rpc('list');
    assert.equal(list.length, 5); assert.equal(list[0].is_mine, true);
    assert.ok(list.every(post => post.comment_count === 0), 'posts without comments report zero');
    assert.ok(list.every(post => post.preview_bg === 'BG_AbydosCouncilRoom'), 'cards expose the first script background without exposing the script');
    assert.equal('author' in list[0], false); assert.equal('script' in list[0], false);
    await assert.rejects(() => rpc('deletePost', { id: first.id }, other), /NOT_FOUND/);
    await rpc('like', { id: first.id, liked: true }); await cooldown('like'); await rpc('like', { id: first.id, liked: true });
    assert.equal((await rpc('detail', { id: first.id })).likes, 1);
    assert.equal((await rpc('list', { liked: true })).length, 1);
    await rpc('view', { id: first.id }); await rpc('view', { id: first.id });
    assert.equal((await rpc('detail', { id: first.id })).views, 1);
    await rpc('view', { id: first.id }, other);
    assert.equal((await rpc('detail', { id: first.id })).views, 2);
    const simultaneous = await Promise.allSettled([rpc('publish', { ...sample, clientId: 'concurrent-a' }, other), rpc('publish', { ...sample, clientId: 'concurrent-b' }, other)]);
    assert.equal(simultaneous.filter(result => result.status === 'fulfilled').length, 1, 'simultaneous requests share the DB quota row');
    let commentId;
    for (let i = 0; i < 10; i++) { await cooldown('comment'); const result = await rpc('comment', { id: first.id, body: 'hi' }); commentId = result.id; }
    await cooldown('comment');
    await assert.rejects(() => rpc('comment', { id: first.id, body: 'eleventh' }), /RATE_LIMIT/);
    const detail = await rpc('detail', { id: first.id });
    assert.equal(detail.comments.length, 10); assert.equal('author' in detail.comments[0], false);
    assert.equal((await rpc('list')).find(post => post.id === first.id).comment_count, 10);
    assert.equal((await rpc('list', { liked: true, sort: 'popular', period: 'day' })).find(post => post.id === first.id).comment_count, 10);
    await assert.rejects(() => rpc('deleteComment', { id: first.id, commentId }, other), /NOT_FOUND/);
    await rpc('deleteComment', { id: first.id, commentId });
    assert.equal((await rpc('list')).find(post => post.id === first.id).comment_count, 9, 'deleting comments updates card totals');
    await assert.rejects(() => rpc('comment', { id: first.id, body: 'after deletion' }), /RATE_LIMIT/);
    await rpc('like', { id: first.id, liked: true }, other);
    assert.equal((await rpc('detail', { id: first.id })).likes, 2);
    await db.query("insert into public.community_comments(post_id, author, body) select $1, $2, 'Pagination fixture' from generate_series(1, 31)", [first.id, other]);
    assert.equal((await rpc('detail', { id: first.id })).comments.length, 30);
    assert.equal((await rpc('list')).find(post => post.id === first.id).comment_count, 40, 'card totals include comments beyond the first detail page');
    await db.query('delete from auth.users where id = $1', [other]);
    assert.equal((await rpc('detail', { id: first.id })).likes, 1, 'Auth cleanup cascades must not leave inflated likes');
    assert.equal((await rpc('list')).find(post => post.id === first.id).comment_count, 9, 'account cleanup must not leave inflated comment counts');
    await rpc('deletePost', { id: first.id });
    await assert.rejects(() => rpc('publish', { ...sample, clientId: 'after-deletion' }), /RATE_LIMIT/);
    // Re-publish an existing source without replacing its public identity or reactions.
    const editor = '55555555-5555-4555-8555-555555555555';
    await db.query('insert into auth.users values($1)', [editor]);
    const original = await rpc('publish', { ...sample, clientId: 'editable' }, editor);
    await cooldown('like');
    await rpc('like', { id: original.id, liked: true });
    await rpc('view', { id: original.id });
    await cooldown('comment');
    await db.query("insert into public.community_comments(post_id, author, body) values($1, $2, 'Keep this comment')", [original.id, actor]);
    const beforeUpdate = await rpc('detail', { id: original.id }, editor);
    await assert.rejects(() => rpc('publish', { ...sample, clientId: 'editable', title: 'Changed' }, editor), /RATE_LIMIT/);
    await cooldown('publish', editor);
    const changed = { ...sample, clientId: 'editable', title: 'Edited title', script: sample.script.replace('Hello', 'Edited dialogue'), chatMessages: [] };
    const updated = await rpc('publish', changed, editor);
    assert.equal(updated.id, original.id); assert.equal(updated.updated, true);
    const afterUpdate = await rpc('detail', { id: original.id }, editor);
    assert.equal(afterUpdate.title, changed.title); assert.equal(afterUpdate.script, changed.script);
    assert.deepEqual(afterUpdate.chat_messages, [], 'story-only republication removes previously shared chat');
    for (const key of ['id', 'created_at', 'likes', 'views', 'comments']) assert.deepEqual(afterUpdate[key], beforeUpdate[key], key + ' survives republication');
    assert.equal((await rpc('publish', changed, editor)).alreadyPublished, true, 'identical retry is a no-op even during cooldown');
    const usage = await db.query("select used from public.community_limits where actor = $1 and action = 'publish'", [editor]);
    assert.equal(usage.rows[0].used, 2, 'only real changes consume publication quota');
    const stranger = '66666666-6666-4666-8666-666666666666';
    await db.query('insert into auth.users values($1)', [stranger]);
    const otherSource = await rpc('publish', { ...changed, title: 'Other owner' }, stranger);
    assert.notEqual(otherSource.id, original.id, 'same client ID owned by a different actor never overwrites the original');
    assert.equal((await rpc('detail', { id: original.id }, editor)).title, 'Edited title');
    await cooldown('publish', editor);
    const simultaneousSameSource = await Promise.all([rpc('publish', { ...sample, clientId: 'same-source' }, editor), rpc('publish', { ...sample, clientId: 'same-source' }, editor)]);
    assert.equal(simultaneousSameSource[0].id, simultaneousSameSource[1].id, 'concurrent first publications keep one post');
    assert.equal(simultaneousSameSource.filter(item => item.alreadyPublished).length, 1);
    await db.query('delete from public.community_posts where author = $1 or id = $2', [editor, otherSource.id]);
    // A new Korea date restores quota, while yesterday's usage remains recorded until cleanup.
    await db.query("update public.community_limits set day = day - 1, last_at = now() - interval '2 minutes' where actor = $1", [actor]);
    const next = await rpc('publish', { ...sample, clientId: 'tomorrow' }); assert.ok(next.id);
    await db.exec('set role service_role');
    assert.equal((await rpc('detail', { id: next.id })).id, next.id, 'Edge Function role can execute the API');
    await db.exec('reset role');
    await db.exec('set role authenticated');
    await assert.rejects(() => db.query('select * from public.community_posts'), /permission denied/);
    await assert.rejects(() => rpc('list'), /permission denied/);
    await assert.rejects(() => db.query('select public.community_take_quota($1, $2, 100, 0)', [actor, 'publish']), /permission denied/);
    await db.exec('reset role; set role anon');
    await assert.rejects(() => db.query('select * from public.community_comments'), /permission denied/);
    await db.exec('reset role');
    await db.query("insert into public.community_limits values($1, current_date - 10, 'stale', 1, now())", [actor]);
    await db.query('select public.community_cleanup()');
    assert.equal((await db.query("select count(*)::int as n from public.community_limits where action = 'stale'")).rows[0].n, 0);
    // Rank by when likes were received, not when posts were created or their all-time totals.
    const likers = Array.from({ length: 5 }, (_, index) => `33333333-3333-4333-8333-33333333333${index}`);
    for (const liker of likers) await db.query('insert into auth.users values($1)', [liker]);
    const rankedPosts = [];
    for (const [index, age] of [[0, '2 years'], [1, '0 seconds']]) {
      const result = await db.query("insert into public.community_posts(author, client_id, title, character, script, created_at) values($1, $2, $3, '호시노', 'test', now() - $4::interval) returning id", [actor, `ranking-${index}`, `Ranking fixture ${index}`, age]);
      rankedPosts.push(result.rows[0].id);
    }
    for (let index = 0; index < likers.length; index++) await db.query('insert into public.community_likes(post_id, actor) values($1, $2)', [rankedPosts[index < 2 ? 0 : 1], likers[index]]);
    for (const period of ['day', 'week', 'month', 'year']) {
      await db.query("update public.community_likes set created_at = (date_trunc($1, now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') + case when post_id = $2::uuid then interval '0 seconds' else interval '-1 second' end where post_id in ($2::uuid, $3::uuid)", [period, ...rankedPosts]);
      const periodRows = await rpc('list', { sort: 'popular', period, query: 'Ranking fixture' });
      assert.equal(periodRows[0].id, rankedPosts[0], `${period}: old post with new likes outranks new post with old likes`);
      assert.equal(periodRows[0].period_likes, 2, `${period}: exact Korea boundary included`);
      assert.equal(periodRows[1].period_likes, 0, `${period}: one second before boundary excluded`);
      const allRows = await rpc('list', { sort: 'popular', period: 'all', query: 'Ranking fixture' });
      assert.equal(allRows[0].id, rankedPosts[1]); assert.equal(allRows[0].period_likes, 3);
      const likedRows = await rpc('list', { sort: 'popular', period, liked: true, query: 'Ranking fixture' }, likers[0]);
      assert.equal(likedRows.length, 1); assert.equal(likedRows[0].id, rankedPosts[0]);
      const page = await rpc('list', { sort: 'popular', period, query: 'Ranking fixture', offset: 1 });
      assert.equal(page.length, 1); assert.equal(page[0].id, rankedPosts[1]);
      const latest = await rpc('list', { sort: 'latest', period, query: 'Ranking fixture' });
      assert.equal(latest[0].id, rankedPosts[1], 'period does not affect latest order');
    }
    const week = (await db.query("select extract(isodow from date_trunc('week', now() at time zone 'Asia/Seoul'))::int as day")).rows[0].day;
    assert.equal(week, 1, 'weekly periods start on Monday in Korea');
    // Older own posts must be found even when newer foreign posts fill the first page.
    await db.query('insert into auth.users values($1) on conflict do nothing', [other]);
    await db.query(`insert into public.community_posts(author, client_id, title, character, script, created_at)
      select $1, 'mine-fixture-' || n, 'Mine fixture own ' || n,
        case when n <= 12 then '호시노' else '히나' end, 'test', now() - interval '1 day'
      from generate_series(1, 23) n`, [actor]);
    await db.query(`insert into public.community_posts(author, client_id, title, character, script)
      select $1, 'mine-fixture-other-' || n, 'Mine fixture foreign ' || n, '호시노', 'test'
      from generate_series(1, 22) n`, [other]);
    const mineQuery = { mine: true, pagination: true, query: 'Mine fixture' };
    const allFixtures = await rpc('list', { pagination: true, query: 'Mine fixture' });
    assert.equal(allFixtures.total, 45);
    assert.ok(allFixtures.posts.every(post => !post.is_mine));
    const mineFirst = await rpc('list', mineQuery);
    assert.equal(mineFirst.total, 23); assert.equal(mineFirst.posts.length, 20);
    assert.ok(mineFirst.posts.every(post => post.is_mine));
    assert.ok(mineFirst.posts.every(post => !('author' in post)));
    const mineSecond = await rpc('list', { ...mineQuery, offset: 20 });
    assert.equal(mineSecond.total, 23); assert.equal(mineSecond.posts.length, 3);
    assert.ok(mineSecond.posts.every(post => !mineFirst.posts.some(first => first.id === post.id)));
    assert.equal((await rpc('list', { ...mineQuery, character: '호시노', sort: 'popular', period: 'day' })).total, 12);
    assert.equal((await rpc('list', { ...mineQuery, query: 'Mine fixture foreign' })).total, 0);
    assert.equal((await rpc('list', mineQuery, other)).total, 22, 'another actor sees only their own posts');
    assert.equal((await rpc('list', mineQuery, likers[0])).total, 0);
    await rpc('deletePost', { id: mineFirst.posts[0].id });
    assert.equal((await rpc('list', mineQuery)).total, 22, 'deletion updates my-post totals');
    await assert.rejects(() => rpc('list', { period: 'invalid' }), /INVALID_REQUEST/);
  } finally { await db.close(); }
  console.log('PASS strict story/comment validation, HTTP token verification/body bounds, PostgreSQL migration/RLS/grants, quotas/cooldowns/deletion/day reset, idempotent publishing/likes/views, private author IDs and cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; });
