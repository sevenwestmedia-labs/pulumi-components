module.exports = {
  testMatch: ['**/+(*.)+(spec|test).+(ts|js)?(x)'],
  resolver: '@nrwl/jest/plugins/resolver',
  moduleFileExtensions: ['ts', 'js', 'html', 'json'],
  coverageReporters: ['html'],
  testEnvironment: 'jest-environment-node',
  transform: {
    '^.+\\.(ts|js|html)$': 'esbuild-jest',
  },
  maxWorkers: 4,
}
