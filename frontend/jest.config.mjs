/** @type {import('jest').Config} */
export default {
  testEnvironment: 'jest-fixed-jsdom',
  roots: ['<rootDir>/test'],
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
  moduleNameMapper: { '^@/(.*)$': '<rootDir>/src/$1' },
  transform: {
    '^.+\\.[cm]?[tj]sx?$': [
      '@swc/jest',
      {
        jsc: { parser: { syntax: 'typescript', tsx: true }, transform: { react: { runtime: 'automatic' } } },
        module: { type: 'commonjs' },
      },
    ],
  },
  // MSW and its dependencies ship ESM-only builds, so they must be transpiled to run under Jest's CJS runtime.
  transformIgnorePatterns: [
    '/node_modules/(?!(msw|@mswjs|@open-draft|until-async|rettime|outvariant|strict-event-emitter|is-node-process|path-to-regexp)/)',
  ],
  collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/main.tsx', '!src/vite-env.d.ts'],
  coverageReporters: ['text', 'html'],
};
