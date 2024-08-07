# End-to-end test for ReadonlyREST security plugins

## Running 

### On your host

Prerequisites:
* Docker (`26.x.x` or newer)
* Yarn (`1.22.x` or newer)

#### E2E with one command 

To bootstrap a Docker-based test environment (ES with latest ROR + KBN with latest ROR) and run Cypress E2E tests run:

```bash
$ ./run-8x.sh
```

```bash
$ ./run-7x.sh
```

#### Tested environment & E2E tests separately

You can bootstrap the test env and run tests separately (to not build the ES+KBN+ROR stack every test run). 

To run the env:
```bash
$ ./elk-ror/run.sh --es "8.10.0" --kbn "8.10.0"
```

To run tests on the env:
```bash
$ ./e2e-tests/run.sh "8.10.0"
```

#### Cypress tests in interactive GUI

```bash
$ cd e2e-tests; yarn cypress open
```

### In docker isolated environment 

Prerequisites:
* Docker (`26.x.x` or newer)

#### E2E with one command 

Bootstrapping test environment and running tests inside a docker container (you don't need to have Yarn installed on your host):

```bash
$ ./docker-based-ror-dev-env/runE2ETests8xInDocker.sh
```

```bash
$ ./docker-based-ror-dev-env/runE2ETests7xInDocker.sh
```

## Development

### Test environment 

The test environment is created with the Docker Compose. All code is located in the `elk-ror` folder. Currently, the latest version of ROR is downloaded for the sake of tests. In the future, we are going to improve it and build plugins from sources too.

### Cypress tests

The Cypress-based tests are located in the `e2e-tests/cypress/e2e`. Screenshots and videos for test runs will be stored in `results/videos` and `results/snapshots` folders.

### Docker-based ROR development environment 

If you prefer, you can use scripts from the `docker-based-ror-dev-env` folder to run them inside a docker container of the Docker-based ROR development environment image. It's not needed, but it can be helpful in the following cases:
1. you don't want to install Yarn (or any other JS-related tools) on your host
2. you want to test if maybe there is some problem with your tools installed on the host
3. you want to check what has to be installed to run the stack with no issues
4. it can be used in the pipeline if you want to use custom runners without special preparation for them

## Troubleshooting

Remember that most of the tests assume that ROR KBN is run with the Enterprise license. You have to set it on your host as an [environment variable](https://www.baeldung.com/linux/bash-set-and-export#export-command-in-bash) `ROR_ACTIVATION_KEY`. You can obtain a trial activation key in the [Customer Portal](https://readonlyrest.com/customer) or use the developer one. 