/* eslint-disable no-await-in-loop, no-restricted-syntax -- HTTP scenarios share a mocked uploader. */
const assert = require('assert/strict');
const { Writable } = require('stream');
const cloudinary = require('cloudinary').v2;
const app = require('../app');
const { MAX_IMAGE_BYTES } = require('../utils/decodeBase64Image');

const pngBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';
const png = Buffer.from(pngBase64, 'base64');
const imageUrl = 'https://res.cloudinary.com/test-cloud/image/upload/v1/products/test-image.png';
const publicId = 'products/test-image';
const environment = ['CLOUDINARY_CLOUD_NAME', 'CLOUDINARY_API_KEY', 'CLOUDINARY_API_SECRET'];

async function runTests() {
  const originalUpload = cloudinary.uploader.upload_stream;
  const originalEnvironment = environment.map((key) => [key, process.env[key]]);
  environment.forEach((key) => { process.env[key] = 'test-value'; });
  let calls = 0;
  let received;
  let providerError;
  let streamError;
  let synchronousError;
  let result;
  let checks = 0;
  let holdUploads = false;
  let allUploadsPending;
  const pendingUploads = [];

  cloudinary.uploader.upload_stream = (options, callback) => {
    calls += 1;
    assert.strictEqual(options.resource_type, 'image');
    assert.strictEqual(options.folder, 'products');
    assert.strictEqual(options.overwrite, false);
    assert.strictEqual(options.timeout, 30000);
    assert.deepStrictEqual(options.allowed_formats, ['png', 'jpg', 'jpeg', 'webp']);
    if (synchronousError) throw synchronousError;
    return new Writable({
      write(chunk, encoding, next) {
        received = Buffer.from(chunk);
        next(streamError);
      },
      final(next) {
        const complete = () => {
          callback(providerError, result);
          next();
        };
        if (holdUploads) {
          pendingUploads.push(complete);
          if (pendingUploads.length === 4) allUploadsPending();
        } else complete();
      },
    });
  };

  const server = app.listen(0, '127.0.0.1');
  try {
    await new Promise((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = async (body, expected = 200, headers = {}, raw = JSON.stringify(body)) => {
      const response = await fetch(`${base}/api/v1/images/upload-cover`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...headers },
        body: raw,
        signal: AbortSignal.timeout(10000),
      });
      const responseBody = await response.json();
      assert.strictEqual(response.status, expected, JSON.stringify(responseBody));
      if (expected >= 400) {
        assert.strictEqual(responseBody.statusCode, expected);
        assert.strictEqual(responseBody.status, expected < 500 ? 'fail' : 'error');
        assert.strictEqual(responseBody.path, '/api/v1/images/upload-cover');
        assert.strictEqual(responseBody.method, 'POST');
        assert.doesNotMatch(responseBody.message, /Sensitive provider details|test-value/);
        if (/uploads are busy/.test(responseBody.message)) {
          assert.strictEqual(response.headers.get('Retry-After'), '1');
        }
        if (responseBody.errors) {
          assert.strictEqual(responseBody.errors[0].path, 'base64Image');
          assert.strictEqual(responseBody.errors[0].value, undefined);
        }
      }
      checks += 1;
      return responseBody;
    };

    result = { secure_url: imageUrl, public_id: publicId };
    for (const base64Image of [pngBase64, pngBase64.replace(/=+$/, ''),
      `data:image/png;base64,${pngBase64}`, `  data:image/png;base64,${pngBase64}  `]) {
      const uploaded = await request({ base64Image });
      assert.deepStrictEqual(uploaded, { success: true, imageUrl, publicId });
      assert.deepStrictEqual(received, png);
    }

    const callsBeforeInvalid = calls;
    for (const body of [undefined, {}, [], { base64Image: null }, { base64Image: 123 },
      { base64Image: {} }, { base64Image: [] }, { base64Image: '' }, { base64Image: ' ' },
      { base64Image: 'https://example.com/image.png' }, { base64Image: 'not!base64' },
      { base64Image: 'A' }, { base64Image: 'AA=' }, { base64Image: 'AB==' },
      { base64Image: 'data:image/png,AAAA' }, { base64Image: 'data:image/png;base64,' },
      { base64Image: `data:image/jpeg;base64,${pngBase64}` },
      { base64Image: `data:image/webp;base64,${pngBase64}` }]) {
      await request(body, 400);
    }
    for (const base64Image of [Buffer.from('This is text, not an image').toString('base64'),
      'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=',
      'data:image/gif;base64,R0lGODlh', 'data:text/plain;base64,SGVsbG8=']) {
      await request({ base64Image }, 415);
    }
    await request({ base64Image: pngBase64 }, 415, { 'Content-Type': 'text/plain' });
    await request(undefined, 400, {}, '{');
    assert.strictEqual(calls, callsBeforeInvalid);

    // One byte over the decoded cap has the same encoded length as the maximum.
    const oversized = Buffer.alloc(MAX_IMAGE_BYTES + 1);
    png.subarray(0, 8).copy(oversized);
    await request({ base64Image: oversized.toString('base64') }, 413);
    await request({ base64Image: 'A'.repeat(4 * Math.ceil(MAX_IMAGE_BYTES / 3) + 4) }, 413);
    await request({ base64Image: 'A'.repeat(8 * 1024 * 1024) }, 413);
    assert.strictEqual(calls, callsBeforeInvalid);

    for (const key of environment) {
      delete process.env[key];
      await request({ base64Image: pngBase64 }, 503);
      process.env[key] = 'test-value';
    }
    assert.strictEqual(calls, callsBeforeInvalid);

    providerError = { http_code: 400, message: 'Sensitive provider details' };
    await request({ base64Image: pngBase64 }, 400);
    providerError = { http_code: 401, message: 'Sensitive provider details' };
    await request({ base64Image: pngBase64 }, 502);
    providerError = { http_code: 500, message: 'Sensitive provider details' };
    await request({ base64Image: pngBase64 }, 502);
    providerError = undefined;

    for (const invalidResult of [undefined, {}, { secure_url: imageUrl },
      { secure_url: 'http://example.com/insecure.png', public_id: publicId }]) {
      result = invalidResult;
      await request({ base64Image: pngBase64 }, 502);
    }
    result = { secure_url: imageUrl, public_id: publicId };
    streamError = new Error('Sensitive provider details');
    await request({ base64Image: pngBase64 }, 502);
    streamError = undefined;
    synchronousError = new Error('Sensitive provider details');
    await request({ base64Image: pngBase64 }, 502);
    synchronousError = undefined;

    // An earlier failure must not stop subsequent uploads.
    const recovered = await request({ base64Image: pngBase64 });
    assert.strictEqual(recovered.imageUrl, imageUrl);

    holdUploads = true;
    const waitingForUploads = new Promise((resolve) => { allUploadsPending = resolve; });
    const inFlight = Promise.all(Array.from({ length: 4 }, () => request({ base64Image: pngBase64 })));
    await Promise.race([
      waitingForUploads,
      inFlight.then(() => { throw new Error('Uploads completed before testing the capacity limit'); }),
    ]);
    const callsAtCapacity = calls;
    const busy = await request({ base64Image: pngBase64 }, 503);
    assert.match(busy.message, /uploads are busy/);
    assert.strictEqual(calls, callsAtCapacity);
    holdUploads = false;
    pendingUploads.splice(0).forEach((complete) => complete());
    await inFlight;
    const afterCapacity = await request({ base64Image: pngBase64 });
    assert.strictEqual(afterCapacity.imageUrl, imageUrl);
    console.log(`Passed ${checks} HTTP image upload checks. Cloudinary mocked; no real assets uploaded.`);
  } finally {
    server.closeAllConnections();
    await new Promise((resolve) => { server.close(resolve); });
    cloudinary.uploader.upload_stream = originalUpload;
    originalEnvironment.forEach(([key, value]) => {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    });
  }
}

runTests().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
