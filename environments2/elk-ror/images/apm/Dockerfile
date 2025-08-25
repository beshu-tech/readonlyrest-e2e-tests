ARG ES_VERSION

FROM docker.elastic.co/apm/apm-server:${ES_VERSION} AS apm
FROM registry.access.redhat.com/ubi9/ubi:latest

COPY --from=apm /usr/share/apm-server /usr/share/apm-server
COPY ./certs /usr/share/apm-server/config/certs
COPY images/apm/entrypoint.sh /usr/local/bin/

RUN useradd -r -u 1000 apm-server \
 && chown -R apm-server:apm-server /usr/share/apm-server

USER apm-server

WORKDIR /usr/share/apm-server
EXPOSE 8200

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]