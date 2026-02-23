import { spawn } from 'node:child_process';

function run(cmd, args, name) {
  const child = spawn(cmd, args, { stdio: 'inherit' });
  child.on('exit', (code) => {
    console.log(`[${name}] exited with code ${code ?? 0}`);
  });
  return child;
}

const wasm = run('npm', ['run', 'build:wasm'], 'build:wasm');

wasm.on('exit', (code) => {
  if (code !== 0) {
    process.exit(code ?? 1);
    return;
  }

  run('npm', ['run', 'build:extension'], 'build:extension');
});
