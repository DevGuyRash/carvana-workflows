import { spawn, spawnSync } from 'node:child_process';
import { watch } from 'node:fs';
import { readdir } from 'node:fs/promises';
import path from 'node:path';

const npmBin = 'npm';
const cwd = process.cwd();

const watchPaths = [
  'rust/**/*.rs',
  'rust/Cargo.toml',
  'rust/Cargo.lock',
  'apps/webextension/**/*.{ts,html,json}',
  'package.json',
  'scripts/build-wasm.mjs',
  'scripts/build-extension.mjs',
  'scripts/package-extensions.mjs',
];

const ignored = [
  '**/.git/**',
  '**/node_modules/**',
  '**/dist/**',
  '**/apps/webextension/pkg/**',
  '**/rust/target/**',
];

let currentBuild = null;
let queued = false;
let readySeen = false;
const changedFiles = new Set();
let activeWatcher = null;

function normalizePath(filePath) {
  return filePath.replaceAll('\\', '/');
}

function isIgnored(filePath) {
  const normalized = normalizePath(filePath);
  return (
    normalized.includes('/.git/') ||
    normalized.includes('/node_modules/') ||
    normalized.includes('/dist/') ||
    normalized.includes('/apps/webextension/pkg/') ||
    normalized.includes('/rust/target/')
  );
}

function shouldTriggerBuild(filePath, eventName = 'change') {
  const normalized = normalizePath(filePath);
  if (isIgnored(normalized)) {
    return false;
  }

  if (normalized === 'package.json') {
    return true;
  }

  if (normalized === 'rust/Cargo.toml' || normalized === 'rust/Cargo.lock') {
    return true;
  }

  if (
    normalized === 'scripts/build-wasm.mjs' ||
    normalized === 'scripts/build-extension.mjs' ||
    normalized === 'scripts/package-extensions.mjs'
  ) {
    return true;
  }

  if (normalized.startsWith('rust/') && normalized.endsWith('.rs')) {
    return true;
  }

  if (normalized.startsWith('apps/webextension/')) {
    if (/\.(ts|html|json)$/i.test(normalized)) {
      return true;
    }
    if (eventName === 'rename') {
      return true;
    }
  }

  return false;
}

function summarizeChanges() {
  const files = [...changedFiles];
  if (files.length === 0) {
    return 'initial build';
  }

  if (files.length <= 4) {
    return files.join(', ');
  }

  return `${files.slice(0, 4).join(', ')} (+${files.length - 4} more)`;
}

function runBuild(reason) {
  console.log(`\n[dev] build start (${reason})`);
  const isWindows = process.platform === 'win32';
  const command = isWindows ? `${npmBin} run build` : npmBin;
  const args = isWindows ? [] : ['run', 'build'];

  currentBuild = spawn(command, args, {
    stdio: 'inherit',
    env: process.env,
    shell: isWindows,
  });

  currentBuild.on('exit', (code) => {
    const exitCode = code ?? 0;
    console.log(`[dev] build finished with code ${exitCode}`);
    currentBuild = null;

    if (queued) {
      queued = false;
      const nextReason = summarizeChanges();
      changedFiles.clear();
      runBuild(nextReason);
      return;
    }

    changedFiles.clear();
  });
}

function triggerBuild(filePath) {
  if (filePath && !shouldTriggerBuild(filePath)) {
    return;
  }

  if (filePath) {
    changedFiles.add(filePath);
  }

  if (currentBuild) {
    queued = true;
    return;
  }

  const reason = summarizeChanges();
  changedFiles.clear();
  runBuild(reason);
}

