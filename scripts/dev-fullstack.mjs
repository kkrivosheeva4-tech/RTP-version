import { spawn } from 'node:child_process';

let shuttingDown = false;
const children = [];

function runProcess(name, command) {
  const child = spawn(command, {
    shell: true,
    stdio: 'inherit',
    env: process.env
  });

  children.push({ name, child });

  child.on('exit', (code, signal) => {
    if (shuttingDown) return;
    const reason = signal ? `signal ${signal}` : `code ${code}`;
    console.error(`[dev:fullstack] ${name} exited with ${reason}`);
    shutdown(1);
  });

  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  for (const { child } of children) {
    try {
      child.kill('SIGTERM');
    } catch (_) {
      // ignore
    }
  }

  setTimeout(() => {
    for (const { child } of children) {
      try {
        child.kill('SIGKILL');
      } catch (_) {
        // ignore
      }
    }
    process.exit(exitCode);
  }, 1200);
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

const backendCommand = process.env.RMK_BACKEND_CMD || 'python backend/manage.py runserver';
const frontendCommand = process.env.RMK_FRONTEND_CMD || 'npm run dev';

console.log(`[dev:fullstack] starting backend: ${backendCommand}`);
console.log(`[dev:fullstack] starting frontend: ${frontendCommand}`);

runProcess('backend', backendCommand);
runProcess('frontend', frontendCommand);
