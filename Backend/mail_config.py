import os

# SMTP settings (Gmail SMTP default fallback for development)
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USERNAME = os.getenv("SMTP_USERNAME", "ddc4833@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "your_gmail_app_password")
SMTP_FROM_EMAIL = os.getenv("SMTP_FROM_EMAIL", "vssc.dcm.dev@gmail.com")
SMTP_USE_TLS = os.getenv("SMTP_USE_TLS", "True").lower() in ("true", "1", "yes")
SMTP_USE_SSL = os.getenv("SMTP_USE_SSL", "False").lower() in ("true", "1", "yes")

