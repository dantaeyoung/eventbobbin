import { chromium, Browser, BrowserContext, Page } from 'playwright';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

let browser: Browser | null = null;
let instagramContext: BrowserContext | null = null;

const INSTAGRAM_COOKIES_PATH = path.join(process.cwd(), '.instagram-cookies.json');

export async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
    });
  }
  return browser;
}

export async function closeBrowser(): Promise<void> {
  if (instagramContext) {
    await instagramContext.close();
    instagramContext = null;
  }
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * Get or create an Instagram browser context with saved cookies
 */
async function getInstagramContext(): Promise<BrowserContext> {
  if (instagramContext) {
    return instagramContext;
  }

  const browser = await getBrowser();

  // Create context with saved cookies if they exist
  if (fs.existsSync(INSTAGRAM_COOKIES_PATH)) {
    try {
      const cookiesData = fs.readFileSync(INSTAGRAM_COOKIES_PATH, 'utf-8');
      const cookies = JSON.parse(cookiesData);
      instagramContext = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      });
      await instagramContext.addCookies(cookies);
      console.log('  Loaded saved Instagram cookies');
    } catch (error) {
      console.log('  Failed to load cookies, will login fresh');
      instagramContext = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      });
    }
  } else {
    instagramContext = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
    });
  }

  return instagramContext;
}

/**
 * Save Instagram cookies for future sessions
 */
async function saveInstagramCookies(): Promise<void> {
  if (instagramContext) {
    const cookies = await instagramContext.cookies();
    fs.writeFileSync(INSTAGRAM_COOKIES_PATH, JSON.stringify(cookies, null, 2));
    console.log('  Saved Instagram cookies');
  }
}

/**
 * Login to Instagram
 */
async function loginToInstagram(page: Page): Promise<boolean> {
  const username = process.env.INSTAGRAM_USERNAME;
  const password = process.env.INSTAGRAM_PASSWORD;

  if (!username || !password) {
    console.log('  Instagram credentials not configured (set INSTAGRAM_USERNAME and INSTAGRAM_PASSWORD)');
    return false;
  }

  console.log('  Logging into Instagram...');

  try {
    // Go to login page
    await page.goto('https://www.instagram.com/accounts/login/', {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Wait for login form
    await page.waitForSelector('input[name="username"]', { timeout: 10000 });

    // Fill in credentials
    await page.fill('input[name="username"]', username);
    await page.waitForTimeout(500);
    await page.fill('input[name="password"]', password);
    await page.waitForTimeout(500);

    // Click login button
    await page.click('button[type="submit"]');

    // Wait for navigation or error
    await page.waitForTimeout(5000);

    // Check if we're logged in by looking for common logged-in elements
    const currentUrl = page.url();

    // Check for 2FA or challenge
    if (currentUrl.includes('challenge') || currentUrl.includes('two_factor')) {
      console.log('  Instagram requires 2FA or verification - please complete manually');
      console.log('  After completing verification, the cookies will be saved for future use');
      // Wait longer for manual intervention
      await page.waitForTimeout(60000);
    }

    // Check for successful login
    const isLoggedIn = await page.evaluate(() => {
      // Look for elements that indicate logged-in state
      return !document.querySelector('input[name="username"]') &&
             !document.body.innerText.includes('Log into Instagram');
    });

    if (isLoggedIn) {
      console.log('  Successfully logged into Instagram');
      await saveInstagramCookies();
      return true;
    } else {
      console.log('  Instagram login failed - check credentials');
      return false;
    }
  } catch (error) {
    console.error('  Instagram login error:', error);
    return false;
  }
}

/**
 * Check if currently logged into Instagram
 */
async function isLoggedIntoInstagram(page: Page): Promise<boolean> {
  const content = await page.content();
  return !content.includes('Log into Instagram') &&
         !content.includes('input[name="username"]');
}

/**
 * Render an Instagram page with authentication
 */
export async function renderInstagramPage(url: string): Promise<PageContent> {
  const context = await getInstagramContext();
  const page = await context.newPage();

  try {
    // Navigate to the Instagram page
    await page.goto(url, {
      waitUntil: 'networkidle',
      timeout: 30000,
    });

    // Check if we need to login
    const needsLogin = await page.evaluate(() => {
      return document.body.innerText.includes('Log into Instagram') ||
             document.body.innerText.includes('Log in');
    });

    if (needsLogin) {
      console.log('  Instagram session expired, logging in...');
      const loginSuccess = await loginToInstagram(page);

      if (!loginSuccess) {
        // Return empty content if login failed
        return { text: '', links: [], hash: '' };
      }

      // Navigate back to the original URL
      await page.goto(url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
    }

    // Scroll to load more content
    await autoScroll(page);
    await page.waitForTimeout(2000);

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

    // Also extract href attributes that might contain shortcodes
    const allHrefs = await page.evaluate(() => {
      const anchors = Array.from(document.querySelectorAll('a[href]'));
      return anchors.map((a) => (a as HTMLAnchorElement).href);
    });

    // Add hrefs to text for shortcode extraction
    const textWithHrefs = text + '\n' + allHrefs.join('\n');

    // Generate hash for change detection
    const hash = crypto.createHash('md5').update(text).digest('hex');

    // Save cookies after successful page load
    await saveInstagramCookies();

    return { text: textWithHrefs, links, hash };
  } finally {
    await page.close();
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
