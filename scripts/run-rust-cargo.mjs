import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const WINDOWS_GNU_TOOLCHAIN = 'stable-x86_64-pc-windows-gnu';
const WINDOWS_GNU_LINKER_ENV = 'CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER';

function commandExists(command, env) {
  const probe = spawnSync(command, ['--version'], { encoding: 'utf8', env });
  return probe.status === 0;
}

function fail(messageLines) {
  for (const line of messageLines) {
    console.error(`[rust-cargo] ${line}`);
  }
  process.exit(1);
}

function ensureWindowsGnuToolchain() {
  const list = spawnSync('rustup', ['toolchain', 'list'], { encoding: 'utf8' });
  if (list.status !== 0) {
    fail([
      'Unable to read installed Rust toolchains via `rustup toolchain list`.',
      'Install rustup and ensure it is on PATH.',
    ]);
  }

  if (!(list.stdout ?? '').includes(WINDOWS_GNU_TOOLCHAIN)) {
    fail([
      `Missing required Rust toolchain: ${WINDOWS_GNU_TOOLCHAIN}`,
      `Install it with: rustup toolchain install ${WINDOWS_GNU_TOOLCHAIN}`,
    ]);
  }
}

function resolveWindowsGnuLinker(baseEnv) {
  const userProfile = baseEnv.USERPROFILE ?? os.homedir();
  const scoopMingwGcc = path.join(userProfile, 'scoop', 'apps', 'mingw', 'current', 'bin', 'gcc.exe');
  const configured = baseEnv[WINDOWS_GNU_LINKER_ENV];

  const candidates = [scoopMingwGcc, configured, 'x86_64-w64-mingw32-gcc', 'gcc'].filter(Boolean);
  for (const linker of candidates) {
    if (!commandExists(linker, baseEnv)) {
      continue;
    }
    return linker;
  }

  fail([
    'Unable to resolve a usable GNU linker for Windows.',
    `Checked ${WINDOWS_GNU_LINKER_ENV}, Scoop MinGW gcc, x86_64-w64-mingw32-gcc, and gcc.`,
    'Install Scoop `mingw` or set CARGO_TARGET_X86_64_PC_WINDOWS_GNU_LINKER explicitly.',
  ]);
}

function ensureLibgccEh(linker, env) {
  const printName = spawnSync(linker, ['-print-file-name=libgcc_eh.a'], { encoding: 'utf8', env });
  if (printName.status !== 0) {
    fail([
      `Failed to inspect runtime libs for linker: ${linker}`,
      'The linker command is not usable for Rust GNU builds.',
    ]);
  }

  const libPath = (printName.stdout ?? '').trim();
  const unresolved = !libPath || libPath === 'libgcc_eh' || libPath === 'libgcc_eh.a';
  if (unresolved || !fs.existsSync(libPath)) {
    fail([
      `Resolved linker (${linker}) does not provide libgcc_eh.a.`,
      `Observed value: ${libPath || '<empty>'}`,
      'Install Scoop `mingw` or use a GNU toolchain distribution that ships libgcc_eh.',
    ]);
  }
}

function buildWindowsEnv() {
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

function runCargo(args, env) {
  const result = spawnSync('cargo', args, {
    stdio: 'inherit',
    env,
  });
  process.exit(result.status ?? 1);
}

const cargoArgs = process.argv.slice(2);
if (cargoArgs.length === 0) {
  fail([
    'Missing Cargo arguments.',
    'Usage: node scripts/run-rust-cargo.mjs <cargo-args...>',
  ]);
}

if (process.platform !== 'win32') {
  runCargo(cargoArgs, process.env);
}

const windowsEnv = buildWindowsEnv();
runCargo(cargoArgs, windowsEnv);
