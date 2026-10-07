import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import ts from 'typescript';

const source = ts.transpileModule(fs.readFileSync('lib/image-upload.ts', 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const jpeg = () => new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: 'image/jpeg' });
function heifFile({ name = 'photo.HEIC', type = 'image/heic', major = 'heic', compatible = [], size = 0 } = {}) {
  const header = Buffer.alloc(16 + compatible.length * 4);
  header.writeUInt32BE(header.length); header.write('ftyp', 4); header.write(major, 8);
  compatible.forEach((brand, index) => header.write(brand, 16 + index * 4));
  return new File([header, new Uint8Array(size)], name, { type, lastModified: 1234 });
}
function load({ nativeFails = false, encodeFails = false, output = jpeg(), fallback = async () => jpeg() } = {}) {
  const calls = [];
  const context = { fillStyle: '', fillRect: (...args) => calls.push(['fill', ...args]), drawImage: (...args) => calls.push(['draw', ...args]) };
  const canvas = { width: 0, height: 0, getContext: () => context, toBlob(callback, type, quality) { calls.push(['encode', type, quality]); callback(encodeFails ? null : output); } };
  const bitmap = { width: 3024, height: 4032, close: () => calls.push(['close']) };
  const componentModule = { exports: {} };
  vm.runInNewContext(source, {
    module: componentModule, exports: componentModule.exports, File, Blob, Uint8Array, DataView,
    createImageBitmap: async (file, options) => {
      calls.push(['decode', file, options]);
      if (nativeFails) throw new Error('Unsupported codec');
      return bitmap;
    },
    document: { createElement: () => canvas },
    require: id => {
      assert.equal(id, 'heic-to/csp'); calls.push(['fallback-import']);
      return { heicTo: async options => { calls.push(['fallback', options]); return fallback(options); } };
    },
  });
  return { ...componentModule.exports, calls, canvas };
}

test('JPEG/PNG/WebP pass through unchanged without loading the codec', async () => {
  const api = load();
  for (const type of ['image/jpeg', 'image/png', 'image/webp']) {
    const file = new File(['existing web image'], 'photo', { type });
    assert.equal(await api.prepareImageUpload(file), file);
  }
  assert.deepEqual(api.calls, []);
});

test('HEIC detection covers MIME, extension, compatible brands, missing MIME, and misleading JPEG labels', async () => {
  const api = load();
  const files = [heifFile(), heifFile({ name: 'photo', type: 'image/heif' }),
    heifFile({ name: 'photo.HEIF', type: '' }), heifFile({ name: 'photo.jpg', type: 'image/jpeg' }),
    heifFile({ major: 'mif1', compatible: ['heix'], name: 'photo', type: '' }),
    new File(['decoder fixture'], 'photo.HEIF', { type: '' }),
    new File(['decoder fixture'], 'photo', { type: 'image/heif' })];
  for (const file of files) {
    const result = await api.prepareImageUpload(file);
    assert.equal(result.type, 'image/jpeg'); assert.match(result.name, /\.jpg$/);
    assert.notEqual(result, file); assert.equal(result.lastModified, file.lastModified);
    assert.deepEqual([...new Uint8Array(await result.arrayBuffer())], [0xff, 0xd8, 0xff, 0xd9]);
  }
});

test('native decode honors image orientation, encodes once at 0.9, and releases resources', async () => {
  const api = load();
  await api.prepareImageUpload(heifFile());
  assert.equal(api.calls.find(c => c[0] === 'decode')[2].imageOrientation, 'from-image');
  assert.deepEqual(api.calls.filter(c => c[0] === 'encode'), [['encode', 'image/jpeg', 0.9]]);
  assert.equal(api.calls.filter(c => c[0] === 'draw').length, 1);
  assert.equal(api.calls.filter(c => c[0] === 'close').length, 1);
  assert.equal(api.calls.filter(c => c[0] === 'fallback-import').length, 0);
  assert.equal(api.canvas.width, 0); assert.equal(api.canvas.height, 0);
});

test('unsupported native HEIC decoding lazy-loads the fallback and requests JPEG quality 0.9', async () => {
  const api = load({ nativeFails: true });
  const original = heifFile(); const result = await api.prepareImageUpload(original);
  assert.equal(result.type, 'image/jpeg');
  const options = api.calls.find(c => c[0] === 'fallback')[1];
  assert.equal(options.blob, original); assert.equal(options.type, 'image/jpeg'); assert.equal(options.quality, 0.9);
});

