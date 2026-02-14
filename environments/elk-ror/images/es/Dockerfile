ARG ES_VERSION="UNDEFINED_ES_VERSION"
ARG ROR_ES_REPO="UNDEFINED_ROR_ES_REPO"
ARG ROR_ES_VERSION="UNDEFINED_ROR_ES_VERSION"

FROM ${ROR_ES_REPO}:${ES_VERSION}-ror-${ROR_ES_VERSION}

# ES 8.0.x and 8.1.x bundle JDK 17.0.2 which has cgroup v2 bug JDK-8287073:
# CgroupV2Subsystem.getInstance() NPEs before UseContainerSupport flag is checked.
# Fixed in JDK 17.0.5+ (backport JDK-8288308). ES 8.2.0+ ships JDK 18+ which doesn't have the bug.
# We replace the bundled JDK with Amazon Corretto 17.0.5 that contains the fix.
ARG ES_VERSION
USER root
RUN if echo "$ES_VERSION" | grep -qE '^8\.[01]\.'; then \
      ARCH=$(uname -m | sed 's/x86_64/x64/' | sed 's/arm64/aarch64/') && \
      echo "Replacing buggy bundled JDK 17.0.2 with Corretto 17.0.5 for ES $ES_VERSION (arch: $ARCH)" && \
      curl -fsSL "https://corretto.aws/downloads/resources/17.0.5.8.1/amazon-corretto-17.0.5.8.1-linux-${ARCH}.tar.gz" -o /tmp/jdk.tar.gz && \
      rm -rf /usr/share/elasticsearch/jdk && \
      mkdir -p /usr/share/elasticsearch/jdk && \
      tar xzf /tmp/jdk.tar.gz -C /usr/share/elasticsearch/jdk --strip-components=1 && \
      rm /tmp/jdk.tar.gz; \
    fi

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