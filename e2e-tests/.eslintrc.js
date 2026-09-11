// typescript-eslint has no TS 7 support yet; point it at the TS 6 API (see the shim).
require('./scripts/register-typescript-eslint-compat.cjs');

module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  extends: ['prettier', 'plugin:@typescript-eslint/eslint-recommended', 'plugin:@typescript-eslint/recommended'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['@typescript-eslint', 'prettier'],
  settings: {
    'import/extensions': ['.js', '.ts'],
    'import/resolver': {
      node: {
        extensions: ['.js', '.ts']
      }
    }
  },
  rules: {
    // @typescript-eslint 8 promotes these to errors in `recommended`. The suite predates that; keep
    // them visible as warnings until a dedicated cleanup, so a toolchain bump does not rewrite tests.
    '@typescript-eslint/no-explicit-any': 'warn',
    '@typescript-eslint/no-unused-vars': ['warn', { args: 'none' }],
    '@typescript-eslint/no-unused-expressions': 'warn',
    '@typescript-eslint/no-require-imports': 'warn',
    'prettier/prettier': 'error',
    'import/extensions': 'off',
    'import/no-extraneous-dependencies': 'off',
    'import/prefer-default-export': 0,
    'no-plusplus': [2, { allowForLoopAfterthoughts: true }],
    'no-shadow': 'off',
    '@typescript-eslint/no-shadow': 'off',
    '@typescript-eslint/ban-ts-comment': 'off',
    'no-param-reassign': 'off',
    camelcase: 'off',
    'no-new': 'off',
    'no-underscore-dangle': 'off',
    'no-console': 'off',
    'no-alert': 'off',
    'no-template-curly-in-string': 'off',
    'max-classes-per-file': 'off',
    'no-useless-constructor': 'off',
    'class-methods-use-this': 'off',
    'import/no-unresolved': 'off',
    'consistent-return': 'off',
    'no-restricted-syntax': 'off',
    'no-ex-assign': 'off',
    'no-continue': 'off',
    'import/no-relative-packages': 'off',
    'default-param-last': 'off',
    'func-names': 'off',
    'prefer-destructuring': ['error', { AssignmentExpression: { array: false } }]
  }
};
