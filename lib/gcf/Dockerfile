FROM node:8
#USER node
#WORKDIR /home/node
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install

COPY . .
EXPOSE 8080
CMD [ "npm", "start" ]
