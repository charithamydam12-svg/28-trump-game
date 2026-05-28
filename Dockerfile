FROM node:20-slim

WORKDIR /app

# Copy server package files and install cleanly
COPY server/package*.json ./server/
RUN cd server && npm install --omit=dev

# Copy the rest of the server code
COPY server/ ./server/

WORKDIR /app/server

EXPOSE 3001

CMD ["node", "index.js"]
