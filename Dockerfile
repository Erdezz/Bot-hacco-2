FROM ghcr.io/puppeteer/puppeteer:21.5.0

# Passer en root pour installer si besoin, mais l'image a déjà Chrome
USER root

# Définir le dossier de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances
RUN npm install

# Copier le reste du code
COPY . .

# Variable d'environnement pour Puppeteer dans Docker
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

# Lancer le bot
CMD ["node", "index.js"]
