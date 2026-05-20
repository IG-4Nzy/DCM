#!/bin/sh
# Replace the placeholder in compiled JS files with the actual runtime environment variable
find /usr/share/nginx/html -type f -name "*.js" -exec sed -i "s|RUNTIME_API_BASE_URL_PLACEHOLDER|${VITE_API_BASE_URL}|g" {} +

# Execute the CMD
exec "$@"
