import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const appRoot = path.join(root, 'apps', 'webextension');
const srcRoot = path.join(appRoot, 'src');
const pkgRoot = path.join(appRoot, 'pkg');
const distRoot = path.join(root, 'dist');
const chromeOut = path.join(distRoot, 'chrome-extension');
const firefoxOut = path.join(distRoot, 'firefox-extension');

const baseManifest = JSON.parse(fs.readFileSync(path.join(appRoot, 'manifest.base.json'), 'utf8'));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));

function emptyDir(dirPath) {
  fs.rmSync(dirPath, { force: true, recursive: true });
  fs.mkdirSync(dirPath, { recursive: true });
}

function copyFile(name, outDir) {
  fs.copyFileSync(path.join(appRoot, name), path.join(outDir, name));
}

function copyPkg(outDir) {
  if (!fs.existsSync(pkgRoot)) {
    throw new Error('Missing apps/webextension/pkg. Run npm run build:wasm first.');
  }

  const target = path.join(outDir, 'pkg');
  fs.mkdirSync(target, { recursive: true });
  for (const file of fs.readdirSync(pkgRoot)) {
    fs.copyFileSync(path.join(pkgRoot, file), path.join(target, file));
  }
}

async function buildEntries(outDir) {
  const entries = {
    background: path.join(srcRoot, 'background.ts'),
    content: path.join(srcRoot, 'content.ts'),
    popup: path.join(srcRoot, 'popup.ts'),
    sidepanel: path.join(srcRoot, 'sidepanel.ts'),
  };

  await build({
    entryPoints: entries,
    outdir: outDir,
    bundle: true,
    format: 'iife',
    target: 'es2022',
    sourcemap: true,
    logLevel: 'info',
  });
}

function chromeManifest() {
  return {
    ...baseManifest,
    manifest_version: 3,
    version: packageJson.version,
    permissions: ['storage', 'tabs', 'activeTab', 'scripting', 'sidePanel'],
    background: {
      service_worker: 'background.js',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
  };
}

function firefoxManifest() {
  return {
    ...baseManifest,
    manifest_version: 2,
    version: packageJson.version,
    permissions: [
      'storage',
      'tabs',
      'activeTab',
      'https://jira.carvana.com/*',
      'https://*.fa.us2.oraclecloud.com/*',
      'https://carma.cvnacorp.com/*',
    ],
    browser_specific_settings: {
      gecko: {
        id: 'carvana-workflows@carvana.com',
      },
    },
    background: {
      scripts: ['background.js'],
    },
    sidebar_action: {
      default_title: 'Carvana Workflows',
      default_panel: 'sidepanel.html',
    },
  };
}

function writeManifest(outDir, manifest) {
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
}

async function buildVariant(outDir, manifestFactory) {
  emptyDir(outDir);
  await buildEntries(outDir);
  copyFile('popup.html', outDir);
  copyFile('sidepanel.html', outDir);
  copyPkg(outDir);
  writeManifest(outDir, manifestFactory());
}

await buildVariant(chromeOut, chromeManifest);
await buildVariant(firefoxOut, firefoxManifest);

console.log('Built extension artifacts:');
console.log(`- ${chromeOut}`);
console.log(`- ${firefoxOut}`);
