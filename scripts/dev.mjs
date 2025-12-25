import { spawn } from 'node:child_process';

function run(command, args, name) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: false,
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      console.log(`[dev] ${name} exited via ${signal}`);
      return;
    }
    console.log(`[dev] ${name} exited with code ${code}`);
  });

  return child;
}

const isWindows = process.platform === 'win32';
const npmExecPath = process.env.npm_execpath;
const npmCommand = npmExecPath
  ? process.execPath
  : isWindows
    ? (process.env.ComSpec || 'cmd.exe')
    : 'npm';
const npmArgs = (args) => {
  if (npmExecPath) return [npmExecPath, ...args];
  return isWindows ? ['/d', '/s', '/c', 'npm', ...args] : args;
};

const server = run(npmCommand, npmArgs(['run', 'serve:userscripts']), 'serve');
const watcher = run(npmCommand, npmArgs(['run', 'build:watch']), 'build');

const shutdown = (signal) => {
  if (server) server.kill(signal);
  if (watcher) watcher.kill(signal);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
