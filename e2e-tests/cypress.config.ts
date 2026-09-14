import { createRequire } from 'node:module';
import { defineConfig } from 'cypress';
import createBundler from '@bahmutov/cypress-esbuild-preprocessor';

export default defineConfig({
  chromeWebSecurity: false,
  // Only useful during interactive `cypress open`.
  watchForFileChanges: false,
  experimentalMemoryManagement: true,
  numTestsKeptInMemory: 0,
  env: {
    login: 'admin',
    password: 'dev',
    kibanaVersion: 'KIBANA_VERSION_NOT_SET_YET',
    elasticsearchUrl: 'https://localhost:9200',
    enterpriseActivationKey: 'PROVIDE_YOUR_ACTIVATION_KEY',
    kibanaUserCredentials: 'kibana:kibana',
    envName: 'PROVIDED_IN_THE_CYPRESS_SETUP_NODE_EVENTS' // 'elk-ror' or 'eck-ror'
  },
  video: true,
  videoCompression: false,
  screenshotOnRunFailure: true,
  viewportWidth: 1280,
  viewportHeight: 720,
  defaultCommandTimeout: 20000,
  execTimeout: 20000,
  requestTimeout: 10000,
  responseTimeout: 20000,
  pageLoadTimeout: 20000,
  taskTimeout: 20000,
  retries: {
    openMode: 2,
    runMode: 2
  },
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      // The default webpack + ts-loader preprocessor needs TypeScript's classic Program API, which
      // TypeScript 7 does not ship. esbuild strips the TypeScript syntax without it.
      on('file:preprocessor', createBundler({ tsconfigRaw: { compilerOptions: { target: 'es2015' } } }));
      // Cypress 15 loads this config through tsx, possibly as ESM, where bare `require` is absent.
      // @ts-expect-error TypeScript checks this project as CJS, but Cypress can load the config as ESM.
      const nodeRequire = createRequire(import.meta.url);
      nodeRequire('esbuild-register');
      return nodeRequire('./cypress/plugins/index.ts')(on, config);
    },
    baseUrl: 'https://localhost:5601',
    videosFolder: '../results/videos',
    screenshotsFolder: '../results/screenshots'
  }
});
