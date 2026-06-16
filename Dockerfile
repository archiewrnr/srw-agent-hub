# Uses the official Playwright image which has Chromium + all system deps pre-installed
FROM mcr.microsoft.com/playwright:v1.47.0-jammy

WORKDIR /app

# Install Node dependencies (skip browser download — base image already has Chromium)
COPY package*.json ./
RUN PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm install --omit=optional

# Copy application source
COPY . .

# Ensure the data directory exists (Railway persistent volume mounts here)
RUN mkdir -p data

EXPOSE 3000
CMD ["node", "server.js"]
