import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '.next/**',
      'out/**',
      'build/**',
      'dist/**',
      'scripts/sst-dream.mjs', // generated, committed drop-in bundle (see cli/build.mjs)
      'node_modules/**',
      'next-env.d.ts',
      'coverage/**',
      '**/*.snap',
      '.claude/**',
    ],
  },
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
);
