/** Gate tests: deterministas, locales, sin red. */
module.exports = {
  preset: 'jest-expo',
  testMatch: ['**/tests/**/*.test.{ts,tsx}'],
  setupFilesAfterEnv: ['<rootDir>/tests/preparar.ts'],
};
