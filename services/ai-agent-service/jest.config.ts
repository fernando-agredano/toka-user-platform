import type { Config } from 'jest';
const config: Config = {
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: { '^.+\\.ts$': 'ts-jest' },
  setupFiles: ['reflect-metadata', '<rootDir>/test/setup.ts'],
  moduleNameMapper: { '^@toka/common$': '<rootDir>/../../packages/common/src' },
  collectCoverageFrom: [
    'src/domain/**/*.ts',
    'src/application/**/*.ts',
    'src/infrastructure/llm/{gemini,ollama,mock}.provider.ts',
    'src/infrastructure/llm/create-llm-chain.ts',
    'src/infrastructure/config/ai-config.ts',
    'src/infrastructure/knowledge/fs-knowledge.source.ts',
    '!src/application/dtos/**',
    '!src/application/ports/**',
    '!src/**/*.module.ts',
  ],
  coverageThreshold: {
    global: { branches: 70, functions: 70, lines: 70, statements: 70 },
  },
};
export default config;
