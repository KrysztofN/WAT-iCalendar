FROM node:23

WORKDIR /home/iCalendar

COPY entrypoint.sh ./
RUN chmod u+x ./entrypoint.sh 

RUN apt-get update && apt-get install -y --no-install-recommends \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdrm2 \
  libgbm1 \
  libgtk-3-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxrandr2 \
  xdg-utils \
  libu2f-udev \
  libxshmfence1 \
  libglu1-mesa \
  chromium \
  && apt-get install -y --no-install-recommends dialog \
  && apt-get install -y --no-install-recommends openssh-server \
  && echo "root:Docker!" | chpasswd \
  && apt-get clean \
  && rm -rf /var/lib/apt/lists/* 

COPY ./sshd_config /etc/ssh/
COPY ./package*.json ./
COPY . .

RUN npm install 

EXPOSE 2222 8080 80

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH="/usr/bin/chromium"

ENTRYPOINT [ "./entrypoint.sh" ]
