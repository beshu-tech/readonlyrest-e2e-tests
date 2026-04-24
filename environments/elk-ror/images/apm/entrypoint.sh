#!/bin/bash

exec /usr/share/apm-server/apm-server \
  -e \
  -E "apm-server.rum.enabled=${APM_RUM_ENABLED:-true}" \
  -E "apm-server.kibana.enabled=${APM_KIBANA_ENABLED:-false}" \
  -E "apm-server.ssl.enabled=${APM_SSL_ENABLED:-true}" \
  -E "apm-server.ssl.certificate=${APM_SSL_CERTIFICATE:-/usr/share/apm-server/config/certs/apm-server.crt}" \
  -E "apm-server.ssl.key=${APM_SSL_KEY:-/usr/share/apm-server/config/certs/apm-server.key}" \
  -E "apm-server.ssl.certificate_authorities=${APM_SSL_CA:-/usr/share/apm-server/config/certs/ca.crt}" \
  -E "apm-server.ssl.client_authentication=${APM_SSL_CLIENT_AUTH:-none}" \
  -E "output.elasticsearch.hosts=[${ES_HOSTS:-'https://es-ror:9200'}]" \
  -E "output.elasticsearch.username=${ES_USERNAME:-apm}" \
  -E "output.elasticsearch.password=${ES_PASSWORD:-test}" \
  -E "output.elasticsearch.ssl.enabled=${ES_SSL_ENABLED:-true}" \
  -E "output.elasticsearch.ssl.verification_mode=${ES_SSL_VERIFY:-full}" \
  -E "output.elasticsearch.ssl.certificate_authorities=${ES_SSL_CA:-/usr/share/apm-server/config/certs/ca.crt}" \
  -E "logging.level=${LOG_LEVEL:-debug}"