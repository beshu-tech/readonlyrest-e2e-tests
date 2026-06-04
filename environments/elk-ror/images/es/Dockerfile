ARG ROR_ES_REPO
ARG ES_VERSION
ARG ROR_ES_VERSION

FROM ${ROR_ES_REPO}:${ES_VERSION}-ror-${ROR_ES_VERSION}

USER elasticsearch

COPY conf/es/readonlyrest.yml /usr/share/elasticsearch/config/readonlyrest.yml
COPY conf/es/elasticsearch.yml /usr/share/elasticsearch/config/elasticsearch.yml
COPY conf/es/log4j2.properties /usr/share/elasticsearch/config/ror/log4j2.properties
COPY certs/ca.crt /usr/share/elasticsearch/config/ca.crt
COPY certs/elasticsearch.crt /usr/share/elasticsearch/config/elasticsearch.crt
COPY certs/elasticsearch.csr /usr/share/elasticsearch/config/elasticsearch.csr
COPY certs/elasticsearch.key /usr/share/elasticsearch/config/elasticsearch.key

ENV I_UNDERSTAND_AND_ACCEPT_ES_PATCHING yes
USER root
