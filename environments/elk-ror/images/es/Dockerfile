ARG ES_VERSION="UNDEFINED_ES_VERSION"
ARG ROR_ES_REPO="UNDEFINED_ROR_ES_REPO"
ARG ROR_ES_VERSION="UNDEFINED_ROR_ES_VERSION"

FROM ${ROR_ES_REPO}:${ES_VERSION}-ror-${ROR_ES_VERSION}

USER elasticsearch

COPY conf/es/readonlyrest.yml /usr/share/elasticsearch/config/readonlyrest.yml
COPY conf/es/elasticsearch.yml /usr/share/elasticsearch/config/elasticsearch.yml
COPY conf/es/log4j2.properties /usr/share/elasticsearch/config/log4j2.properties
COPY certs/ca.crt /usr/share/elasticsearch/config/ca.crt
COPY certs/elasticsearch.crt /usr/share/elasticsearch/config/elasticsearch.crt
COPY certs/elasticsearch.csr /usr/share/elasticsearch/config/elasticsearch.csr
COPY certs/elasticsearch.key /usr/share/elasticsearch/config/elasticsearch.key

ENV I_UNDERSTAND_IMPLICATION_OF_ES_PATCHING yes
USER root