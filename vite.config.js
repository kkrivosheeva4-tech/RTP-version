import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';

export default defineConfig({
  root: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        'index': path.resolve(__dirname, 'index.html'),
        'src/pages/index': path.resolve(__dirname, 'src/pages/index.html'),
        'src/pages/radar': path.resolve(__dirname, 'src/pages/radar.html'),
        'src/pages/admin': path.resolve(__dirname, 'src/pages/admin.html'),
        'src/pages/auth': path.resolve(__dirname, 'src/pages/auth.html'),
        'src/pages/auth-2fa-setup': path.resolve(__dirname, 'src/pages/auth-2fa-setup.html'),
        'src/pages/auth-2fa-verify': path.resolve(__dirname, 'src/pages/auth-2fa-verify.html'),
        'src/pages/help': path.resolve(__dirname, 'src/pages/help.html'),
      },
    },
  },
  server: {
    port: 5173,
    // Прокси для будущего backend API (раскомментировать при подключении API):
    // proxy: {
    //   '/api': {
    //     target: 'http://localhost:8000',
    //     changeOrigin: true,
    //   },
    // },
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@data': fileURLToPath(new URL('./src/data', import.meta.url)),
    },
  },
  // JSON из /src/data/ru/*.json загружаются через fetch(); в production копируются плагином copyDataPlugin
  assetsInclude: ['**/*.json', 'src/data/ru/**/*.json'],
  plugins: [
    {
      name: 'copy-data',
      closeBundle() {
        const root = process.cwd();
        const distSrc = path.join(root, 'dist', 'src');

        // 1) JSON данные для fetch(/src/data/ru/...)
        const srcData = path.join(root, 'src', 'data');
        const destData = path.join(distSrc, 'data');
        if (fs.existsSync(srcData)) {
          fs.mkdirSync(distSrc, { recursive: true });
          copyRecursiveSync(srcData, destData);
        }

        // 2) Скрипты, подключаемые через <script src="/src/js/..."> (auth, admin, help)
        const srcJs = path.join(root, 'src', 'js');
        const destJs = path.join(distSrc, 'js');
        if (fs.existsSync(srcJs)) {
          fs.mkdirSync(distSrc, { recursive: true });
          copyRecursiveSync(srcJs, destJs);
        }
      },
    },
  ],
});

function copyRecursiveSync(src, dest) {
  const exists = fs.existsSync(src);
  if (!exists) return;
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const entry of fs.readdirSync(src)) {
      copyRecursiveSync(path.join(src, entry), path.join(dest, entry));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}
