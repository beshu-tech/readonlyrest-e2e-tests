# MIRROR is the registry prefix that the start script pulled the image below from, before the
# build. The build then finds the image on this machine. An empty MIRROR means Docker Hub.
# The start script reads the image name from the FROM line, so keep the `${MIRROR}library/` form.
ARG MIRROR=
FROM ${MIRROR}library/node:20@sha256:8f693eaa7e0a8e71560c9a82b55fd54c2ae920a2ba5d2cde28bac7d1c01c9ba5

WORKDIR /example-app

# --before resolves the transitive versions as they were on that date. Without it, a release
# published seconds before the build can fail it with ETARGET. Move the date to update.
# The loop gives the install 3 attempts: the registry can drop a connection or answer 429.
RUN attempt=1; \
    until npm install --no-audit --no-fund --before=2026-10-05 elastic-apm-node@4.18.0 express@5.2.1; do \
      [ "$attempt" -lt 3 ] || exit 1; \
      sleep $((attempt * 10)); \
      attempt=$((attempt + 1)); \
    done

COPY ./app.js /example-app

EXPOSE 3000

ENTRYPOINT ["node", "app.js"]
