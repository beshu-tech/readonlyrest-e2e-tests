# End-to-end test for ReadonlyREST security plugins

## Running 

### On your host

Prerequisites:
* Yarn (`1.22.x` or newer) - for running E2E tests
* Docker (`27.x.x` or newer) - for running ELK environment
* [Kind](https://kind.sigs.k8s.io/) (`0.26.x` or newer) - for running ECK environment

#### E2E with one command

`runner.sh` bootstraps the environment and runs Cypress E2E tests in one shot.

**Docker-based environment:**
```bash
./runner.sh --elk 8.15.2 --env docker
```

**ECK environment** (pass the ECK operator version after `eck-`):
```bash
./runner.sh --elk 7.17.24 --env eck-2.15.0
```

**With specific ROR versions** (default: `latest`):
```bash
./runner.sh --elk 9.3.0 --env docker --ror-es 1.69.0 --ror-kbn 1.69.0
```

**With dev images** (default: `prod`):
```bash
./runner.sh --elk 9.3.0 --env docker --ror-es 1.69.0-pre1 --ror-kbn 1.69.0-pre1 --mode dev
```

To only bootstrap the environment without running tests (useful for debugging):
```bash
./runner.sh --run bootstrap --elk 8.15.2 --env docker
```

#### Tested environment & E2E tests separately

You can bootstrap the test env and run tests separately (to not build the ES+KBN+ROR stack every test run). 

To run the env:

(running the latest version of ROR from Docker Hub production repo)
```bash
./environments/elk-ror/start.sh --es "8.15.0" --kbn "8.15.2"
```

(running the given version of ROR from Docker Hub development repo)
```bash
./environments/elk-ror/start.sh --es "8.15.0" --kbn "8.15.2" --ror-es 1.62.0-pre5 --ror-kbn 1.62.0-pre5 --mode dev
```

or

(running the latest version of ROR from Docker Hub production repo)
```bash
./environments/eck-ror/start.sh --es "8.15.0" --kbn "8.15.2"
```

(running the given version of ROR from Docker Hub development repo)
```bash
./environments/eck-ror/start.sh --es "8.15.0" --kbn "8.15.2" --ror-es 1.62.0-pre5 --ror-kbn 1.62.0-pre5 --mode dev
```

To run tests on the env from a docker environment:
```bash
./e2e-tests/run-tests.sh  "8.15.2" "elk-ror"
```

To run tests on the env from eck environment:
```bash
./e2e-tests/run-tests.sh  "8.15.2" "eck-ror"
```

#### Cypress tests in interactive GUI

```bash
cd e2e-tests; yarn cypress open --env kibanaVersion=[KBN_VERSION]
```

### In docker isolated environment 

Prerequisites:
* Docker (`26.x.x` or newer)

#### E2E with one command 

Bootstrapping test environment and running tests inside a docker container (you don't need to have Yarn installed on your host - it's a docker-compose based environment):

```bash
$ ./docker-based-ror-dev-env/runE2ETests8xInDocker.sh
```

```bash
$ ./docker-based-ror-dev-env/runE2ETests7xInDocker.sh
```

## Development

### Conventions

- [docs/dev/branching.md](docs/dev/branching.md) — the two long-lived branches, which one a PR targets, and the merges between them.
- [docs/dev/code-style.md](docs/dev/code-style.md) — the rules for comments: what a comment says, where it goes, and what deserves one.
- [docs/dev/writing-style.md](docs/dev/writing-style.md) — the language we write in, and the rules it gives us.

### Test environment 

The test environment is created with the Docker Compose. All code is located in the `environments/elk-ror` folder. Currently, the latest version of ROR is downloaded for the sake of tests. In the future, we are going to improve it and build plugins from sources too.

### Cypress tests

The Cypress-based tests are located in the `e2e-tests/cypress/e2e`. Screenshots and videos for test runs will be stored in `results/videos` and `results/snapshots` folders.

### HTTP API tests

The tests in `e2e-tests/http` call the Elasticsearch and the Kibana API and never open a page, so they need no browser and no `yarn install`. They run on Node's own test runner, against the same stack as the Cypress suite, and `runner.sh` starts them immediately before it. A test belongs here when it asserts on an API answer alone; a test that reads what Kibana renders belongs in Cypress.

To run them against a stack that is already up (the environment name is optional and only names the
environment in a failure message):
```bash
./e2e-tests/http/run-tests.sh "8.15.2" "eck-ror"
```

Before the first test, the suite asks Elasticsearch and Kibana whether they answer. A stack that is
not there fails the run in seconds, with the address it could not reach, instead of letting every
test wait out its own deadline. Four environment variables move the deadlines:

| Variable | Default | What it bounds |
|---|---|---|
| `HTTP_READINESS_TIMEOUT_MS` | `180000` | the wait for Elasticsearch and Kibana to answer, before the tests |
| `HTTP_REQUEST_TIMEOUT_MS` | `30000` | one request, from the connection to the last byte of the body |
| `HTTP_TEST_TIMEOUT_MS` | `90000` | one test |
| `HTTP_SUITE_TIMEOUT_SECONDS` | `600` | the whole `node --test` run |

### Docker-based ROR development environment 

If you prefer, you can use scripts from the `docker-based-ror-dev-env` folder to run them inside a docker container of the Docker-based ROR development environment image. It's not needed, but it can be helpful in the following cases:
1. you don't want to install Yarn (or any other JS-related tools) on your host
2. you want to test if maybe there is some problem with your tools installed on the host
3. you want to check what has to be installed to run the stack with no issues
4. it can be used in the pipeline if you want to use custom runners without special preparation for them

### Docker Hub pull mirror

The CI jobs pull the Docker Hub base images through `mirror.gcr.io`, a pull-through cache. Docker Hub
limits pulls per IP address, a runner shares its address with other tenants, and a neighbour over the
limit makes our pull fail with a bare `429`. A login does not prevent that, because the limit ignores
the account.

`.github/scripts/docker-hub-mirror.sh` holds the setting and says which image names read it. A local
run pulls from Docker Hub, and `ROR_DOCKER_HUB_MIRROR=false` switches the mirror off in CI.

## Troubleshooting

Remember that most of the tests assume that ROR KBN is run with the Enterprise license. You have to set it on your host as an [environment variable](https://www.baeldung.com/linux/bash-set-and-export#export-command-in-bash) `ROR_ACTIVATION_KEY`. You can obtain a trial activation key in the [Customer Portal](https://readonlyrest.com/customer) or use the developer one. 