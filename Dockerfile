FROM node:22-bookworm-slim

# Playwright/Chromium system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    libnss3 libnspr4 libdbus-1-3 libatk1.0-0 libatk-bridge2.0-0 \
    libcups2 libdrm2 libxkbcommon0 libxcomposite1 libxdamage1 \
    libxfixes3 libxrandr2 libgbm1 libasound2 libpango-1.0-0 \
    libcairo2 libatspi2.0-0 libx11-6 libxext6 libxcb1 \
    ca-certificates curl wget \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=optional

# Download only Chromium (not all browsers)
RUN npx playwright install chromium

COPY . .
RUN mkdir -p data

EXPOSE 3000
CMD ["node", "server.js"]
