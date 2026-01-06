import { spawnSync } from 'node:child_process';

function run(cmd, args) {
  const result = spawnSync(cmd, args, { encoding: 'utf8' });
  if (result.status === 0) return (result.stdout || '').trim();
  return null;
}

function parseRepo(remote) {
  if (!remote) return null;
  const httpsMatch = remote.match(/^https?:\/\/github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/i);
  if (httpsMatch) return httpsMatch[1];
  const sshUrlMatch = remote.match(/^ssh:\/\/git@github\.com\/([^/]+\/[^/]+?)(?:\.git)?$/i);
  if (sshUrlMatch) return sshUrlMatch[1];
  const sshMatch = remote.match(/^git@github\.com:([^/]+\/[^/]+?)(?:\.git)?$/i);
  if (sshMatch) return sshMatch[1];
  return null;
}

const repo = process.env.GITHUB_REPOSITORY
  || parseRepo(run('git', ['config', '--get', 'remote.origin.url']));

if (!repo) {
  console.error('[build:release] Unable to determine GitHub repo. Set GITHUB_REPOSITORY=owner/repo.');
  process.exit(1);
}

const version = process.env.US_VERSION
  || run('git', ['describe', '--tags', '--abbrev=0'])
  || run('git', ['rev-parse', '--short', 'HEAD'])
  || '';

const env = {
  ...process.env,
  US_BASE_URL: `https://github.com/${repo}/releases/latest/download`,
  ...(version ? { US_VERSION: version } : {})
};

const result = spawnSync('node', ['scripts/build.mjs'], {
  stdio: 'inherit',
  env
});

process.exit(result.status ?? 1);
