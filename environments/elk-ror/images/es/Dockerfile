ARG ES_PATCHED_IMAGE

FROM ${ES_PATCHED_IMAGE}

USER elasticsearch

COPY conf/es/readonlyrest.yml /usr/share/elasticsearch/config/readonlyrest.yml
COPY conf/es/elasticsearch.yml /usr/share/elasticsearch/config/elasticsearch.yml
COPY conf/es/log4j2.properties /usr/share/elasticsearch/config/log4j2.properties
COPY certs/ca.crt /usr/share/elasticsearch/config/ca.crt
COPY certs/elasticsearch.crt /usr/share/elasticsearch/config/elasticsearch.crt
COPY certs/elasticsearch.csr /usr/share/elasticsearch/config/elasticsearch.csr
COPY certs/elasticsearch.key /usr/share/elasticsearch/config/elasticsearch.key

# For ROR_ES_VERSION >= 1.64.0
ENV I_UNDERSTAND_AND_ACCEPT_ES_PATCHING yes
# For ROR_ES_VERSION < 1.64.0
ENV I_UNDERSTAND_IMPLICATION_OF_ES_PATCHING yes
USER root
