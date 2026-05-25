import js from '@eslint/js';
import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import prettierPlugin from 'eslint-plugin-prettier';
import globals from 'globals';
import path from 'path';
import { URL } from 'url';

// Using import.meta.url to get the directory of the current file
const __dirname = new URL('.', import.meta.url).pathname.replace(/^\//, '');

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'], // Specify the file types for ESLint
    ignores: [
      'node_modules/',
      'dist/',
      'package.json',
      'yarn.lock',
      'ios',
      "client/**",
      'android',
      'assets',
      '.vscode',
      '.expo-shared',
      '.prettirrc',
      'eslint.config.mjs',
      '__tests__/',
    ],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: typescriptParser,
      parserOptions: {
        project: './tsconfig.json',
        ecmaVersion: 2021,
        sourceType: 'module',
      },
  },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
      prettier: prettierPlugin,
    },
    settings: {
      'import/resolver': {
        typescript: {
          project: path.resolve(__dirname, './tsconfig.json'),
        },
      },
    },
    rules: {
      // "linebreak-style": ["error", "unix"],

      // Quote rules
      quotes: ['error', 'single', { avoidEscape: true }],

      // Unused variables
      "@typescript-eslint/no-unused-vars": ["warn", { "args": "none" }],

      // Explicit any rule
      '@typescript-eslint/no-explicit-any': 'error',

      // Console log restriction
      'no-console': ['error', { allow: ['warn', 'error'] }],

      // Additional rules
      'react-native/no-inline-styles': 'off',
      'import/namespace': 'off',
      'no-duplicate-imports': 'error',
    },
  },
];

