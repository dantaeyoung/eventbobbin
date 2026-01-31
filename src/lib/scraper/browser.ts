import { chromium, Browser, Page } from 'playwright';
import crypto from 'crypto';

let browser: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
    });
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

export interface PageContent {
  text: string;
  links: { text: string; href: string }[];
  hash: string;
}

export async function renderPage(url: string): Promise<PageContent> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // Navigate to page
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Scroll to trigger lazy loading
    await autoScroll(page);

    // Wait a bit for any final renders
    await page.waitForTimeout(1000);

    // Extract visible text
    const text = await page.evaluate(() => {
      return document.body.innerText || '';
    });

    // Extract all links
    const links = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors
        .map((a) => ({
          text: (a.textContent || '').trim(),
          href: (a as HTMLAnchorElement).href,
        }))
        .filter((link) => link.href && link.text);
    });

    // Generate hash for change detection
    const hash = crypto.createHash('md5').update(text).digest('hex');

    return { text, links, hash };
  } finally {
    await page.close();
  }
}

async function autoScroll(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      let totalHeight = 0;
      const distance = 300;
      const timer = setInterval(() => {
        const scrollHeight = document.body.scrollHeight;
        window.scrollBy(0, distance);
        totalHeight += distance;

        if (totalHeight >= scrollHeight) {
          clearInterval(timer);
          resolve();
        }
      }, 100);

      // Safety timeout
      setTimeout(() => {
        clearInterval(timer);
        resolve();
      }, 5000);
    });
  });
}
