FROM cruizba/ubuntu-dind:focal-26.1.4

ARG UID
ARG GID

# Install right node version
ENV NODE_VERSION v20.15.1
ENV DEBIAN_FRONTEND=noninteractive

USER root

RUN GID=${GID:-1000} && \
    UID=${UID:-1000} && \
    groupadd -g ${GID} hostgroup || echo "Group ${GID} already exists" && \
    useradd -m -u ${UID} -g ${GID} -s /bin/bash hostuser || echo "User ${UID} already exists" && \
    apt-get update --fix-missing && \
    apt-get install -y git jq curl zip unzip build-essential net-tools libgtk2.0-0 libgtk-3-0 libgbm-dev libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 libxtst6 xauth xvfb && \
    rm -rf /var/lib/apt/lists/* 

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash && \
    export NVM_DIR="$HOME/.nvm" && \
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh" && \
    nvm install $NODE_VERSION && \
    nvm use --delete-prefix $NODE_VERSION 

ENV NODE_PATH $NVM_DIR/versions/node/$NODE_VERSION/bin
ENV PATH $NODE_PATH:$PATH
ENV ES_VERSIONS=""

WORKDIR /app

COPY docker-based-ror-dev-env/src/processRorEnvCommand.sh /usr/local/bin/processRorEnvCommand.sh
COPY docker-based-ror-dev-env/src/dockerEntrypoint.sh /usr/local/bin/dockerEntrypoint.sh

ENTRYPOINT ["dockerEntrypoint.sh"]

CMD ["build-plugin"]