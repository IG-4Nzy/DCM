import asyncio
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from typing import List, Optional

async def send_email(
    to_emails: List[str],
    subject: str,
    body: str,
    html_body: Optional[str] = None,
    attachments: Optional[List[dict]] = None
):
    """
    Asynchronously sends an email by loading configuration from MongoDB (with env fallbacks)
    and running the SMTP connection in a separate thread pool.
    """
    from database import db
    import mail_config

    # Retrieve configuration from MongoDB
    settings_col = db.get_collection("mail_config")
    doc = await settings_col.find_one({"_id": "mail_config"})

    # Check if configured from App UI (i.e. not empty/default/localhost and no placeholder username/password)
    is_configured = False
    if doc:
        h_val = str(doc.get("host", "")).strip().lower()
        if "gmail.com" in h_val:
            h_val = "smtp.gmail.com"
        u_val = str(doc.get("username", "")).strip()
        p_val = str(doc.get("password", "")).strip()
        
        is_host_valid = h_val and h_val not in ("localhost", "127.0.0.1")
        is_user_valid = u_val and "placeholder" not in u_val.lower() and "vssc.dcm.dev@gmail.com" not in u_val.lower()
        is_pass_valid = p_val and "placeholder" not in p_val.lower() and "your_gmail_app_password" not in p_val.lower()
        
        if is_host_valid and is_user_valid and is_pass_valid:
            is_configured = True

    if is_configured and doc:
        host = str(doc.get("host")).strip()
        if "gmail.com" in host.lower():
            host = "smtp.gmail.com"
        port = int(doc.get("port", 587))
        username = str(doc.get("username")).strip()
        password = doc.get("password")
        from_email = doc.get("fromEmail") or username
        
        use_tls = doc.get("useTls")
        if use_tls is None or use_tls == "":
            use_tls = mail_config.SMTP_USE_TLS
        else:
            use_tls = str(use_tls).lower() in ("true", "1", "yes")
            
        use_ssl = doc.get("useSsl")
        if use_ssl is None or use_ssl == "":
            use_ssl = mail_config.SMTP_USE_SSL
        else:
            use_ssl = str(use_ssl).lower() in ("true", "1", "yes")
    else:
        # Fall back to Gmail development configuration
        host = mail_config.SMTP_HOST
        port = mail_config.SMTP_PORT
        username = mail_config.SMTP_USERNAME
        password = mail_config.SMTP_PASSWORD
        from_email = mail_config.SMTP_FROM_EMAIL
        use_tls = mail_config.SMTP_USE_TLS
        use_ssl = mail_config.SMTP_USE_SSL

    # Normalize settings and credentials for Gmail host to prevent handshake and login failures
    if host.lower() == "smtp.gmail.com":
        if port == 465:
            use_tls = False
            use_ssl = True
        else:
            port = 587
            use_tls = True
            use_ssl = False
            
        if username:
            username = str(username).strip()
        if password:
            password = str(password).replace(" ", "").strip()

    def send_smtp_sync():
        if attachments:
            msg = MIMEMultipart("mixed")
            msg["Subject"] = subject
            msg["From"] = from_email
            msg["To"] = ", ".join(to_emails)
            
            # Create the alternative part for text and html body
            body_part = MIMEMultipart("alternative")
            if html_body:
                part1 = MIMEText(body, "plain", "utf-8")
                part2 = MIMEText(html_body, "html", "utf-8")
                body_part.attach(part1)
                body_part.attach(part2)
            else:
                part = MIMEText(body, "plain", "utf-8")
                body_part.attach(part)
            msg.attach(body_part)
            
            # Attach files
            for att in attachments:
                content_type = att.get("content_type", "")
                if "/" in content_type:
                    maintype, subtype = content_type.split("/", 1)
                elif att.get("filename", "").endswith(".pdf"):
                    maintype, subtype = "application", "pdf"
                else:
                    maintype, subtype = "application", "octet-stream"

                part = MIMEBase(maintype, subtype)
                part.set_payload(att["content"])
                encoders.encode_base64(part)
                filename = att.get("filename", "attachment.pdf")
                part.add_header(
                    "Content-Disposition",
                    f'attachment; filename="{filename}"',
                )
                msg.attach(part)
        else:
            msg = MIMEMultipart("alternative") if html_body else MIMEMultipart()
            msg["Subject"] = subject
            msg["From"] = from_email
            msg["To"] = ", ".join(to_emails)

            if html_body:
                part1 = MIMEText(body, "plain", "utf-8")
                part2 = MIMEText(html_body, "html", "utf-8")
                msg.attach(part1)
                msg.attach(part2)
            else:
                part = MIMEText(body, "plain", "utf-8")
                msg.attach(part)

        # Establish SMTP connection
        if use_ssl:
            server = smtplib.SMTP_SSL(host, port, timeout=10)
        else:
            server = smtplib.SMTP(host, port, timeout=10)

        try:
            if use_tls and not use_ssl:
                server.ehlo()
                server.starttls()
                server.ehlo()

            # Login only if credentials are changed from placeholders
            if username and "placeholder" not in username:
                server.login(username, password)

            server.sendmail(from_email, to_emails, msg.as_string())
        finally:
            server.quit()

    await asyncio.to_thread(send_smtp_sync)


def get_chrome_executable() -> str:
    import shutil
    import os
    candidates = [
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        "chromium-browser",
        "/usr/bin/google-chrome",
        "/usr/bin/google-chrome-stable",
        "/usr/bin/chromium",
        "/usr/bin/chromium-browser",
        "/snap/bin/chromium"
    ]
    for cand in candidates:
        found = shutil.which(cand)
        if found:
            return found
        if os.path.exists(cand) and os.access(cand, os.X_OK):
            return cand
    return "google-chrome"


