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

function copyCssAssets(outDir) {
  const uiOut = path.join(outDir, 'ui');
  fs.mkdirSync(uiOut, { recursive: true });
  const tokensPath = path.join(srcRoot, 'ui', 'tokens.css');
  const basePath = path.join(srcRoot, 'ui', 'base.css');
  if (fs.existsSync(tokensPath))
    fs.copyFileSync(tokensPath, path.join(uiOut, 'tokens.css'));
  if (fs.existsSync(basePath))
    fs.copyFileSync(basePath, path.join(uiOut, 'base.css'));
}

function firefoxWebAccessibleResources(manifest) {
  const raw = manifest.web_accessible_resources;
  if (!Array.isArray(raw)) {
    return ['pkg/*'];
  }

  const flattened = raw.flatMap((entry) => {
    if (typeof entry === 'string') {
      return [entry];
    }

    if (entry && typeof entry === 'object' && Array.isArray(entry.resources)) {
      return entry.resources.filter((value) => typeof value === 'string');
    }

    return [];
  });

  return flattened.length ? [...new Set(flattened)] : ['pkg/*'];
}

async function buildEntries(outDir) {
  const entries = {
    background: path.join(srcRoot, 'background.ts'),
    content: path.join(srcRoot, 'content.ts'),
    popup: path.join(srcRoot, 'popup.ts'),
    sidepanel: path.join(srcRoot, 'sidepanel.ts'),
    'extension-page': path.join(srcRoot, 'extension-page.ts'),
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
    permissions: ['storage', 'tabs', 'activeTab', 'scripting', 'sidePanel', 'downloads'],
    background: {
      service_worker: 'background.js',
    },
    side_panel: {
      default_path: 'sidepanel.html',
    },
  };
}

function firefoxManifest() {
  const {
    host_permissions: _hostPermissions,
    action,
    web_accessible_resources: _war,
    ...rest
  } = baseManifest;

  return {
    ...rest,
    manifest_version: 2,
    version: packageJson.version,
    permissions: [
      'storage',
      'tabs',
      'activeTab',
      'downloads',
      'https://jira.carvana.com/*',
      'https://*.fa.us2.oraclecloud.com/*',
      'https://carma.cvnacorp.com/*',
    ],
    web_accessible_resources: firefoxWebAccessibleResources(baseManifest),
    browser_action: action,
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
  if (fs.existsSync(path.join(appRoot, 'extension.html'))) {
    copyFile('extension.html', outDir);
  }
  copyCssAssets(outDir);
  copyPkg(outDir);
  writeManifest(outDir, manifestFactory());
}

await buildVariant(chromeOut, chromeManifest);
await buildVariant(firefoxOut, firefoxManifest);

console.log('Built extension artifacts:');
console.log(`- ${chromeOut}`);
console.log(`- ${firefoxOut}`);
