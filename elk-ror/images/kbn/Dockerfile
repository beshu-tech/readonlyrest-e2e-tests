ARG KBN_VERSION

FROM docker.elastic.co/kibana/kibana:${KBN_VERSION}

ARG KBN_ROR_FILE
ARG ROR_ACTIVATION_KEY

ENV ROR_ACTIVATION_KEY=$ROR_ACTIVATION_KEY

COPY plugins/$KBN_ROR_FILE /tmp/ror.zip

RUN /usr/share/kibana/bin/kibana-plugin install file:///tmp/ror.zip

USER root

RUN \
  NODE_PATH="" && \
  if [ -x "/usr/share/kibana/node/bin/node" ]; then \
    NODE_PATH="/usr/share/kibana/node/bin/node"; \
  elif [ -x "/usr/share/kibana/node/glibc-217/bin/node" ]; then \
    NODE_PATH="/usr/share/kibana/node/glibc-217/bin/node"; \
  else \
    echo "Cannot find the Node binary! Please report the problem!"; \
    exit 1; \
  fi && \
  INVOKE_ROR_TOOLS="$NODE_PATH /usr/share/kibana/plugins/readonlyrestkbn/ror-tools.js" && \
  $INVOKE_ROR_TOOLS patch && \
  chown -R kibana:kibana /usr/share/kibana/config

USER kibana

COPY elk-ror/conf/kbn/kibana.yml /usr/share/kibana/config/kibana.yml
COPY elk-ror/conf/kbn/kibana.key /usr/share/kibana/config/kibana.key
COPY elk-ror/conf/kbn/kibana.crt /usr/share/kibana/config/kibana.crt
