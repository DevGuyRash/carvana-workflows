import { spawn } from 'node:child_process';
import chokidar from 'chokidar';

const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';

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
  currentBuild = spawn(npmBin, ['run', 'build'], {
    stdio: 'inherit',
    env: process.env,
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

const watcher = chokidar.watch(watchPaths, {
  ignored,
  ignoreInitial: true,
  awaitWriteFinish: {
    stabilityThreshold: 250,
    pollInterval: 50,
  },
});

watcher.on('ready', () => {
  if (readySeen) {
    return;
  }

  readySeen = true;
  console.log('[dev] watching for changes');
  triggerBuild();
});

for (const eventName of ['add', 'change', 'unlink']) {
  watcher.on(eventName, (filePath) => {
    console.log(`[dev] ${eventName}: ${filePath}`);
    triggerBuild(filePath);
  });
}

function shutdown(signal) {
  console.log(`\n[dev] received ${signal}, shutting down watcher`);
  watcher
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
