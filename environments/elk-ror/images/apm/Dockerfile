ARG ES_VERSION

FROM docker.elastic.co/apm/apm-server:${ES_VERSION}

USER root

COPY images/apm/version_check.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/version_check.sh

RUN if [ -f /usr/local/bin/version_check.sh ] && /usr/local/bin/version_check.sh ${ES_VERSION} "10.13.3"; then \
        apt-get update && \
        apt-get install -y --fix-broken && \
        apt-get install -y openssl && \
        apt-get install -y --no-install-recommends ca-certificates && \
        apt-get install -y libcurl4 || true && \
        apt-get install -y \
            libbrotli1 \
            libgssapi-krb5-2 \
            libldap-2.5-0 \
            libnghttp2-14 \
            libpsl5 \
            librtmp1 \
            libssh-4 && \
        apt-get clean && \
        rm -rf /var/lib/apt/lists/*; \
    fi


# Add the entrypoint script
COPY images/apm/entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/entrypoint.sh

USER apm-server
COPY ./certs /usr/share/apm-server/config/certs

EXPOSE 8200

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]