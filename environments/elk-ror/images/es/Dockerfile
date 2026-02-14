ARG ES_VERSION="UNDEFINED_ES_VERSION"
ARG ROR_ES_REPO="UNDEFINED_ROR_ES_REPO"
ARG ROR_ES_VERSION="UNDEFINED_ROR_ES_VERSION"

FROM ${ROR_ES_REPO}:${ES_VERSION}-ror-${ROR_ES_VERSION}

# ES 7.16.x–7.17.6 and 8.0.x–8.4.x bundle JDK 17.0.1/17.0.2 or JDK 18, which have cgroup v2
# bug JDK-8287073: CgroupV2Subsystem.getInstance() NPEs before UseContainerSupport is checked.
# Fixed in JDK 17.0.5+ (backport JDK-8288308) and JDK 19+.
# We replace the bundled JDK: Corretto 17.0.5 for JDK-17 builds, Corretto 19.0.0 for JDK-18 builds.
ARG ES_VERSION
USER root
RUN MAJOR=$(echo "$ES_VERSION" | cut -d. -f1) && \
    MINOR=$(echo "$ES_VERSION" | cut -d. -f2) && \
    PATCH=$(echo "$ES_VERSION" | cut -d. -f3) && \
    CORRETTO_VERSION="" && \
    if [ "$MAJOR" -eq 7 ] && [ "$MINOR" -eq 16 ]; then \
      CORRETTO_VERSION="17.0.5.8.1"; \
    elif [ "$MAJOR" -eq 7 ] && [ "$MINOR" -eq 17 ] && [ "$PATCH" -le 2 ]; then \
      CORRETTO_VERSION="17.0.5.8.1"; \
    elif [ "$MAJOR" -eq 7 ] && [ "$MINOR" -eq 17 ] && [ "$PATCH" -le 6 ]; then \
      CORRETTO_VERSION="19.0.0.36.1"; \
    elif [ "$MAJOR" -eq 8 ] && [ "$MINOR" -le 1 ]; then \
      CORRETTO_VERSION="17.0.5.8.1"; \
    elif [ "$MAJOR" -eq 8 ] && [ "$MINOR" -le 4 ]; then \
      CORRETTO_VERSION="19.0.0.36.1"; \
    fi && \
    if [ -n "$CORRETTO_VERSION" ]; then \
      ARCH=$(uname -m | sed 's/x86_64/x64/' | sed 's/arm64/aarch64/') && \
      echo "Replacing buggy bundled JDK with Corretto $CORRETTO_VERSION for ES $ES_VERSION (arch: $ARCH)" && \
      curl -fsSLk "https://corretto.aws/downloads/resources/${CORRETTO_VERSION}/amazon-corretto-${CORRETTO_VERSION}-linux-${ARCH}.tar.gz" -o /tmp/jdk.tar.gz && \
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