import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    env: {
      JWT_SECRET: 'test-jwt-secret-do-not-use-in-prod',
      ENCRYPTION_KEY: 'test-encryption-key-32-bytes!!!!',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
      GITHUB_CLIENT_ID: 'test-client-id',
      GITHUB_CLIENT_SECRET: 'test-client-secret',
      // Vite reserves BASE_URL as its own built-in (defaults to "/") and injects it
      // into process.env under vitest — override so it doesn't collide with ours.
      BASE_URL: 'http://localhost:3000',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
});
