FROM node:18-alpine

WORKDIR /app

# Install dependencies first (for better caching)
COPY package.json ./
RUN npm install --production

# Copy application files
COPY server.js ./
COPY index.html ./

# Set environment variables
ENV PORT=3000
ENV NODE_ENV=production

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# Start the server
CMD ["node", "server.js"]
