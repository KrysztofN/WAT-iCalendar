FROM node:23-alpine

WORKDIR /iCalendar

COPY package*.json ./

RUN npm install

RUN npx puppeteer browsers install chrome

COPY . .

EXPOSE 3000

CMD ["npm", "start"]