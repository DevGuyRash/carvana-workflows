import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const distDir = path.join(root, 'dist');

const targets = [
  { dir: 'chrome-extension', zip: 'chrome-extension.zip' },
  { dir: 'firefox-extension', zip: 'firefox-extension.zip' },
];

function ensureZipBinary() {
  const check = spawnSync('zip', ['-v'], { encoding: 'utf8' });
  if (check.status !== 0) {
    console.error('zip command is required to package extension artifacts.');
    process.exit(1);
  }
}

function ensureDistArtifacts() {
  for (const target of targets) {
    const folder = path.join(distDir, target.dir);
    if (!fs.existsSync(folder)) {
      console.error(`Missing ${folder}. Run npm run build first.`);
      process.exit(1);
    }
  }
}

function packageTarget(target) {
  const zipPath = path.join(distDir, target.zip);
  fs.rmSync(zipPath, { force: true });

  const result = spawnSync('zip', ['-r', target.zip, target.dir], {
    cwd: distDir,
    stdio: 'inherit',
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

ensureZipBinary();
ensureDistArtifacts();
for (const target of targets) {
  packageTarget(target);
}

console.log('Packaged extension artifacts:');
for (const target of targets) {
  console.log(`- ${path.join(distDir, target.zip)}`);
}
