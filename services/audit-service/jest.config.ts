import type { Config } from 'jest';
const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  setupFiles: ['reflect-metadata'],
  moduleNameMapper: { '^@toka/common$': '<rootDir>/../../packages/common/src' },
  collectCoverageFrom: [
    'src/domain/**/*.ts',
    'src/application/**/*.ts',
    '!src/application/dtos/**',
    '!src/**/*.module.ts',
  ],
  coverageThreshold: {
    global: { branches: 70, functions: 70, lines: 70, statements: 70 },
  },
};
export default config;
