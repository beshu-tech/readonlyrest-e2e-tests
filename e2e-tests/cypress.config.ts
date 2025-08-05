import { defineConfig } from 'cypress';

export default defineConfig({
  env: {
    login: 'admin',
    password: 'dev',
    kibanaVersion: 'KIBANA_VERSION_NOT_SET_YET',
    elasticsearchUrl: 'https://localhost:9200',
    enterpriseActivationKey: 'PROVIDE_YOUR_ACTIVATION_KEY',
    kibanaUserCredentials: 'kibana:kibana',
    envName: 'elk-ror' // 'elk-ror' or 'eck-ror'
  },
  video: true,
  screenshotOnRunFailure: true,
  viewportWidth: 1280,
  viewportHeight: 720,
  defaultCommandTimeout: 20000,
  execTimeout: 20000,
  requestTimeout: 10000,
  responseTimeout: 20000,
  pageLoadTimeout: 20000,
  taskTimeout: 20000,
  defaultBrowser: 'firefox',
  retries: {
    openMode: 2,
    runMode: 2
  },
  e2e: {
    // We've imported your old cypress plugins here.
    // You may want to clean this up later by importing these.
    setupNodeEvents(on, config) {
      // eslint-disable-next-line @typescript-eslint/no-var-requires,global-require
      return require('./cypress/plugins/index.ts')(on, config);
    },
    baseUrl: 'https://localhost:5601',
    videosFolder: '../results/videos',
    screenshotsFolder: '../results/screenshots'
  }
});
