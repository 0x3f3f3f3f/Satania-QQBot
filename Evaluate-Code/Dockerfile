FROM mcr.microsoft.com/dotnet/core/runtime:3.1
FROM node:current-slim

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm i

EXPOSE 33200

CMD ["node", "web_api.js"]

COPY . .
