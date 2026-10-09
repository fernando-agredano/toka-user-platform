import type { Config } from 'jest';
const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: { '^.+\\.ts$': ['ts-jest', { isolatedModules: true }] },
  moduleNameMapper: { '^@toka/common$': '<rootDir>/../../packages/common/src' },
  collectCoverageFrom: [
    'src/domain/**/*.ts',
    'src/application/**/*.ts',
    'src/infrastructure/http/http-gateways.ts',
    'src/infrastructure/config/mcp-config.ts',
    'src/infrastructure/cache/*.ts',
    'src/presentation/mcp-server-factory.ts',
    '!src/application/dtos/**',
    '!src/application/ports/**',
  ],
  coverageThreshold: {
    global: { branches: 70, functions: 70, lines: 70, statements: 70 },
  },
};
export default config;
