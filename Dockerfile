FROM mcr.microsoft.com/playwright:v1.47.0-jammy

# The Playwright image ships with Node 20, but node:sqlite requires Node 22+
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --omit=optional

COPY . .

RUN mkdir -p data

EXPOSE 3000
CMD ["node", "server.js"]
