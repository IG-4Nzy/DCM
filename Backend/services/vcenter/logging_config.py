import logging
import logging.handlers
import os
import json
from datetime import datetime, timezone

class JSONFormatter(logging.Formatter):
    """Structured JSON log formatter for production observability."""
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "module": record.module,
            "funcName": record.funcName,
            "lineno": record.lineno,
        }
        if record.exc_info and record.exc_info[0]:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


def setup_logging(log_dir: str = "logs", log_level: str = "INFO"):
    """
    Configure structured logging with rotating file handlers and console output.
    Replaces all ad-hoc file-append logging with Python's standard logging module.
    """
    os.makedirs(log_dir, exist_ok=True)

    root_logger = logging.getLogger()
    root_logger.setLevel(getattr(logging, log_level.upper(), logging.INFO))

    # Remove any pre-existing handlers to avoid duplicate log lines
    root_logger.handlers.clear()

    # 1. Console Handler — human-readable output for development
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_fmt = logging.Formatter(
        "[%(asctime)s] %(levelname)-8s %(name)-30s %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )
    console_handler.setFormatter(console_fmt)
    root_logger.addHandler(console_handler)

    # 2. Rotating File Handler — JSON structured logs for production analysis
    file_handler = logging.handlers.RotatingFileHandler(
        filename=os.path.join(log_dir, "vcenter.log"),
        maxBytes=10 * 1024 * 1024,  # 10MB per file
        backupCount=5,
        encoding="utf-8"
    )
    file_handler.setLevel(logging.DEBUG)
    file_handler.setFormatter(JSONFormatter())
    root_logger.addHandler(file_handler)

    # Third-party loggers tuning
    logging.getLogger("httpx").setLevel(logging.WARNING)
    logging.getLogger("httpcore").setLevel(logging.WARNING)
    logging.getLogger("uvicorn.access").setLevel(logging.INFO)
    logging.getLogger("uvicorn.error").setLevel(logging.INFO)
    logging.getLogger("motor").setLevel(logging.WARNING)

    logging.getLogger("vcenter").info("Structured logging initialized successfully.")
