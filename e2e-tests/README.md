# Automatic tests
This folder contains all automatic tests we can run against specific elk stack and kibana plugin.
We use [cypress.io](https://www.cypress.io/) to write tests
## Installation
run `yarn install`

## Running
### via open command
Use cypress [test runner](https://docs.cypress.io/guides/core-concepts/test-runner) to perform all tests.  Use `yarn open` to run a script

Note: a video recording of tests is disabled here
### via run command
Use [command line](https://docs.cypress.io/guides/guides/command-line#cypress-run) to perform tests. Use `yarn run` to run a script


Note: a video recording of tests is enabled here
## browser support
[see](https://docs.cypress.io/guides/guides/cross-browser-testing#Continuous-Integration-Strategies)


## Versioning
You can run these tests only for a new platform (els stack >= `7.9.0`)

## Kibana version env variable
We are running tests against different versions of kibana, that's why sometimes we need to write different tests depending on the version of kibana.
That's why we need to define `kibanaVersion` as env variable, we can do it via
- `cypress.json` file and `env.kibanaVersion` parameter
- Declare it via CLI and `--env kibanaVersion=<KIBANA_VERSION>` [see](https://docs.cypress.io/guides/guides/environment-variables#Option-4-env).
  For example `yarn open --env kibanaVersion=7.13.1`.

CLI env value will override `cypress.json` value

## Limitations
- You can run the app against `local-testing` docker build
- To clear all data, you need to close and reopen the docker container
