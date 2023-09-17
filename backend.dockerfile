FROM node:lts-alpine3.16

RUN apk update && apk upgrade && apk add git

WORKDIR /handshake-backend

# Copy package.json and package-lock.json (if available) to the working directory
COPY package*.json ./

RUN npm install

# Copy the rest of the application code to the working directory
COPY . .

RUN npm run build

CMD [ "npm", "run", "start" ]

EXPOSE 5001
