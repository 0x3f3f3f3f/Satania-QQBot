FROM mcr.microsoft.com/dotnet/core/runtime:3.1
RUN curl -sL https://deb.nodesource.com/setup_13.x | bash -
RUN apt-get install -y nodejs

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm i

EXPOSE 33200

CMD ["node", "web_api.js"]

COPY . .
