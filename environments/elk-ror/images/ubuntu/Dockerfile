FROM ubuntu:24.10

RUN apt-get update && \
    apt-get install -y libc6-amd64-cross vim curl npm && \
    ln -s /usr/x86_64-linux-gnu/lib64/ /lib64 && \
    mkdir -p /example-app

COPY images/ubuntu/app.js /example-app

RUN cd /example-app && \
    npm install elastic-apm-node && \
    npm install express
    
ENV LD_LIBRARY_PATH="$LD_LIBRARY_PATH:/lib64:/usr/x86_64-linux-gnu/lib"