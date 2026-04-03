# Utilisation d'une version ultra-légère
FROM node:18-slim

# Installation des dépendances système minimales pour Chrome
RUN apt-get update && apt-get install -y \
    wget \
    gnupg \
    ca-certificates \
    procps \
    libxss1 \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Installation de Chrome
RUN apt-get update && apt-get install -y \
    google-chrome-stable \
    --no-install-recommends \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Installation des dépendances Node
COPY package*.json ./
RUN npm install --only=production

COPY . .

# On force le chemin pour Puppeteer
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable

CMD ["node", "index.js"]
