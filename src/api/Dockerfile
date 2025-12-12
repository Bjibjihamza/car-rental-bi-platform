FROM node:20-bullseye

WORKDIR /app

COPY package*.json ./

# npm ci needs package-lock.json; npm install works without it
RUN npm install --omit=dev

COPY . .

ENV PORT=8000
EXPOSE 8000

CMD ["npm", "start"]
