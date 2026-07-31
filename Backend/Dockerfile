FROM python:3.11-slim

WORKDIR /app

# Install dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    iputils-ping \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Ensure Python stdout and stderr streams are unbuffered so logs appear immediately in docker logs
ENV PYTHONUNBUFFERED=1

# Expose the port the app runs on
EXPOSE 8000

# Start the application with access logging enabled
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--access-log"]
