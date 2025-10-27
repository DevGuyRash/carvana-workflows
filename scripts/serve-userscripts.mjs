import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'dist');
const host = process.env.US_HOST || 'localhost';
const port = Number(process.env.US_PORT || '4873');

function send(res, status, body, headers = {}) {
  res.writeHead(status, headers);
  res.end(body);
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') {
        send(res, 404, 'Not found');
        return;
      }
      send(res, 500, 'Internal error');
      return;
    }
    const ext = path.extname(filePath);
    const type = ext === '.js' ? 'text/javascript; charset=utf-8' : 'application/octet-stream';
    send(res, 200, data, {
      'Content-Type': type,
      'Cache-Control': 'no-cache'
    });
  });
}

function serveDirectory(res, dirPath, requestPath) {
  fs.readdir(dirPath, { withFileTypes: true }, (err, entries) => {
    if (err) {
      send(res, 500, 'Internal error');
      return;
    }
    const visibleEntries = entries.filter((entry) => !entry.name.startsWith('.'));
    const pathForLinks = requestPath && requestPath !== '' ? requestPath : '/';
    const base = pathForLinks.endsWith('/') ? pathForLinks : `${pathForLinks}/`;
    const listItems = visibleEntries
      .map((entry) => {
        const href = `${base}${encodeURIComponent(entry.name)}${entry.isDirectory() ? '/' : ''}`;
        const label = `${entry.name}${entry.isDirectory() ? '/' : ''}`;
        return `<li><a href="${href}">${label}</a></li>`;
      })
      .join('');
    const body = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Userscripts</title></head><body><h1>Userscripts</h1><p>Select a file below:</p><ul>${listItems}</ul></body></html>`;
    send(res, 200, body, {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
  });
}

function handler(req, res) {
  if (!req.url) {
    send(res, 400, 'Bad request');
    return;
  }
  let pathname;
  try {
    const requestUrl = new URL(req.url, 'http://localhost');
    pathname = requestUrl.pathname;
  } catch (_err) {
    send(res, 400, 'Bad request');
    return;
  }

  if (!pathname) {
    send(res, 400, 'Bad request');
    return;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch (_err) {
    send(res, 400, 'Bad request');
    return;
  }

  const relativePath = decodedPath.startsWith('/') ? decodedPath.slice(1) : decodedPath;
  const safePath = path.normalize(path.join(distDir, relativePath));
  const distDirNormalized = path.normalize(distDir);
  if (safePath !== distDirNormalized && !safePath.startsWith(`${distDirNormalized}${path.sep}`)) {
    send(res, 403, 'Forbidden');
    return;
  }

  const stat = fs.existsSync(safePath) ? fs.statSync(safePath) : null;
  if (stat && stat.isDirectory()) {
    const indexFile = path.join(safePath, 'index.html');
    if (fs.existsSync(indexFile)) {
      serveFile(res, indexFile);
      return;
    }
    serveDirectory(res, safePath, decodedPath || '/');
    return;
  }

  if (stat && stat.isFile()) {
    serveFile(res, safePath);
    return;
  }

  send(res, 404, 'Not found');
}

const server = http.createServer(handler);

server.listen(port, host, () => {
  const base = `http://${host}:${port}`;
  console.log(`Userscript server running at ${base}`);
  console.log('Ensure your build sets US_BASE_URL to this value, e.g.:');
  console.log(`  US_BASE_URL=${base} npm run build`);
});
