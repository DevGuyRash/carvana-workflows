import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const crateDir = path.join(root, 'rust', 'crates', 'cv_ext_wasm');
const outDir = path.join(root, 'apps', 'webextension', 'pkg');

function isWindowsGnuToolchain() {
  if (process.platform !== 'win32') {
    return false;
  }

  const rustcInfo = spawnSync('rustc', ['-vV'], { encoding: 'utf8' });
  if (rustcInfo.status !== 0) {
    return false;
  }

  return /host:\s+.+-pc-windows-gnu/i.test(rustcInfo.stdout ?? '');
}

function verifyWindowsGnuLinker() {
  if (!isWindowsGnuToolchain()) {
    return true;
  }

  const check = spawnSync('x86_64-w64-mingw32-gcc', ['-print-file-name=libktmw32.a'], {
    encoding: 'utf8',
  });
  if (check.status !== 0) {
    console.error(
      '[build:wasm] Preflight failed: GNU Windows Rust toolchain detected, but `x86_64-w64-mingw32-gcc` is unavailable.',
    );
    console.error(
      '[build:wasm] Install MinGW-w64 fully or switch to MSVC: `rustup default stable-x86_64-pc-windows-msvc`.',
    );
    return false;
  }

  const resolved = (check.stdout ?? '').trim().toLowerCase();
  if (!resolved || resolved === 'libktmw32.a') {
    console.error(
      '[build:wasm] Preflight failed: GNU linker is missing `libktmw32` (required to compile wasm-pack on Windows GNU).',
    );
    console.error(
      '[build:wasm] Install complete MinGW-w64 runtime libs or switch to MSVC: `rustup default stable-x86_64-pc-windows-msvc`.',
    );
    return false;
  }

  return true;
}

function verifyWindowsMsvcLinker() {
  if (process.platform !== 'win32') {
    return true;
  }

  const rustcInfo = spawnSync('rustc', ['-vV'], { encoding: 'utf8' });
  if (rustcInfo.status !== 0) {
    return false;
  }

  const isMsvcHost = /host:\s+.+-pc-windows-msvc/i.test(rustcInfo.stdout ?? '');
  if (!isMsvcHost) {
    return true;
  }

  const linkCheck = spawnSync('where.exe', ['link'], { encoding: 'utf8' });
  const firstLink = (linkCheck.stdout ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);

  if (!firstLink) {
    console.error('[build:wasm] Preflight failed: could not resolve `link.exe` on PATH for MSVC host.');
    console.error(
      '[build:wasm] Run from Developer PowerShell for Visual Studio or install Build Tools with "Desktop development with C++".',
    );
    return false;
  }

  const normalized = firstLink.replaceAll('/', '\\').toLowerCase();
  const isGitLink = normalized.includes('\\git\\') && normalized.endsWith('\\usr\\bin\\link.exe');
  if (isGitLink) {
    console.error('[build:wasm] Preflight failed: PATH resolves `link.exe` to Git/MSYS linker:');
    console.error(`[build:wasm] ${firstLink}`);
    console.error(
      '[build:wasm] Use Developer PowerShell for Visual Studio or move Git `usr\\bin` later in PATH.',
    );
    return false;
  }

  return true;
}

function resolveWasmPack() {
  const direct = spawnSync('wasm-pack', ['--version'], { encoding: 'utf8' });
  if (direct.status === 0) {
    return 'wasm-pack';
  }

  const binaryName = process.platform === 'win32' ? 'wasm-pack.exe' : 'wasm-pack';
  const cargoBin = path.join(os.homedir(), '.cargo', 'bin', binaryName);
  if (fs.existsSync(cargoBin)) {
    const check = spawnSync(cargoBin, ['--version'], { encoding: 'utf8' });
    if (check.status === 0) {
      return cargoBin;
    }
  }

  return null;
}

function installWasmPack() {
  console.warn('[build:wasm] wasm-pack missing. Attempting to install via `cargo install wasm-pack`.');
  const result = spawnSync('cargo', ['install', 'wasm-pack'], { stdio: 'inherit' });
  return result.status === 0;
}

if (!verifyWindowsGnuLinker() || !verifyWindowsMsvcLinker()) {
  process.exit(1);
}

let wasmPack = resolveWasmPack();
if (!wasmPack && !installWasmPack()) {
  console.error('[build:wasm] Failed to install wasm-pack automatically. Run `cargo install wasm-pack` and retry.');
  process.exit(1);
}

wasmPack = resolveWasmPack();
if (!wasmPack) {
  console.error('[build:wasm] wasm-pack still unavailable after install attempt.');
  process.exit(1);
}

const result = spawnSync(
  wasmPack,
  ['build', crateDir, '--target', 'web', '--out-dir', outDir, '--out-name', 'cv_ext_wasm'],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