function createFallbackWatcher(onEvent, onReady) {
  const watcherMap = new Map();
  let closed = false;
  const directoryRoots = ['rust', 'apps/webextension'];
  const fileRoots = [
    'package.json',
    'rust/Cargo.toml',
    'rust/Cargo.lock',
    'scripts/build-wasm.mjs',
    'scripts/build-extension.mjs',
    'scripts/package-extensions.mjs',
  ];

  async function watchDirectory(dirPath) {
    if (closed || watcherMap.has(dirPath)) {
      return;
    }

    let watcher;
    try {
      watcher = watch(dirPath, { persistent: true }, (eventType, filename) => {
        const name = typeof filename === 'string' ? filename : filename?.toString() ?? '';
        const absolutePath = name ? path.join(dirPath, name) : dirPath;
        const relativePath = normalizePath(path.relative(cwd, absolutePath));
        if (!relativePath.startsWith('..')) {
          onEvent(eventType, relativePath);
        }

        if (eventType === 'rename') {
          void rescanDirectory(dirPath);
          if (name) {
            const maybeNewDir = path.join(dirPath, name);
            void watchDirectory(maybeNewDir);
          }
        }
      });
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR' || error?.code === 'EPERM') {
        return;
      }
      throw error;
    }

    watcher.on('error', (error) => {
      if (!closed) {
        console.warn(`[dev] native watcher error (${normalizePath(path.relative(cwd, dirPath))}): ${error.message}`);
      }
    });

    watcherMap.set(dirPath, watcher);
    await rescanDirectory(dirPath);
  }

  async function rescanDirectory(dirPath) {
    let entries;
    try {
      entries = await readdir(dirPath, { withFileTypes: true });
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR' || error?.code === 'EPERM') {
        return;
      }
      throw error;
    }

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const childPath = path.join(dirPath, entry.name);
      const relativeChild = normalizePath(path.relative(cwd, childPath));
      if (relativeChild.startsWith('..') || isIgnored(relativeChild)) {
        continue;
      }
      await watchDirectory(childPath);
    }
  }

  async function watchFile(relativeFilePath) {
    const filePath = path.resolve(cwd, relativeFilePath);
    if (watcherMap.has(filePath) || closed) {
      return;
    }

    let watcher;
    try {
      watcher = watch(filePath, { persistent: true }, (eventType) => {
        onEvent(eventType, normalizePath(relativeFilePath));
        if (eventType === 'rename') {
          const active = watcherMap.get(filePath);
          if (active) {
            active.close();
            watcherMap.delete(filePath);
          }
          setTimeout(() => {
            void watchFile(relativeFilePath);
          }, 250);
        }
      });
    } catch (error) {
      if (error?.code === 'ENOENT' || error?.code === 'ENOTDIR' || error?.code === 'EPERM') {
        return;
      }
      throw error;
    }

    watcher.on('error', (error) => {
      if (!closed) {
        console.warn(`[dev] native watcher error (${normalizePath(relativeFilePath)}): ${error.message}`);
      }
    });

    watcherMap.set(filePath, watcher);
  }

  const ready = Promise.all([
    ...directoryRoots.map((rootPath) => watchDirectory(path.resolve(cwd, rootPath))),
    ...fileRoots.map((filePath) => watchFile(filePath)),
  ]).then(() => {
    if (!closed) {
      onReady();
    }
  });

  return {
    backend: 'native-fallback',
    close: async () => {
      closed = true;
      for (const watcher of watcherMap.values()) {
        watcher.close();
      }
      watcherMap.clear();
      await ready.catch(() => undefined);
    },
  };
}

function tryInstallChokidar() {
  console.warn('[dev] chokidar is missing. Attempting local install (`npm install -D chokidar`).');
  const isWindows = process.platform === 'win32';
  const command = isWindows ? `${npmBin} install --save-dev chokidar` : npmBin;
  const args = isWindows ? [] : ['install', '--save-dev', 'chokidar'];
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: process.env,
    shell: isWindows,
  });

  if (result.status === 0) {
    return true;
  }

  console.warn('[dev] chokidar install failed; continuing with native fallback watcher.');
  return false;
}

function createChokidarWatcher(chokidar, onEvent, onReady) {
  const watcher = chokidar.watch(watchPaths, {
    ignored,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 250,
      pollInterval: 50,
    },
  });

  watcher.on('ready', onReady);
  for (const eventName of ['add', 'change', 'unlink']) {
    watcher.on(eventName, (filePath) => onEvent(eventName, normalizePath(filePath)));
  }

  return {
    backend: 'chokidar',
    close: () => watcher.close(),
  };
}

async function createWatcher(onEvent, onReady) {
  try {
    const { default: chokidar } = await import('chokidar');
    return createChokidarWatcher(chokidar, onEvent, onReady);
  } catch (error) {
    if (error?.code !== 'ERR_MODULE_NOT_FOUND') {
      throw error;
    }

    if (tryInstallChokidar()) {
      try {
        const { default: chokidar } = await import('chokidar');
        return createChokidarWatcher(chokidar, onEvent, onReady);
      } catch (retryError) {
        if (retryError?.code !== 'ERR_MODULE_NOT_FOUND') {
          throw retryError;
        }
      }
    }

    console.warn('[dev] using native fallback watcher. Run `npm ci` later to restore chokidar-based watching.');
    return createFallbackWatcher(onEvent, onReady);
  }
}

activeWatcher = await createWatcher(
  (eventName, filePath) => {
    if (!shouldTriggerBuild(filePath, eventName)) {
      return;
    }
    console.log(`[dev] ${eventName}: ${filePath}`);
    triggerBuild(filePath);
  },
  () => {
    if (readySeen) {
      return;
    }

    readySeen = true;
    console.log(`[dev] watching for changes (${activeWatcher.backend})`);
    triggerBuild();
  },
);

function shutdown(signal) {
  console.log(`\n[dev] received ${signal}, shutting down watcher`);
  activeWatcher
    .close()
    .finally(() => {
      if (currentBuild) {
        currentBuild.kill(signal);
      }
      process.exit(0);
    });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