test('size limit applies after conversion and is identical for both upload consumers', async () => {
  const api = load(); const limit = api.MAX_IMAGE_UPLOAD_BYTES;
  const largeHeic = heifFile({ size: limit + 1 });
  assert.ok(largeHeic.size > limit);
  assert.equal((await api.prepareImageUpload(largeHeic)).size, jpeg().size);
  const oversized = load({ output: new Blob([new Uint8Array(limit + 1)], { type: 'image/jpeg' }) });
  await assert.rejects(oversized.prepareImageUpload(heifFile()), /converted JPEG is larger than 5 MiB/);
  const exact = new File([new Uint8Array(limit)], 'limit.png', { type: 'image/png' });
  assert.equal(await api.prepareImageUpload(exact), exact);
  await assert.rejects(api.prepareImageUpload(new File([new Uint8Array(limit + 1)], 'large.png', { type: 'image/png' })), /no larger than 5 MiB/);
});

test('failed decoding or encoding never returns a raw HEIC or invalid output', async () => {
  for (const options of [
    { nativeFails: true, fallback: async () => { throw new Error('corrupt'); } },
    { nativeFails: true, fallback: async () => new Blob(['raw'], { type: 'image/heic' }) },
    { nativeFails: true, fallback: async () => new Blob([], { type: 'image/jpeg' }) },
    { encodeFails: true, fallback: async () => { throw new Error('failed'); } },
  ]) {
    await assert.rejects(load(options).prepareImageUpload(heifFile()), /Couldn’t convert/);
  }
});

test('picker-converted JPEG with a stale HEIC name is normalized without re-encoding', async () => {
  const api = load(); const file = new File([jpeg()], 'IMG_0001.HEIC', { type: '' });
  const result = await api.prepareImageUpload(file);
  assert.equal(result.name, 'IMG_0001.jpg'); assert.equal(result.type, 'image/jpeg');
  assert.equal(result.size, file.size); assert.deepEqual(api.calls, []);
});

test('empty files, unrelated formats, and AVIF with mif1 branding are rejected', async () => {
  const api = load();
  await assert.rejects(api.prepareImageUpload(new File([], 'empty.heic')), /nonempty/);
  await assert.rejects(api.prepareImageUpload(new File(['gif'], 'photo.gif', { type: 'image/gif' })), /Choose a JPEG/);
  await assert.rejects(api.prepareImageUpload(heifFile({ major: 'mif1', compatible: ['avif'], type: 'image/jpeg' })), /Choose a JPEG/);
  assert.deepEqual(api.calls, []);
});

test('avatar limit is 4 MiB with its own message; the default generation limit stays 5 MiB', async () => {
  const api = load();
  const avatar = { maxBytes: api.MAX_AVATAR_UPLOAD_BYTES, tooLargeMessage: api.AVATAR_TOO_LARGE_MESSAGE };
  assert.equal(api.MAX_AVATAR_UPLOAD_BYTES, 4 * 1024 * 1024); assert.equal(api.MAX_IMAGE_UPLOAD_BYTES, 5 * 1024 * 1024);
  const exact = new File([new Uint8Array(api.MAX_AVATAR_UPLOAD_BYTES)], 'face.png', { type: 'image/png' });
  assert.equal(await api.prepareImageUpload(exact, avatar), exact);
  const over = new File([new Uint8Array(api.MAX_AVATAR_UPLOAD_BYTES + 1)], 'face.png', { type: 'image/png' });
  await assert.rejects(api.prepareImageUpload(over, avatar), { message: api.AVATAR_TOO_LARGE_MESSAGE });
  assert.equal(await api.prepareImageUpload(over), over);
  const bigJpeg = load({ output: new Blob([new Uint8Array(api.MAX_AVATAR_UPLOAD_BYTES + 1)], { type: 'image/jpeg' }) });
  await assert.rejects(bigJpeg.prepareImageUpload(heifFile(), avatar), { message: api.AVATAR_TOO_LARGE_MESSAGE });
  assert.equal((await bigJpeg.prepareImageUpload(heifFile())).type, 'image/jpeg');
});
