import subprocess
import tempfile
import os
import asyncio

async def test_pdf():
    html_content = "<html><body><h1>Hello Test PDF</h1></body></html>"
    with tempfile.NamedTemporaryFile(suffix=".html", delete=False) as html_file:
        html_file.write(html_content.encode("utf-8"))
        html_path = html_file.name
        
    pdf_path = html_path.replace(".html", ".pdf")
    
    try:
        cmd = [
            "google-chrome",
            "--headless=new",
            "--disable-gpu",
            "--no-sandbox",
            "--no-pdf-header-footer",
            f"--print-to-pdf={pdf_path}",
            html_path
        ]
        print("Running command:", " ".join(cmd))
        res = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        print("Return code:", res.returncode)
        print("Stdout:", res.stdout)
        print("Stderr:", res.stderr)
        
        if os.path.exists(pdf_path):
            print("PDF successfully generated! Size:", os.path.getsize(pdf_path))
        else:
            print("PDF was NOT generated.")
    except Exception as e:
        print("Exception:", e)
    finally:
        if os.path.exists(html_path):
            os.remove(html_path)
        if os.path.exists(pdf_path):
            os.remove(pdf_path)

if __name__ == "__main__":
    asyncio.run(test_pdf())
