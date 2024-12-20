ARG ES_VERSION

FROM docker.elastic.co/elasticsearch/elasticsearch:${ES_VERSION}

ARG ES_ROR_FILE

COPY images/plugins/$ES_ROR_FILE /tmp/ror.zip

USER elasticsearch
RUN /usr/share/elasticsearch/bin/elasticsearch-plugin install --batch file:///tmp/ror.zip
USER root
RUN /usr/share/elasticsearch/jdk/bin/java -jar /usr/share/elasticsearch/plugins/readonlyrest/ror-tools.jar patch

USER elasticsearch

COPY conf/es/readonlyrest.yml /usr/share/elasticsearch/config/readonlyrest.yml
COPY conf/es/elasticsearch.yml /usr/share/elasticsearch/config/elasticsearch.yml
COPY conf/es/log4j2.properties /usr/share/elasticsearch/config/log4j2.properties
COPY conf/es/certs/ca.crt /usr/share/elasticsearch/config/ca.crt
COPY conf/es/certs/elasticsearch.crt /usr/share/elasticsearch/config/elasticsearch.crt
COPY conf/es/certs/elasticsearch.csr /usr/share/elasticsearch/config/elasticsearch.csr
COPY conf/es/certs/elasticsearch.key /usr/share/elasticsearch/config/elasticsearch.key
