# README

## Requirements:
* docker installed
* kind tool installed (https://github.com/kubernetes-sigs/kind)

## RUNNING
1. Running the ECK+ROR PoC: `$ ./start.sh --es <ES_VESION> --kbn <KBN_VERSION>` 
   (you can pick ECK version by adding optional --eck <ECK_VERSION> param)

2. Log into Kibana `https://localhost:5601` using given credentials: `admin:dev`

3. Clean after playing with the PoC: `$ ./stop-and-clean.sh`
