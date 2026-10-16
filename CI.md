# CI

GitHub Actions runs the e2e suite. This page explains the rules that the workflow files apply.

## Workflows

| Workflow | Trigger | What it does |
|---|---|---|
| `all-e2e-tests.yml` | push to master or develop, pull request, nightly cron, manual | Runs the Cypress suite on every version under test, on docker and on ECK |
| `bootstrap-tests.yml` | Sunday cron (released images), Wednesday cron (dev images), manual (both) | Starts the stack on many more versions and stops. It runs no tests: the only check is that the stack comes up |
| `targeted-e2e-tests.yml` | manual | Runs the suite once, on one version and one environment that you choose |

**Images.** `prod` legs test the released plugin images. `dev` legs test images that the ES and Kibana plugin repos build for the run (the pre-build), tagged `run-<run id>-<attempt>`. A pull request to master tests prod images; a pull request to develop tests dev images. The nightly cron and a manual run test both.

## Runners

Each `runs-on` reads a JSON list of runner labels from a repository variable. Doppler (project `ror_ci`, config `prd`) syncs the variables, so a runner change needs no commit. While a variable is not set, the job runs on `ubuntu-24.04`.

| Variable | Jobs |
|---|---|
| `LIGHT_RUNS_ON` | plan jobs and the dev image pre-build |
| `E2E_REPO_RUNS_ON` | the jobs that start a stack |

## Versions under test

The plan job of each workflow gets the versions from `.github/scripts/resolve-test-versions.sh`. The script asks the ROR API (`https://api.beshu.tech/list_es_versions`) for the latest ROR release and the ELK versions that it supports. A version counts when both the ES and the Kibana plugin support it.

- **e2e**: the latest version of each major from 7, and of the two newest minors of the newest major.
- **bootstrap**: the latest version of each minor.

Prod legs test the latest ROR release, with the image tag `<ELK version>-ror-<ROR version>`. When the ROR API does not answer, the plan job fails and no leg starts.

## Time limits

| What | Limit | Why |
|---|---|---|
| e2e run | 75 minutes (`E2E_TIME_CAP_SECONDS`), for the stack start, the suite and the log collection | ECK answers more slowly than docker; the suite needs more than an hour there. `runner.sh` stops the suite 5 minutes before the cap, so it still collects the stack logs |
| e2e job (all and targeted) | 100 minutes | One e2e run plus set-up and upload. The GitHub default of 360 minutes keeps a hung step on the runner for 6 hours |
| bootstrap leg | 2 attempts of 30 minutes | A start-up that fails once for an infrastructure reason gets a second attempt |

## Retries

The suite runs once. A second run turns a flaky spec green and hides its cause.

Network steps retry: image pulls, package installs and manifest downloads use `retry <attempts> <command>` from `environments/common/retry.sh`.

## Artifacts

When a leg fails, `.github/upload-videos` uploads the Cypress videos, the screenshots and the stack logs to S3. Before the upload, each text file loses every secret in `secrets_to_redact` (one per line). A file that still holds a secret after that, for example a binary file, is not uploaded.

The uploader retries a transient answer of the storage, for 30 seconds per file. The upload stops at the first file that spends the whole budget, and at a wrong setting of the uploader. Every later file meets the same answer.
