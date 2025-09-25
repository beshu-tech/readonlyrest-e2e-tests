ARG KBN_VERSION="UNDEFINED_KBN_VERSION"
ARG ROR_KBN_REPO="UNDEFINED_ROR_ES_REPO"
ARG ROR_KBN_VERSION="UNDEFINED_ROR_ES_VERSION"

FROM docker.elastic.co/kibana/kibana:${KBN_VERSION}

ARG ROR_ACTIVATION_KEY

USER kibana

COPY conf/kbn/kibana.yml /usr/share/kibana/config/kibana.yml
COPY certs/kibana.key /usr/share/kibana/config/kibana.key
COPY certs/kibana.crt /usr/share/kibana/config/kibana.crt
COPY images/kbn/readonlyrest_kbn_universal-1.67.0-pre3_es9.1.4.zip /usr/share/kibana/ror.zip

ENV ROR_ACTIVATION_KEY=$ROR_ACTIVATION_KEY

ENV I_UNDERSTAND_AND_ACCEPT_KBN_PATCHING yes

USER root

RUN /usr/share/kibana/bin/kibana-plugin install file:///usr/share/kibana/ror.zip 
RUN /usr/share/kibana/node/glibc-217/bin/node plugins/readonlyrestkbn/ror-tools.js patch --I_UNDERSTAND_AND_ACCEPT_KBN_PATCHING=yes

# Install netstat
RUN (command -v microdnf >/dev/null && microdnf install -y net-tools && microdnf clean all) || \
    (command -v apt-get >/dev/null && apt-get update && apt-get install -y net-tools && rm -rf /var/lib/apt/lists/*) || \
    echo "Could not install net-tools, proceeding without it"

# Permissions for Kibana config editing from ReadonlyREST plugin
RUN chmod 777 /root
RUN chown -R kibana:kibana /usr/share/kibana/config
RUN chmod 664 /usr/share/kibana/config/kibana.yml

USER kibana