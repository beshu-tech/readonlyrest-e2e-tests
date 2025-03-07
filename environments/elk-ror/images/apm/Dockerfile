ARG ES_VERSION

FROM docker.elastic.co/apm/apm-server:${ES_VERSION}

USER root
RUN apt-get update && \
    apt-get install -y --fix-broken && \
    apt-get install -y openssl && \
    apt-get install -y libnsl2 libtirpc3 && \
    apt-get install -y --no-install-recommends ca-certificates && \
    apt-get install -y \
    libbrotli1 \
    libgssapi-krb5-2 \
    libldap-2.5-0 \
    libnghttp2-14 \
    libpsl5 \
    librtmp1 \
    libssh-4 \
    curl \
    libcurl4 && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

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