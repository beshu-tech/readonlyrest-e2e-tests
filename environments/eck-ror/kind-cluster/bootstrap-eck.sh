#!/bin/bash -e
# bootstrap-eck.sh <manifest directory>
# Runs in the control-plane node. Installs the ECK operator and metrics-server from manifests that
# the host downloaded: the node has no retry for a download.

cd "${1:?Usage: bootstrap-eck.sh <manifest directory>}"

kubectl create -f crds.yaml
kubectl apply -f operator.yaml

# metrics-server gives `kubectl top`. Kind uses self-signed kubelet certs, so it needs
# --kubelet-insecure-tls.
kubectl apply -f metrics-server.yaml
kubectl patch deployment metrics-server -n kube-system \
  --type=json \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
