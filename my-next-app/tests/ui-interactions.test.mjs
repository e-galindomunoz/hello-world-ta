/* Component event tests without a browser or service credentials.
 * The small hook adapter exposes renders around deferred server responses;
 * no application handlers or server actions are copied into the tests. */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';
import React from 'react';
import * as jsxRuntime from 'react/jsx-runtime';

function mount(file, name, props, dependencies = {}) {
  const slots = [];
  let cursor = 0;
  const tasks = [];
  const hooks = {
    ...React,
    useState(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === 'function' ? initial() : initial;
      return [slots[index], value => { slots[index] = typeof value === 'function' ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: initial };
      return slots[index];
    },
    useActionState(action, initial) {
      const [state, setState] = hooks.useState(initial);
      const [pending, setPending] = hooks.useState(false);
      return [state, async data => {
        setPending(true);
        try { setState(await action(state, data)); } finally { setPending(false); }
      }, pending];
    },
    useEffect() {},
    useId() { return 'test-description'; },
    useTransition() {
      const [pending, setPending] = hooks.useState(false);
      return [pending, callback => {
        setPending(true);
        tasks.push(Promise.resolve(callback()).finally(() => setPending(false)));
      }];
    },
  };
  const componentModule = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    module: componentModule, exports: componentModule.exports, URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    crypto: { randomUUID: () => 'test-photo' },
    require(id) {
      if (id === 'react') return hooks;
      if (id === 'react/jsx-runtime') return jsxRuntime;
      if (id.endsWith('.module.css')) return { default: new Proxy({}, { get: (_, key) => key }) };
      if (id === 'next/link') return { __esModule: true, default: 'a' };
      if (id === '@/components/icons') return { Icon: () => null, BrandMark: () => null };
      if (id in dependencies) return dependencies[id];
      throw new Error(`Unexpected dependency: ${id}`);
    },
  }, { filename: file });
  return {
    render() { cursor = 0; return componentModule.exports[name](props); },
    async settle() { await Promise.all(tasks.splice(0)); },
  };
}
function nodes(tree) {
  if (!tree || typeof tree !== 'object') return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
function text(tree) {
  if (tree == null || typeof tree === 'boolean') return '';
  if (Array.isArray(tree)) return tree.map(text).join('');
  if (typeof tree === 'object') return text(tree.props?.children);
  return String(tree);
}
function find(tree, predicate) {
  const result = nodes(tree).find(predicate);
  assert.ok(result, 'Expected UI element exists');
  return result;
}
const button = (tree, label) => find(tree, n => n.type === 'button' && (n.props['aria-label'] === label || text(n).includes(label)));
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function voteHarness(status = 'ready', initialVote = null) {
  const calls = [];
  const responses = [];
  const view = mount('components/feed-vote-controls.tsx', 'FeedVoteControls', {
    generationId: 'post-1', score: 7, initialVote, status, retryHref: '/feed#post-1',
  }, { '@/app/feed/vote-actions': { setVote(id, value) {
    const response = deferred(); calls.push({ id, value }); responses.push(response); return response.promise;
  } } });
  return { view, calls, responses };
}

test('public votes wait for confirmation, switch, clear, and never calculate an optimistic score', async () => {
  const { view, calls, responses } = voteHarness();
  for (const [label, desired] of [['Upvote', 1], ['Downvote', -1], ['Downvote', null]]) {
    const previous = button(view.render(), label).props['aria-pressed'];
    button(view.render(), label).props.onClick();
    assert.equal(calls.at(-1).value, desired);
    assert.equal(button(view.render(), label).props['aria-pressed'], previous);
    assert.equal(button(view.render(), label).props.disabled, true);
    // The ref also guards duplicate events before the next render.
    const count = calls.length;
    button(view.render(), label).props.onClick();
    assert.equal(calls.length, count);
    responses.at(-1).resolve({ ok: true, value: desired });
    await view.settle();
    assert.equal(button(view.render(), label).props['aria-pressed'], desired !== null);
    assert.ok(nodes(view.render()).some(n => n.props?.['aria-label'] === '7 points'));
  }
});

test('anonymous votes ask for sign-in and failed vote loads block writes', () => {
  const anon = voteHarness('anonymous');
  button(anon.view.render(), 'Upvote').props.onClick();
  assert.equal(anon.calls.length, 0);
  assert.ok(nodes(anon.view.render()).some(n => n.props?.href === '/login'));
  const failed = voteHarness('error');
  assert.equal(button(failed.view.render(), 'Upvote').props.disabled, true);
  assert.ok(nodes(failed.view.render()).some(n => n.props?.href === '/feed#post-1'));
});

test('uncertain public vote keeps the confirmed selection and requires reload', async () => {
  const { view, responses } = voteHarness('ready', 1);
  button(view.render(), 'Downvote').props.onClick();
  responses[0].resolve({ ok: false, code: 'uncertain', message: 'Reload required.' });
  await view.settle();
  assert.equal(button(view.render(), 'Upvote').props['aria-pressed'], true);
  assert.equal(button(view.render(), 'Downvote').props.disabled, true);
  assert.match(text(view.render()), /Reload required/);
});

/* The real shared helper with only the browser decoder/encoder mocked, so the
 * integration tests below exercise the same preparation path both pickers use. */
const JPEG_BYTES = [0xff, 0xd8, 0xff, 0xd9];
function sharedImageUpload() {
  const decoded = [];
  const helper = { exports: {} };
  const source = ts.transpileModule(fs.readFileSync('lib/image-upload.ts', 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  vm.runInNewContext(source, {
    module: helper, exports: helper.exports, File, Blob, Uint8Array, DataView,
    createImageBitmap: async (file, options) => { decoded.push({ file, options }); return { width: 4032, height: 3024, close() {} }; },
    document: { createElement: () => ({ width: 0, height: 0,
      getContext: () => ({ fillRect() {}, drawImage() {} }),
      toBlob: (callback, type, quality) => callback(new Blob([new Uint8Array(JPEG_BYTES)], { type, quality })) }) },
    require: id => { throw new Error(`Fallback codec should not load: ${id}`); },
  });
  return { module: helper.exports, decoded };
}
function iphoneHeic(name = 'IMG_4521.HEIC') {
  const header = Buffer.alloc(24);
  header.writeUInt32BE(24); header.write('ftyp', 4); header.write('heic', 8); header.write('mif1', 16); header.write('heic', 20);
  return new File([header, new Uint8Array(64)], name, { type: 'image/heic' });
}

const ready = { state: 'ready', used: false, resetsAt: '2026-10-08T04:00:00Z' };
function createHarness(status = ready, prepare = async file => file, imageUpload) {
  const generation = deferred();
  const feedback = [];
  const calls = [];
  const uploads = [];
  const view = mount('components/generation-image-upload.tsx', 'GenerationImageUpload', { initialDailyStatus: status }, {
    '@/lib/image-upload': imageUpload ?? { IMAGE_UPLOAD_ACCEPT: 'image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif', ImageUploadError: Error, prepareImageUpload: prepare },
    '@/app/dashboard/generation-actions': {
      checkGenerationAvailability: async () => ready,
      generateCaption: () => generation.promise,
    },
    '@/app/dashboard/feedback-actions': { submitCreatorFeedback(id, rating) {
      const response = deferred(); calls.push({ id, rating }); feedback.push(response); return response.promise;
    } },
    '@/lib/supabase/client': { createClient: () => ({
      auth: { getUser: async () => ({ data: { user: { id: 'creator' } } }) },
      storage: { from: () => ({ upload: async (path, file, options) => { uploads.push({ path, file, options }); return { data: { path } }; } }) },
    }) },
  });
  return { view, generation, feedback, calls, uploads };
}
async function reachGenerating(view) {
  await find(view.render(), n => n.type === 'input').props.onChange({ currentTarget: { files: [{ type: 'image/png', size: 100, name: 'photo.png' }], value: 'photo.png' } });
  await button(view.render(), 'Upload this one').props.onClick();
  assert.match(text(view.render()), /Google Gemini/);
  assert.match(text(view.render()), /publish to the public feed/);
  button(view.render(), 'Caption & post').props.onClick();
}

test('create presents ready, preview, generating, and confirmed reveal scenes', async () => {
  const { view, generation } = createHarness();
  assert.equal(view.render().props['data-scene'], 'ready');
  assert.equal(nodes(view.render()).filter(n => n.type === 'button').length, 1);
  await reachGenerating(view);
  assert.equal(view.render().props['data-scene'], 'generating');
  assert.match(text(view.render()), /Bet, let’s cook sum up frs/);
  assert.doesNotMatch(text(view.render()), /Caption & post|Choose a different/);
  generation.resolve({ ok: true, generation: { id: 'made-1', caption: 'A confirmed caption.' }, dailyStatus: { ...ready, used: true } });
  await view.settle();
  assert.equal(view.render().props['data-scene'], 'result');
  assert.match(text(view.render()), /A confirmed caption/);
  assert.match(text(view.render()), /Did we get your humor right/);
  assert.doesNotMatch(text(view.render()), /enough foolishness/);
});

test('private feedback confirms like, switch, clear and locks after an uncertain save', async () => {
  const { view, generation, feedback, calls } = createHarness();
  await reachGenerating(view);
  generation.resolve({ ok: true, generation: { id: 'made-1', caption: 'Caption.' } });
  await view.settle();
  for (const [label, rating] of [['That’s so me', 1], ['Not my humor', -1], ['Not my humor', null]]) {
    const previous = button(view.render(), label).props['aria-pressed'];
    button(view.render(), label).props.onClick();
    assert.equal(calls.at(-1).rating, rating);
    assert.equal(button(view.render(), label).props['aria-pressed'], previous);
    assert.equal(button(view.render(), label).props.disabled, true);
    feedback.at(-1).resolve({ ok: true, rating });
    await view.settle();
    assert.equal(button(view.render(), label).props['aria-pressed'], rating !== null);
  }
  button(view.render(), 'That’s so me').props.onClick();
  feedback.at(-1).resolve({ ok: false, code: 'uncertain', message: 'Reload first.' });
  await view.settle();
  assert.equal(button(view.render(), 'That’s so me').props.disabled, true);
  assert.equal(button(view.render(), 'That’s so me').props['aria-pressed'], undefined);
  assert.match(text(view.render()), /Reload first/);
});

test('daily limit is a standalone scene; unknown availability can recover', async () => {
  const limited = createHarness({ ...ready, used: true });
  assert.equal(limited.view.render().props['data-scene'], 'limit');
  assert.match(text(limited.view.render()), /That’s enough foolishness for today/);
  assert.equal(nodes(limited.view.render()).filter(n => n.type === 'input').length, 0);
  const unknown = createHarness({ state: 'unknown' });
  await button(unknown.view.render(), 'Check availability').props.onClick();
  assert.doesNotMatch(text(unknown.view.render()), /Couldn’t check/);
});

test('interrupted generation never reveals an unconfirmed caption', async () => {
  const { view, generation } = createHarness();
  await reachGenerating(view);
  generation.resolve({ ok: false, message: 'Saving could not be confirmed.', dailyStatus: { state: 'unknown' } });
  await view.settle();
  assert.equal(view.render().props['data-scene'], 'preview');
  assert.equal(button(view.render(), 'Caption & post').props.disabled, true);
  assert.match(text(view.render()), /Saving could not be confirmed/);
  assert.equal(nodes(view.render()).filter(n => n.props?.['aria-label'] === 'Private creator feedback').length, 0);
});

test('generation waits for preparation, previews/uploads the JPEG, and ignores an older selection', async () => {
  const first = deferred(); const second = deferred(); const preparedFiles = [];
  const { view, uploads } = createHarness(ready, file => {
    preparedFiles.push(file);
    return preparedFiles.length === 1 ? first.promise : second.promise;
  });
  const select = file => find(view.render(), n => n.type === 'input').props.onChange({ currentTarget: { files: [file], value: 'photo.heic' } });
  const oldRequest = select({ name: 'old.heic' });
  assert.equal(find(view.render(), n => n.type === 'input').props.disabled, true);
  assert.match(text(view.render()), /Preparing your photo/);
  assert.equal(uploads.length, 0);
  const newRequest = select({ name: 'new.heif' });
  const converted = { name: 'new.jpg', type: 'image/jpeg', size: 100 };
  second.resolve(converted); await newRequest;
  first.resolve({ name: 'old.jpg', type: 'image/jpeg', size: 100 }); await oldRequest;
  await button(view.render(), 'Upload this one').props.onClick();
  assert.equal(uploads.length, 1); assert.equal(uploads[0].file, converted);
  assert.equal(uploads[0].options.contentType, 'image/jpeg');
  assert.match(uploads[0].path, /\.jpg$/);
});

test('failed image preparation leaves generation without an uploadable selection', async () => {
  const { view, uploads } = createHarness(ready, async () => { throw new Error('Conversion failed.'); });
  await find(view.render(), n => n.type === 'input').props.onChange({ currentTarget: { files: [{ name: 'bad.heic' }], value: '' } });
  assert.equal(view.render().props['data-scene'], 'ready');
  assert.equal(find(view.render(), n => n.type === 'input').props.disabled, false);
  assert.match(text(view.render()), /Conversion failed/); assert.equal(uploads.length, 0);
});

test('generation upload runs the shared helper: HEIC uploads as converted JPEG, PNG passes through untouched', async () => {
  const shared = sharedImageUpload();
  const { view, uploads } = createHarness(ready, undefined, shared.module);
  const input = () => find(view.render(), n => n.type === 'input');
  assert.equal(input().props.accept, shared.module.IMAGE_UPLOAD_ACCEPT);
  assert.match(input().props.accept, /image\/heic/); assert.match(input().props.accept, /\.heif/);
  const heic = iphoneHeic();
  await input().props.onChange({ currentTarget: { files: [heic], value: 'IMG_4521.HEIC' } });
  assert.equal(view.render().props['data-scene'], 'preview');
  assert.equal(shared.decoded.length, 1); assert.equal(shared.decoded[0].file, heic);
  assert.equal(shared.decoded[0].options.imageOrientation, 'from-image');
  await button(view.render(), 'Upload this one').props.onClick();
  const [upload] = uploads;
  assert.notEqual(upload.file, heic);
  assert.equal(upload.file.name, 'IMG_4521.jpg'); assert.equal(upload.file.type, 'image/jpeg');
  assert.equal(upload.options.contentType, 'image/jpeg'); assert.match(upload.path, /^creator\/test-photo\.jpg$/);
  assert.deepEqual([...new Uint8Array(await upload.file.arrayBuffer())], JPEG_BYTES);

  const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'shot.png', { type: 'image/png' });
  const second = createHarness(ready, undefined, sharedImageUpload().module);
  await find(second.view.render(), n => n.type === 'input').props.onChange({ currentTarget: { files: [png], value: 'shot.png' } });
  await button(second.view.render(), 'Upload this one').props.onClick();
  assert.equal(second.uploads[0].file, png); assert.match(second.uploads[0].path, /\.png$/);
});

test('generation upload through the shared helper rejects unsupported files before any upload', async () => {
  const { view, uploads } = createHarness(ready, undefined, sharedImageUpload().module);
  await find(view.render(), n => n.type === 'input').props.onChange({ currentTarget: { files: [new File(['GIF89a'], 'a.gif', { type: 'image/gif' })], value: '' } });
  assert.equal(view.render().props['data-scene'], 'ready');
  assert.match(text(view.render()), /Choose a JPEG, PNG, WebP, HEIC, or HEIF photo/); assert.equal(uploads.length, 0);
});

function profileHarness(prepare, imageUpload) {
  const saves = [];
  const view = mount('components/profile-form.tsx', 'ProfileForm', {
    email: 'test@example.test', profile: { first_name: 'First', last_name: 'Last', avatar_url: null, humor_preference: null },
  }, {
    '@/lib/image-upload': imageUpload ?? { IMAGE_UPLOAD_ACCEPT: 'image/jpeg,image/heic,image/heif,.heic,.heif', ImageUploadError: Error, prepareImageUpload: prepare },
    '@/app/dashboard/profile-actions': { saveProfile: async (_, data) => { saves.push(data); return { message: 'Profile saved.' }; } },
  });
  return { view, saves };
}

test('avatar blocks save during conversion and submits only the prepared JPEG, never the raw picker file', async () => {
  const conversion = deferred(); const { view, saves } = profileHarness(() => conversion.promise);
  const input = find(view.render(), n => n.type === 'input' && n.props.type === 'file');
  assert.equal(input.props.name, undefined);
  const raw = new File(['raw heif'], 'phone.heic', { type: 'image/heic' });
  const event = { currentTarget: { files: [raw], value: 'phone.heic' } };
  const selection = input.props.onChange(event);
  assert.equal(event.currentTarget.value, '');
  assert.equal(button(view.render(), 'Save Changes').props.disabled, true);
  const form = new FormData(); form.set('first_name', 'First'); form.set('last_name', 'Last'); form.set('humor_preference', '');
  form.set('avatar', raw);
  await view.render().props.action(form); assert.equal(saves.length, 0);
  const jpeg = new File(['jpeg pixels'], 'phone.jpg', { type: 'image/jpeg' });
  conversion.resolve(jpeg); await selection;
  await view.render().props.action(form);
  assert.equal(saves.length, 1); assert.equal(saves[0].get('avatar'), jpeg);
  assert.equal(saves[0].get('avatar').type, 'image/jpeg');
});

test('failed avatar conversion cannot submit a raw file even when other profile fields are dirty', async () => {
  const { view, saves } = profileHarness(async () => { throw new Error('Cannot convert.'); });
  await find(view.render(), n => n.type === 'input' && n.props.type === 'file').props.onChange({ currentTarget: { files: [{ name: 'bad.heif' }], value: '' } });
  assert.match(text(view.render()), /Cannot convert/);
  const form = new FormData(); form.set('first_name', 'Updated'); form.set('last_name', 'Last'); form.set('humor_preference', '');
  form.set('avatar', new File(['raw'], 'bad.heif', { type: 'image/heif' }));
  await view.render().props.action(form);
  assert.equal(saves.length, 1); assert.equal(saves[0].has('avatar'), false);
});

test('avatar runs the shared helper: HEIC saves as converted JPEG, PNG passes through untouched', async () => {
  const shared = sharedImageUpload();
  const { view, saves } = profileHarness(undefined, shared.module);
  const input = () => find(view.render(), n => n.type === 'input' && n.props.type === 'file');
  assert.equal(input().props.accept, shared.module.IMAGE_UPLOAD_ACCEPT);
  const heic = iphoneHeic('selfie.heif');
  await input().props.onChange({ currentTarget: { files: [heic], value: 'selfie.heif' } });
  assert.equal(shared.decoded.length, 1); assert.equal(shared.decoded[0].options.imageOrientation, 'from-image');
  assert.equal(find(view.render(), n => n.type === 'img').props.src, 'blob:test');
  const form = new FormData(); form.set('first_name', 'First'); form.set('last_name', 'Last'); form.set('humor_preference', '');
  await view.render().props.action(form);
  const avatar = saves[0].get('avatar');
  assert.notEqual(avatar, heic);
  assert.equal(avatar.name, 'selfie.jpg'); assert.equal(avatar.type, 'image/jpeg');
  assert.deepEqual([...new Uint8Array(await avatar.arrayBuffer())], JPEG_BYTES);

  const png = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], 'face.png', { type: 'image/png' });
  const second = profileHarness(undefined, sharedImageUpload().module);
  await find(second.view.render(), n => n.type === 'input' && n.props.type === 'file').props.onChange({ currentTarget: { files: [png], value: 'face.png' } });
  await second.view.render().props.action(form);
  assert.equal(second.saves[0].get('avatar'), png);
  // Avatar-only 4 MiB cap (Server Action body limit); generation keeps 5 MiB.
  const header = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  const big = new File([new Uint8Array(header), new Uint8Array(4 * 1024 * 1024)], 'big.png', { type: 'image/png' });
  const third = profileHarness(undefined, shared.module);
  await find(third.view.render(), n => n.type === 'input' && n.props.type === 'file').props.onChange({ currentTarget: { files: [big], value: 'big.png' } });
  assert.match(text(third.view.render()), /Profile photos must be 4 MiB or smaller/);
  await third.view.render().props.action(form);
  assert.equal(third.saves[0].has('avatar'), false);
  const generation = createHarness(ready, undefined, sharedImageUpload().module);
  await find(generation.view.render(), n => n.type === 'input').props.onChange({ currentTarget: { files: [big], value: 'big.png' } });
  await button(generation.view.render(), 'Upload this one').props.onClick();
  assert.equal(generation.uploads[0].file, big);
});
