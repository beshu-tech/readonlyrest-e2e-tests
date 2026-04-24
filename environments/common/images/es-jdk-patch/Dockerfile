ARG BASE_IMAGE
FROM ${BASE_IMAGE}

ARG ES_VERSION
USER root
COPY patch-es-jdk.sh /tmp/patch-es-jdk.sh
RUN chmod +x /tmp/patch-es-jdk.sh && ES_VERSION=${ES_VERSION} /tmp/patch-es-jdk.sh && rm -f /tmp/patch-es-jdk.sh
USER elasticsearch
