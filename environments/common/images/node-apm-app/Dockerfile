FROM node:20

RUN apt-get update && apt-get install -y --fix-missing\
    vim \
    curl \
    libc6-amd64-cross && \
    ln -s /usr/x86_64-linux-gnu/lib64/ /lib64
RUN mkdir -p /example-app

WORKDIR /example-app

COPY ./package.json /example-app/
RUN npm install

COPY ./app.js /example-app

EXPOSE 3000

ENTRYPOINT ["node", "app.js"]
