FROM node:14.16

ENV PORT 1437
EXPOSE 1437

##################
##install ffmpeg
##################
RUN apt update -y
RUN apt install -y ffmpeg

##################
##install service
##################
COPY ./package.json ./package.json
COPY ./package-lock.json ./package-lock.json
RUN npm install

COPY ./public/wbs/package.json /public/wbs/package.json
COPY ./public/wbs/package-lock.json /public/wbs/package-lock.json
RUN cd /public/wbs/ && npm install

RUN npm i -g browserify

##################
##copy service
##################
COPY ./public /public
COPY ./server.js ./server.js

##################
##copy service server
##################
COPY ./server.js ./server.js

##################
##copy service front
##################
COPY ./public/wbs/index.html /public/wbs/index.html
COPY ./public/wbs/src /public/wbs/src
COPY ./public/wbs/less /public/wbs/less
COPY ./public/wbs/test /public/wbs/test
RUN cd /public/wbs/ && npm run build

CMD ["node", "server.js"]
