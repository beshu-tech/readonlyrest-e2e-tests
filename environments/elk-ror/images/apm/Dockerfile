ARG ES_VERSION

FROM docker.elastic.co/apm/apm-server:${ES_VERSION} AS apm
FROM registry.access.redhat.com/ubi9/ubi:9.8@sha256:5858f9ace07316e3b12caab62f6c2481a5030bb6bafdca5a9ea324c321ef36df

COPY --from=apm /usr/share/apm-server /usr/share/apm-server
COPY ./certs /usr/share/apm-server/config/certs
COPY images/apm/entrypoint.sh /usr/local/bin/

RUN useradd -r -u 1000 apm-server \
 && chown -R apm-server:apm-server /usr/share/apm-server

USER apm-server

WORKDIR /usr/share/apm-server
EXPOSE 8200

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]