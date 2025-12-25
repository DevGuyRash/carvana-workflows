import { spawn } from 'node:child_process';

function run(command, args, name) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true,
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

const server = run('npm', ['run', 'serve:userscripts'], 'serve');
const watcher = run('npm', ['run', 'build:watch'], 'build');

const shutdown = (signal) => {
  if (server) server.kill(signal);
  if (watcher) watcher.kill(signal);
};

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
