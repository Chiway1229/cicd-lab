import type { TestUserConfig, ViteUserConfig } from 'vitest/config';

type VitestConfig = ViteUserConfig & {
  test?: TestUserConfig;
};

const isCI = !!process.env.CI;

const config: VitestConfig = {
  test: {
    exclude: ['dist/**', 'node_modules/**'],
    reporters: isCI ? ['verbose', 'junit'] : ['verbose'],
    outputFile: {
      junit: './test-results/junit.xml'
    }
  }
};

export default config;
