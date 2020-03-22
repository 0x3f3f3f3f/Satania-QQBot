FROM mcr.microsoft.com/dotnet/core/runtime:3.1
RUN curl -sL https://deb.nodesource.com/setup_13.x | bash -
RUN apt-get install -y nodejs

WORKDIR /usr/src/app

COPY package*.json ./

RUN npm i

EXPOSE 33200

RUN mkdir user-content
RUN groupadd restricted && useradd -g restricted restricted
RUN chown restricted:restricted user-content
USER restricted

CMD ["node", "web_api.js"]

COPY . .
