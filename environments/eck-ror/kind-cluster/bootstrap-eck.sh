#!/bin/bash -e

cd "$(dirname "$0")"

if [[ -z "$ECK_VERSION" ]]; then
  echo "ECK_VERSION is not defined"
  exit 1
fi

kubectl create -f "https://download.elastic.co/downloads/eck/$ECK_VERSION/crds.yaml"
kubectl apply -f "https://download.elastic.co/downloads/eck/$ECK_VERSION/operator.yaml"

# Install metrics-server for kubectl top support.
# Kind uses self-signed kubelet certs, so --kubelet-insecure-tls is required.
kubectl apply -f https://github.com/kubernetes-sigs/metrics-server/releases/latest/download/components.yaml
kubectl patch deployment metrics-server -n kube-system \
  --type=json \
  -p='[{"op":"add","path":"/spec/template/spec/containers/0/args/-","value":"--kubelet-insecure-tls"}]'
