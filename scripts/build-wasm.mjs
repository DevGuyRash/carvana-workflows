import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const crateDir = path.join(root, 'rust', 'crates', 'cv_ext_wasm');
const outDir = path.join(root, 'apps', 'webextension', 'pkg');

function resolveWasmPack() {
  const direct = spawnSync('wasm-pack', ['--version'], { encoding: 'utf8' });
  if (direct.status === 0) {
    return 'wasm-pack';
  }

  const cargoBin = path.join(process.env.HOME ?? '', '.cargo', 'bin', 'wasm-pack');
  if (cargoBin && fs.existsSync(cargoBin)) {
    const check = spawnSync(cargoBin, ['--version'], { encoding: 'utf8' });
    if (check.status === 0) {
      return cargoBin;
    }
  }

  return null;
}

const wasmPack = resolveWasmPack();
if (!wasmPack) {
  console.error('wasm-pack is required but not installed. Install with: cargo install wasm-pack');
  process.exit(1);
}

const result = spawnSync(
  wasmPack,
  ['build', crateDir, '--target', 'web', '--out-dir', outDir, '--out-name', 'cv_ext_wasm'],
  { stdio: 'inherit' },
);

process.exit(result.status ?? 1);
