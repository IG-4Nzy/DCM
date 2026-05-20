# Build Stage
FROM node:22-alpine AS build

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy the rest of the application code
COPY . .

# Embed a specific placeholder string at build time
ENV VITE_API_BASE_URL=RUNTIME_API_BASE_URL_PLACEHOLDER
RUN npx vite build

# Production Stage
FROM nginx:alpine

# Copy the build output to Nginx's web root
COPY --from=build /app/dist /usr/share/nginx/html

# Replace default Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy entrypoint script
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# Default environment variable value
ENV VITE_API_BASE_URL=http://127.0.0.1:8000

# Expose port 80
EXPOSE 80

# Execute entrypoint first to inject environment variables, then run nginx
ENTRYPOINT ["/entrypoint.sh"]
CMD ["nginx", "-g", "daemon off;"]
