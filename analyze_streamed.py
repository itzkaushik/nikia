import asyncio
import json
from playwright.async_api import async_playwright

async def main():
    print("Starting Playwright to analyze streamed.pk...")
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(
            user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        )
        page = await context.new_page()

        apis = []
        
        # Intercept network requests to catch APIs
        page.on("response", lambda response: asyncio.create_task(handle_response(response, apis)))
        
        print("Navigating to https://streamed.pk/")
        await page.goto("https://streamed.pk/", wait_until="networkidle")
        
        # Give it a bit to load dynamic content
        await asyncio.sleep(5)
        
        html = await page.content()
        with open("streamed_home.html", "w", encoding="utf-8") as f:
            f.write(html)
            
        with open("streamed_apis.json", "w", encoding="utf-8") as f:
            json.dump(apis, f, indent=2)
            
        print("Done. Saved HTML and intercepted API requests.")
        await browser.close()

async def handle_response(response, apis):
    # Only care about XHR / fetch
    if response.request.resource_type in ["fetch", "xhr"]:
        try:
            url = response.url
            if "google" not in url and "cloudflare" not in url:
                print(f"Caught API: {url}")
                body = await response.text()
                apis.append({
                    "url": url,
                    "status": response.status,
                    "method": response.request.method,
                    "body_snippet": body[:500] if body else ""
                })
        except Exception as e:
            pass

asyncio.run(main())
