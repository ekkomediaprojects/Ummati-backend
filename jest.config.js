module.exports = {
  testEnvironment: 'node',
  verbose: true,
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coveragePathIgnorePatterns: [
    '/node_modules/',
    '/tests/'
  ],
  testMatch: [
    '**/tests/**/*.test.js'
  ],
  testEnvironmentOptions: {
    url: 'http://localhost:5002'
  },
  injectGlobals: true,
  setupFiles: ['<rootDir>/tests/testEnv.js'],
  testTimeout: 30000,
  maxWorkers: 1
}; 