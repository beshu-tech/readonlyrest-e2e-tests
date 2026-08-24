# MIRROR puts a pull-through cache in front of the Docker Hub name below.
# .github/scripts/docker-hub-mirror.sh sets it in CI, and it is empty when the mirror is off. A local
# build passes nothing and pulls from Docker Hub.
#
# `library/` is the namespace of an official image, so the name resolves with the prefix and without
# it, to the same digest.
ARG MIRROR=
FROM ${MIRROR}library/node:20

RUN apt-get update && apt-get install -y --fix-missing\
    vim \
    curl \
    libc6-amd64-cross && \
    ln -s /usr/x86_64-linux-gnu/lib64/ /lib64
RUN mkdir -p /example-app

WORKDIR /example-app

RUN npm install elastic-apm-node express

COPY ./app.js /example-app

EXPOSE 3000

ENTRYPOINT ["node", "app.js"]
