ARG KBN_VERSION

FROM docker.elastic.co/kibana/kibana:${KBN_VERSION}

ARG ROR_FILE
ARG ROR_ACTIVATION_KEY

ENV ROR_ACTIVATION_KEY=$ROR_ACTIVATION_KEY

COPY images/kbn/$ROR_FILE /tmp/ror.zip

RUN /usr/share/kibana/bin/kibana-plugin install file:///tmp/ror.zip

USER root

RUN /usr/share/kibana/node/bin/node plugins/readonlyrestkbn/ror-tools.js patch && \
    chown -R kibana:kibana /usr/share/kibana/config

USER kibana

COPY conf/kbn/kibana.yml /usr/share/kibana/config/kibana.yml
COPY conf/kbn/custom_kibana.css /usr/share/kibana
COPY conf/kbn/custom_kibana.js /usr/share/kibana
COPY conf/kbn/custom_login.css /usr/share/kibana
COPY conf/kbn/custom_login.js /usr/share/kibana
COPY conf/kbn/custom_middleware_default_tenant_file.js /usr/share/kibana
COPY conf/kbn/custom_middleware_file.js /usr/share/kibana
