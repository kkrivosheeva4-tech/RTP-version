import { startVitest } from 'vitest/node';

const exitCode = async () => {
  const ctx = await startVitest(
    'test',
    [],
    {
      watch: false,
      config: false,
      root: process.cwd(),
      globals: true,
      environment: 'jsdom',
      setupFiles: ['./vitest.setup.js'],
      include: ['src/**/*.test.{js,ts,jsx,tsx,mjs,cjs}'],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/e2e/**',
        '**/playwright-report/**',
        '**/test-results/**',
        '**/.{idea,git,cache,output,temp}/**'
      ],
      pool: 'threads',
      maxWorkers: 1
    },
    {
      configFile: false,
      resolve: {
        preserveSymlinks: true
      }
    }
  );

  await ctx?.close();
  process.exit(process.exitCode ?? 0);
};

exitCode().catch((error) => {
  console.error(error);
  process.exit(1);
});
