ARG ES_VERSION

FROM docker.elastic.co/apm/apm-server:${ES_VERSION}

USER root

COPY images/apm/version_check.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/version_check.sh

RUN if [ -f /usr/local/bin/version_check.sh ] && /usr/local/bin/version_check.sh ${ES_VERSION} "8.17.3"; then \
    if command -v apt-get > /dev/null; then \
        apt-get update && \
        apt-get install -y --fix-broken && \
        apt-get install -y openssl ca-certificates curl; \
    elif command -v apk > /dev/null; then \
        apk add --no-cache openssl ca-certificates curl; \
    elif command -v yum > /dev/null; then \
        yum install -y openssl ca-certificates curl; \
    elif command -v dnf > /dev/null; then \
        dnf install -y openssl ca-certificates curl; \
    elif command -v zypper > /dev/null; then \
        zypper install -y openssl ca-certificates curl; \
    else \
        echo "Checking for curl installation..."; \
        if ! command -v curl > /dev/null; then \
            echo "No supported package manager found and curl not installed"; \
            echo "Using built-in tools only"; \
        else \
            echo "curl is already installed"; \
        fi; \
    fi \
else \
    echo "Using minimal dependencies"; \
fi

USER apm-server
COPY ./certs /usr/share/apm-server/config/certs

EXPOSE 8200

CMD ["apm-server", "-e", \
     "-E", "apm-server.rum.enabled=true", \
     "-E", "apm-server.kibana.enabled=false", \
     "-E", "apm-server.ssl.enabled=true", \
     "-E", "apm-server.ssl.certificate=/usr/share/apm-server/config/certs/apm-server.crt", \
     "-E", "apm-server.ssl.key=/usr/share/apm-server/config/certs/apm-server.key", \
     "-E", "apm-server.ssl.certificate_authorities=/usr/share/apm-server/config/certs/ca.crt", \
     "-E", "apm-server.ssl.client_authentication=none", \
     "-E", "output.elasticsearch.hosts=['https://es-ror:9200']", \
     "-E", "output.elasticsearch.username=apm", \
     "-E", "output.elasticsearch.password=test", \
     "-E", "output.elasticsearch.ssl.enabled=true", \
     "-E", "output.elasticsearch.ssl.verification_mode=full", \
     "-E", "output.elasticsearch.ssl.certificate_authorities=/usr/share/apm-server/config/certs/ca.crt", \
     "-E", "logging.level=debug"]