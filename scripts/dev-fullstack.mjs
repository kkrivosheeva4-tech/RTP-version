import { existsSync } from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';

let shuttingDown = false;
const children = [];

function runProcess(name, command, env = process.env) {
  const child = spawn(command, {
    shell: true,
    stdio: 'inherit',
    env
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

function pythonHasDjango(pythonCmd) {
  const result = spawnSync(`${pythonCmd} -c "import django"`, {
    shell: true,
    stdio: 'ignore'
  });
  return result.status === 0;
}

function commandExists(command) {
  const result = spawnSync(`${command} --version`, {
    shell: true,
    stdio: 'ignore'
  });
  return result.status === 0;
}

function resolvePythonCommand() {
  const candidates = [];

  if (process.env.RMK_BACKEND_PYTHON) {
    candidates.push(process.env.RMK_BACKEND_PYTHON);
  }

  const venvCandidates = [
    path.resolve('backend/.venv/Scripts/python.exe'),
    path.resolve('backend/venv/Scripts/python.exe')
  ];
  for (const candidate of venvCandidates) {
    if (existsSync(candidate)) {
      candidates.push(`"${candidate}"`);
    }
  }

  candidates.push('py -3', 'python');

  for (const candidate of candidates) {
    if (pythonHasDjango(candidate)) {
      return { python: candidate, hasDjango: true };
    }
  }

  for (const candidate of candidates) {
    if (commandExists(candidate)) {
      return { python: candidate, hasDjango: false };
    }
  }

  return { python: 'python', hasDjango: false };
}

const { python, hasDjango } = resolvePythonCommand();
if (!hasDjango) {
  console.error('[dev:fullstack] Django is not installed in the selected Python environment.');
  console.error(`[dev:fullstack] install dependencies: ${python} -m pip install -r backend/requirements.txt`);
  console.error('[dev:fullstack] or set RMK_BACKEND_PYTHON to your venv python executable.');
  process.exit(1);
}

const backendCommand =
  process.env.RMK_BACKEND_CMD || `${python} backend/manage.py runserver 127.0.0.1:8000`;

const backendEnv = {
  ...process.env,
  DEBUG: process.env.DEBUG || 'True',
  ENFORCE_ENV_SECURITY: process.env.ENFORCE_ENV_SECURITY || 'False',
  SERVE_FRONTEND_FROM_DJANGO: process.env.SERVE_FRONTEND_FROM_DJANGO || '1'
};

console.log('[dev:fullstack] frontend build is separated from app start (run `npm run build` manually).');
console.log(`[dev:fullstack] starting Django single-port mode: ${backendCommand}`);
console.log('[dev:fullstack] open http://127.0.0.1:8000/');

runProcess('backend', backendCommand, backendEnv);