async def html_to_pdf_bytes(html_content: str) -> bytes:
    import subprocess
    import tempfile
    import os
    
    # We want to ensure background colors are printed correctly
    styled_html = html_content
    if "<head>" in html_content:
        style_inject = """
        <style>
        @media print {
            body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }
        </style>
        """
        styled_html = html_content.replace("<head>", f"<head>{style_inject}")
    elif "<html>" in html_content:
        style_inject = """
        <style>
        @media print {
            body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }
        </style>
        </head>
        """
        styled_html = html_content.replace("<html>", f"<html>{style_inject}")
        
    def run_chrome():
        try:
            chrome_bin = get_chrome_executable()
            if not chrome_bin:
                print("Warning: No headless Chrome/Chromium executable found.")
                return None
            with tempfile.NamedTemporaryFile(suffix=".html", delete=False) as html_file:
                html_file.write(styled_html.encode("utf-8"))
                html_path = html_file.name
            
            pdf_path = html_path.replace(".html", ".pdf")
            
            try:
                cmd = [
                    chrome_bin,
                    "--headless=new",
                    "--disable-gpu",
                    "--no-sandbox",
                    "--no-pdf-header-footer",
                    f"--print-to-pdf={pdf_path}",
                    html_path
                ]
                subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True, timeout=15)
                
                with open(pdf_path, "rb") as f:
                    pdf_bytes = f.read()
                return pdf_bytes
            finally:
                if os.path.exists(html_path):
                    os.remove(html_path)
                if os.path.exists(pdf_path):
                    os.remove(pdf_path)
        except Exception as e:
            print(f"Warning: html_to_pdf_bytes failed: {e}")
            return None

    return await asyncio.to_thread(run_chrome)


async def get_day_summary_html(date_str: str) -> str:
    from database import db
    from bson import ObjectId
    
    # Query observations
    obs_col = db.get_collection("observations")
    obs_cursor = obs_col.find({
        "$or": [
            {"observedDate": date_str},
            {"lastStatusUpdatedOn": {"$regex": f"^{date_str}"}}
        ]
    })
    observations = await obs_cursor.to_list(length=None)
    
    # Query visitor logs
    visitor_col = db.get_collection("visitor_logs")
    visitor_cursor = visitor_col.find({"entryTime": {"$regex": f"^{date_str}"}})
    visitors = await visitor_cursor.to_list(length=None)
    
    # Resolve divisions
    if visitors:
        dept_ids = []
        for v in visitors:
            div_val = v.get("division")
            if div_val:
                if isinstance(div_val, ObjectId):
                    dept_ids.append(div_val)
                elif isinstance(div_val, str) and ObjectId.is_valid(div_val):
                    dept_ids.append(ObjectId(div_val))
                    
        dept_map = {}
        if dept_ids:
            depts = await db.get_collection("departments").find({"_id": {"$in": dept_ids}}).to_list(length=None)
            dept_map = {str(d["_id"]): d.get("name", "") for d in depts}
            
        for v in visitors:
            div = v.get("division")
            if div:
                div_str = str(div)
                if div_str in dept_map:
                    v["division"] = dept_map[div_str]
                else:
                    v["division"] = div_str
            else:
                v["division"] = "-"
                
    html = ""
    
    if observations:
        html += """
        <h3 style="color: #0f172a; margin-top: 30px; border-bottom: 2px solid #64748b; padding-bottom: 6px;">Observations</h3>
        <table style="border-collapse: collapse; width: 100%; font-size: 13px; border: 1px solid #cbd5e1; margin-bottom: 20px;">
            <thead>
                <tr style="background-color: #f1f5f9;">
                    <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 15%;">ID</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 45%;">Description</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 15%;">Category</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; width: 10%;">Status</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 15%;">Logged By</th>
                </tr>
            </thead>
            <tbody>
        """
        for o in observations:
            html += f"""
                <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">{o.get('observationId', '-')}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">{o.get('description', '-')}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">{o.get('category', '-')}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center; font-weight: bold;">{o.get('status', '-')}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">{o.get('loggedBy', '-')}</td>
                </tr>
            """
        html += "</tbody></table>"
        
    if visitors:
        html += """
        <h3 style="color: #0f172a; margin-top: 30px; border-bottom: 2px solid #64748b; padding-bottom: 6px;">Visitor Logs</h3>
        <table style="border-collapse: collapse; width: 100%; font-size: 13px; border: 1px solid #cbd5e1; margin-bottom: 20px;">
            <thead>
                <tr style="background-color: #f1f5f9;">
                    <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 25%;">Visitor Name</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 20%;">Division</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: left; width: 25%;">Purpose</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; width: 15%;">Entry Time</th>
                    <th style="border: 1px solid #cbd5e1; padding: 8px; text-align: center; width: 15%;">Exit Time</th>
                </tr>
            </thead>
            <tbody>
        """
        for v in visitors:
            entry = str(v.get("entryTime")) if v.get("entryTime") else ""
            if "T" in entry:
                entry = entry.split("T")[1][:5]
            exit_t = str(v.get("exitTime")) if v.get("exitTime") else ""
            if "T" in exit_t:
                exit_t = exit_t.split("T")[1][:5]
            if not exit_t:
                exit_t = "-"
            html += f"""
                <tr>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">{v.get('visitorName', '-')}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">{v.get('division', '-')}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: left;">{v.get('purpose', '-')}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">{entry}</td>
                    <td style="border: 1px solid #cbd5e1; padding: 6px; text-align: center;">{exit_t}</td>
                </tr>
            """
        html += "</tbody></table>"
        
    return html

