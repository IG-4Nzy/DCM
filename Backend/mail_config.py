import os

# SMTP settings
SMTP_HOST = os.getenv("SMTP_HOST", "localhost")
SMTP_PORT = int(os.getenv("SMTP_PORT", "1025"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "your_username_placeholder")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "your_password_placeholder")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "noreply@dcm.local")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "False").lower() in ("true", "1", "yes")
SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "False").lower() in ("true", "1", "yes")
