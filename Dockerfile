FROM ghcr.io/puppeteer/puppeteer:21.5.0

USER root
WORKDIR /app

# On définit la variable AVANT l'installation
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

COPY package*.json ./

# Le flag --no-package-lock accélère parfois le processus sur Railway
RUN npm install --only=production --no-package-lock

COPY . .

# On repasse sur l'utilisateur par défaut de l'image pour la sécurité
USER pptruser

CMD ["node", "index.js"]
