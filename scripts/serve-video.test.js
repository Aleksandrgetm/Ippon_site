const { test } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { serveVideo } = require('./serve-video');

test('video HTTP delivery: exact bytes, ranges, HEAD and errors', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'ippon-video-test-'));
  const file = path.join(directory, 'fixture.mp4');
  const bytes = Buffer.from(Array.from({ length: 2048 }, (_, i) => i % 251));
  await fs.writeFile(file, bytes);
  const server = http.createServer((req, res) => serveVideo(req, res,
    req.url === '/missing' ? path.join(directory, 'missing') : file, 'video/mp4'));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  async function check(options, status, body, contentRange) {
    const response = await fetch(url, options);
    assert.equal(response.status, status);
    assert.equal(response.headers.get('content-type'), 'video/mp4');
    assert.equal(response.headers.get('accept-ranges'), 'bytes');
    assert.equal(response.headers.get('content-range'), contentRange || null);
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), body);
    assert.equal(Number(response.headers.get('content-length')), options.method === 'HEAD' ? bytes.length : body.length);
  }
  try {
    await check({}, 200, bytes);
    await check({ headers: { Range: 'bytes=0-1023' } }, 206, bytes.subarray(0, 1024), 'bytes 0-1023/2048');
    await check({ headers: { Range: 'bytes=0-1' } }, 206, bytes.subarray(0, 2), 'bytes 0-1/2048');
    await check({ headers: { Range: 'bytes=1024-' } }, 206, bytes.subarray(1024), 'bytes 1024-2047/2048');
    await check({ headers: { Range: 'bytes=-32' } }, 206, bytes.subarray(-32), 'bytes 2016-2047/2048');
    await check({ headers: { Range: 'bytes=2040-9999' } }, 206, bytes.subarray(2040), 'bytes 2040-2047/2048');
    for (const range of ['bytes=2048-', 'bytes=30-20', 'bytes=-0']) {
      await check({ headers: { Range: range } }, 416, Buffer.alloc(0), 'bytes */2048');
    }
    for (const range of ['invalid', 'bytes=0-1,4-5']) {
      await check({ headers: { Range: range } }, 200, bytes);
    }
    await check({ headers: { Range: 'bytes=0-1', 'If-Range': 'stale' } }, 200, bytes);
    await check({ method: 'HEAD', headers: { Range: 'bytes=0-1' } }, 200, Buffer.alloc(0));
    assert.equal((await fetch(`${url}/missing`)).status, 404);
    assert.equal((await fetch(url, { method: 'POST' })).status, 405);
  } finally {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
    await fs.unlink(file);
    await fs.rmdir(directory);
  }
});
