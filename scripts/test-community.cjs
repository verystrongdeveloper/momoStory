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
  assert.equal((await invoke('list', { offset: -1 })).status, 400);
  assert.equal((await invoke('list', { query: {} })).status, 400);
  assert.equal((await invoke('list', { liked: 'true' })).status, 400);
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
    const actor = '11111111-1111-4111-8111-111111111111', other = '22222222-2222-4222-8222-222222222222';
    await db.query('insert into auth.users values($1),($2)', [actor, other]);
    await db.query("insert into public.community_posts(author, client_id, title, character, script) values($1, 'mari-migration-check', 'Mari', '마리', 'test')", [actor]);
    await db.query("delete from public.community_posts where client_id = 'mari-migration-check'");
    const rpc = async (action, data = {}, user = actor) => (action === 'list'
      ? await db.query('select public.community_list($1::uuid, $2::jsonb) as result', [user, JSON.stringify(data)])
      : await db.query('select public.community_api($1::uuid, $2::text, $3::jsonb) as result', [user, action, JSON.stringify(data)])).rows[0].result;
    await db.query("insert into public.community_posts(author, client_id, title, character, script) values($1, 'preview-check', 'Preview fixture', '호시노', E'title : Preview fixture\\nbg : BG_First.jpg\\n호시노 : hi [bg : BG_Second.jpg]')", [actor]);
    assert.equal((await rpc('list', { query: 'Preview fixture' }))[0].preview_bg, 'BG_First', 'standalone background commands use the first asset');
    await db.query("delete from public.community_posts where client_id = 'preview-check'");
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
    await assert.rejects(() => rpc('list', { period: 'invalid' }), /INVALID_REQUEST/);
  } finally { await db.close(); }
  console.log('PASS strict story/comment validation, HTTP token verification/body bounds, PostgreSQL migration/RLS/grants, quotas/cooldowns/deletion/day reset, idempotent publishing/likes/views, private author IDs and cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; });
