import asyncio
import sys
sys.path.append("/home/vssc/Desktop/DCM/Backend")

from mail_utils import html_to_pdf_bytes, get_day_summary_html

async def main():
    print("Testing get_day_summary_html on a dummy date...")
    try:
        html = await get_day_summary_html("2026-06-24")
        print("Successfully generated summary HTML:")
        print(html[:300] + "\n...")
    except Exception as e:
        print("Error during get_day_summary_html:", e)
        
    print("\nTesting html_to_pdf_bytes...")
    test_html = """
    <html>
    <body>
        <h1>Test Document</h1>
        <p>This is a test of the PDF generation utility in DCM.</p>
    </body>
    </html>
    """
    try:
        pdf_bytes = await html_to_pdf_bytes(test_html)
        print(f"Successfully generated PDF bytes: {len(pdf_bytes)} bytes")
    except Exception as e:
        print("Error during PDF generation:", e)

if __name__ == "__main__":
    asyncio.run(main())
