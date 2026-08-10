#!/bin/sh
# Replace the placeholder in compiled JS files with the actual runtime environment variable
find /usr/share/nginx/html -type f -name "*.js" -exec sed -i "s|RUNTIME_API_BASE_URL_PLACEHOLDER|${VITE_API_BASE_URL}|g" {} +
DEPLOY_VAL="${deploy:-${DEPLOY:-${DEPLOY_ENV:-prod}}}"
find /usr/share/nginx/html -type f -name "*.js" -exec sed -i "s|RUNTIME_DEPLOY_ENV_PLACEHOLDER|${DEPLOY_VAL}|g" {} +

# Execute the CMD
exec "$@"
