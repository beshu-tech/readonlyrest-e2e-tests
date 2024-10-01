/// <reference types="cypress" />
// ***********************************************************
// This example plugins/index.js can be used to load plugins
//
// You can change the location of this file or turn off loading
// the plugins file with the 'pluginsFile' configuration option.
//
// You can read more here:
// https://on.cypress.io/plugins-guide
// ***********************************************************

// This function is called when a project is opened or re-opened (e.g. due to
// the project's config changing)

/**
 * @type {Cypress.PluginConfig}
 */
// eslint-disable-next-line no-unused-vars
const fetch = require('node-fetch');

module.exports = (on, config) => {
  on('task', {
    fetchData(options) {
      console.log('options', options);

      const { url, ...rest } = options;
      return fetch(url, rest)
        .then(response => {
          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          return response.json(); // parse JSON from the response
        })
        .then(data => {
          return Promise.resolve(data); // return the JSON data
        })
        .catch(err => {
          console.log('request error', err);
          return Promise.reject(err); // if there's an error, reject the Promise
        });
    }
  });
};
