# Image officielle contenant Node.js et Chrome
FROM ghcr.io/puppeteer/puppeteer:21.5.0

# Dossier de travail
WORKDIR /app

# Copie des fichiers de dépendances
COPY package*.json ./

# Installation propre (Railway ne perdra pas de temps ici)
RUN npm install --only=production

# Copie du reste du code
COPY . .

# Variables système indispensables
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Lancement du bot
CMD ["node", "index.js"]
