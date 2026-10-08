# MIRROR puts a pull-through cache in front of the Docker Hub name below.
# .github/scripts/docker-hub-mirror.sh sets it in CI, and it is empty when the mirror is off. A local
# build passes nothing and pulls from Docker Hub.
#
# `library/` is the namespace of an official image, so the name resolves with the prefix and without
# it, to the same digest.
ARG MIRROR=
FROM ${MIRROR}library/node:20@sha256:8f693eaa7e0a8e71560c9a82b55fd54c2ae920a2ba5d2cde28bac7d1c01c9ba5

WORKDIR /example-app

# --before resolves the transitive versions as they were on that date. Without it, a release
# published seconds before the build can fail it with ETARGET. Move the date to update.
RUN npm install --no-audit --no-fund --before=2026-10-05 elastic-apm-node@4.18.0 express@5.2.1

COPY ./app.js /example-app

EXPOSE 3000

ENTRYPOINT ["node", "app.js"]
