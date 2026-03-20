import { spawn } from 'node:child_process';

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function runStep(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      shell: process.platform === 'win32',
      ...options,
    });

    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(' ')} failed with code ${code}`));
    });
    child.on('error', reject);
  });
}

async function main() {
  const python = process.env.PYTHON || 'python';
  const env = {
    ...process.env,
    SECRET_KEY: process.env.SECRET_KEY || 'e2e-django-secret',
    DEBUG: process.env.DEBUG || 'True',
    DB_ENGINE: process.env.DB_ENGINE || 'postgresql',
    DB_NAME: process.env.DB_NAME || 'rtp3',
    DB_USER: process.env.DB_USER || 'rtp3',
    DB_PASSWORD: process.env.DB_PASSWORD || 'rtp3',
    DB_HOST: process.env.DB_HOST || '127.0.0.1',
    DB_PORT: process.env.DB_PORT || '5432',
    DB_SSLMODE: process.env.DB_SSLMODE || 'disable',
    SERVE_FRONTEND_FROM_DJANGO: process.env.SERVE_FRONTEND_FROM_DJANGO || 'True',
    AUTH_REFRESH_COOKIE_ENABLED: process.env.AUTH_REFRESH_COOKIE_ENABLED || 'True',
    AUTH_RETURN_REFRESH_TOKEN_IN_BODY: process.env.AUTH_RETURN_REFRESH_TOKEN_IN_BODY || 'False',
    AUTH_REFRESH_REQUIRE_CSRF: process.env.AUTH_REFRESH_REQUIRE_CSRF || 'True',
    CORS_ALLOW_CREDENTIALS: process.env.CORS_ALLOW_CREDENTIALS || 'True',
    CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS || 'http://127.0.0.1:8000',
    CSRF_TRUSTED_ORIGINS: process.env.CSRF_TRUSTED_ORIGINS || 'http://127.0.0.1:8000',
    SECURE_SSL_REDIRECT: process.env.SECURE_SSL_REDIRECT || 'False',
    SESSION_COOKIE_SECURE: process.env.SESSION_COOKIE_SECURE || 'False',
    CSRF_COOKIE_SECURE: process.env.CSRF_COOKIE_SECURE || 'False',
    AUTH_REFRESH_COOKIE_SECURE: process.env.AUTH_REFRESH_COOKIE_SECURE || 'False',
  };

  await runStep(npmCommand, ['run', 'build'], { env });
  await runStep(python, ['backend/manage.py', 'migrate'], { env });
  await runStep(python, ['backend/manage.py', 'seed_references'], { env });
  await runStep(python, ['backend/manage.py', 'seed_technologies'], { env });
  await runStep(python, ['backend/manage.py', 'seed_users', '--reset-passwords'], { env });

  const server = spawn(python, ['backend/manage.py', 'runserver', '127.0.0.1:8000'], {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });

  const shutdown = () => {
    if (!server.killed) {
      server.kill('SIGTERM');
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  server.on('exit', (code) => process.exit(code ?? 0));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
