ARG KBN_VERSION="UNDEFINED_KBN_VERSION"
ARG ROR_KBN_REPO="UNDEFINED_ROR_ES_REPO"
ARG ROR_KBN_VERSION="UNDEFINED_ROR_ES_VERSION"

FROM ${ROR_KBN_REPO}:${KBN_VERSION}-ror-${ROR_KBN_VERSION}

ARG ROR_ACTIVATION_KEY

USER kibana

COPY conf/kbn/kibana.yml /usr/share/kibana/config/kibana.yml
COPY certs/kibana.key /usr/share/kibana/config/kibana.key
COPY certs/kibana.crt /usr/share/kibana/config/kibana.crt

ENV ROR_ACTIVATION_KEY=$ROR_ACTIVATION_KEY

ENV I_UNDERSTAND_AND_ACCEPT_KBN_PATCHING yes
USER root

# Install netstat
RUN apt-get update && apt-get install -y net-tools && rm -rf /var/lib/apt/lists/*

# Permissions for Kibana config editing from ReadonlyREST plugin
RUN chmod 777 /root
RUN chown -R kibana:kibana /usr/share/kibana/config
RUN chmod 664 /usr/share/kibana/config/kibana.yml