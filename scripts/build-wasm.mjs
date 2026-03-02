import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const root = process.cwd();
const crateDir = path.join(root, 'rust', 'crates', 'cv_ext_wasm');
const outDir = path.join(root, 'apps', 'webextension', 'pkg');
let toolchainEnv = process.env;
const WINDOWS_GNU_TOOLCHAIN = 'stable-x86_64-pc-windows-gnu';
const WINDOWS_GNU_LINKER_ENV = 'CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER';

function failPreflight(lines) {
  for (const line of lines) {
    console.error(`[build:wasm] ${line}`);
  }
  process.exit(1);
}

function commandExists(command, env) {
  const probe = spawnSync(command, ['--version'], { encoding: 'utf8', env });
  return probe.status === 0;
}

function ensureWindowsGnuToolchain() {
  const list = spawnSync('rustup', ['toolchain', 'list'], { encoding: 'utf8' });
  if (list.status !== 0) {
    failPreflight([
      'Unable to read installed Rust toolchains via `rustup toolchain list`.',
      'Install rustup and ensure it is on PATH.',
    ]);
  }

  if (!(list.stdout ?? '').includes(WINDOWS_GNU_TOOLCHAIN)) {
    failPreflight([
      `Missing required Rust toolchain: ${WINDOWS_GNU_TOOLCHAIN}`,
      `Install it with: rustup toolchain install ${WINDOWS_GNU_TOOLCHAIN}`,
    ]);
  }
}

function resolveWindowsGnuLinker(baseEnv) {
  const userProfile = baseEnv.USERPROFILE ?? os.homedir();
  const scoopMingwGcc = path.join(userProfile, 'scoop', 'apps', 'mingw', 'current', 'bin', 'gcc.exe');
  const configuredLinker = baseEnv[WINDOWS_GNU_LINKER_ENV];
  const candidates = [scoopMingwGcc, configuredLinker, 'x86_64-w64-mingw32-gcc', 'gcc'].filter(Boolean);

  for (const linker of candidates) {
    if (!commandExists(linker, baseEnv)) {
      continue;
    }
    return linker;
  }

  failPreflight([
    'Unable to resolve a usable GNU linker on Windows.',
    `Checked ${WINDOWS_GNU_LINKER_ENV}, Scoop MinGW gcc, x86_64-w64-mingw32-gcc, and gcc.`,
    'Install Scoop `mingw` or set CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER explicitly.',
  ]);
}

function ensureLibgccEh(linker, env) {
  const probe = spawnSync(linker, ['-print-file-name=libgcc_eh.a'], { encoding: 'utf8', env });
  if (probe.status !== 0) {
    failPreflight([
      `Failed to inspect runtime libraries for linker: ${linker}`,
      'The resolved linker is not usable for Rust GNU builds.',
    ]);
  }

  const libPath = (probe.stdout ?? '').trim();
  const unresolved = !libPath || libPath === 'libgcc_eh' || libPath === 'libgcc_eh.a';
  if (unresolved || !fs.existsSync(libPath)) {
    failPreflight([
      `Resolved linker (${linker}) does not provide libgcc_eh.a.`,
      `Observed value: ${libPath || '<empty>'}`,
      'Install Scoop `mingw` or use a GNU toolchain distribution that ships libgcc_eh.',
    ]);
  }
}

function resolveActiveToolchain() {
  const active = spawnSync('rustup', ['show', 'active-toolchain'], { encoding: 'utf8' });
  if (active.status !== 0) {
    return null;
  }
  const first = (active.stdout ?? '')
    .trim()
    .split(/\s+/)
    .find(Boolean);
  return first ?? null;
}

function prepareToolchainEnv() {
  if (process.platform === 'win32') {
    ensureWindowsGnuToolchain();
    const env = {
      ...process.env,
      RUSTUP_TOOLCHAIN: WINDOWS_GNU_TOOLCHAIN,
    };

    const linker = resolveWindowsGnuLinker(env);
    env[WINDOWS_GNU_LINKER_ENV] = linker;

    const linkerDir = path.dirname(linker);
    const hasPathSeparator = linker.includes(path.sep);
    if (hasPathSeparator && fs.existsSync(linkerDir)) {
      const currentPath = env.PATH ?? '';
      env.PATH = `${linkerDir}${path.delimiter}${currentPath}`;
    }

    ensureLibgccEh(linker, env);
    return env;
  }

  const activeToolchain = resolveActiveToolchain();
  if (!activeToolchain) {
    return process.env;
  }
  return {
    ...process.env,
    RUSTUP_TOOLCHAIN: activeToolchain,
  };
}

function resolveWasmPack() {
  const direct = spawnSync('wasm-pack', ['--version'], { encoding: 'utf8', env: toolchainEnv });
  if (direct.status === 0) {
    return 'wasm-pack';
  }

  const binaryName = process.platform === 'win32' ? 'wasm-pack.exe' : 'wasm-pack';
  const cargoBin = path.join(os.homedir(), '.cargo', 'bin', binaryName);
  if (fs.existsSync(cargoBin)) {
    const check = spawnSync(cargoBin, ['--version'], { encoding: 'utf8', env: toolchainEnv });
    if (check.status === 0) {
      return cargoBin;
    }
  }

  return null;
}

function installWasmPack() {
  console.warn('[build:wasm] wasm-pack missing. Attempting to install via `cargo install wasm-pack`.');
  const result = spawnSync('cargo', ['install', 'wasm-pack'], { stdio: 'inherit', env: toolchainEnv });
  return result.status === 0;
}

toolchainEnv = prepareToolchainEnv();

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
  { stdio: 'inherit', env: toolchainEnv },
);

process.exit(result.status ?? 1);
