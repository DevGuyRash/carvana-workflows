import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

/** @param {Record<string, any>} meta */
function toMetaBlock(meta){
  const lines = ['// ==UserScript=='];
  const push = (k, v) => {
    if (Array.isArray(v)) v.forEach(val => lines.push(`// @${k.padEnd(15)} ${val}`));
    else if (v !== undefined && v !== null) lines.push(`// @${k.padEnd(15)} ${v}`);
  };

  for (const [k, v] of Object.entries(meta)) push(k, v);
  lines.push('// ==/UserScript==');
  return lines.join('\n');
}

function loadMeta(pkgDir){
  const metaPath = path.join(pkgDir, 'metadata.json');
  const meta = JSON.parse(fs.readFileSync(metaPath, 'utf-8'));
  // keep version in sync with root version if missing
  const rootPkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'));
  if (!meta.version) meta.version = rootPkg.version;
  return meta;
}

function normalizeBaseUrl(raw){
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  return trimmed.endsWith('/') ? trimmed.slice(0, -1) : trimmed;
}

async function buildOne(pkgName){
  const pkgDir = path.join(root, 'packages', pkgName);
  const outDir = path.join(root, 'dist');
  const entry = path.join(pkgDir, 'src', 'index.ts');
  const meta = loadMeta(pkgDir);
  const slug = pkgName.replace('-userscript','');
  const baseUrl = normalizeBaseUrl(process.env.US_BASE_URL || meta.downloadURL?.replace(/\/[\w.-]+\.user\.js$/, '') || '');

  if (baseUrl) {
    const fileUrl = `${baseUrl}/${slug}.user.js`;
    meta.downloadURL = fileUrl;
    meta.updateURL = fileUrl;
  }

  const banner = toMetaBlock(meta) + '\n';

  await build({
    entryPoints: [entry],
    outfile: path.join(outDir, `${pkgName.replace('-userscript','')}.user.js`),
    bundle: true,
    platform: 'browser',
    format: 'iife',
    target: 'es2021',
    banner: { js: banner },
    sourcemap: true,
    legalComments: 'none',
    define: {
      __US_NAME__: JSON.stringify(meta.name || pkgName),
      __US_NAMESPACE__: JSON.stringify(meta.namespace || 'cv-userscripts'),
      __US_VERSION__: JSON.stringify(meta.version || '0.1.0')
    }
  });
  console.log(`Built ${pkgName}`);
}

const packagesDir = path.join(root, 'packages');
const pkgs = fs.readdirSync(packagesDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory() && entry.name.endsWith('-userscript'))
  .map((entry) => entry.name)
  .sort();

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
for (const p of pkgs) await buildOne(p);

console.log('\nAll done. Find userscripts in ./dist/*.user.js');
