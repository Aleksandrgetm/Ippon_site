const fs = require('node:fs');

// Native media clients (notably Safari) request byte ranges, including 0-1.
function serveVideo(req, res, filePath, contentType) {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD', 'Content-Length': '0' });
    res.end();
    return;
  }
  fs.stat(filePath, (error, stat) => {
    if (error || !stat.isFile()) {
      res.writeHead(404, { 'Content-Length': '0' });
      res.end();
      return;
    }
    const headers = {
      'Content-Type': contentType,
      'Accept-Ranges': 'bytes',
      'Content-Length': stat.size,
      'Last-Modified': stat.mtime.toUTCString()
    };
    let start = 0;
    let end = stat.size - 1;
    let status = 200;
    // Ignore Range on HEAD, unsupported/multiple ranges and stale If-Range.
    const ifRange = req.headers['if-range'];
    const range = req.method === 'GET' && (!ifRange || ifRange === headers['Last-Modified'])
      ? /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '') : null;
    if (range && (range[1] || range[2])) {
      if (range[1]) {
        start = Number(range[1]);
        if (range[2]) end = Math.min(Number(range[2]), end);
      } else {
        start = Math.max(0, stat.size - Number(range[2]));
      }
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
          || start > end || start >= stat.size) {
        res.writeHead(416, { ...headers, 'Content-Range': `bytes */${stat.size}`, 'Content-Length': '0' });
        res.end();
        return;
      }
      status = 206;
      headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
      headers['Content-Length'] = end - start + 1;
    }
    if (req.method === 'HEAD' || stat.size === 0) {
      res.writeHead(status, headers);
      res.end();
      return;
    }
    const stream = fs.createReadStream(filePath, { start, end });
    stream.once('open', () => {
      res.writeHead(status, headers);
      stream.pipe(res);
    });
    stream.once('error', () => {
      if (res.headersSent) res.destroy();
      else { res.writeHead(500, { 'Content-Length': '0' }); res.end(); }
    });
    res.once('close', () => stream.destroy());
  });
}

module.exports = { serveVideo };
