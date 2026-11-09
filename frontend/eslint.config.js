import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, {
  files: ['**/*.{ts,tsx}'],
  languageOptions: { globals: { window: 'readonly', document: 'readonly', fetch: 'readonly', crypto: 'readonly', FormData: 'readonly', Headers: 'readonly', URL: 'readonly', File: 'readonly', RequestInit: 'readonly', console: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' } },
  rules: { '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }] }
});
