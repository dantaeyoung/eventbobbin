import OpenAI from 'openai';
import { renderPage } from './browser';
import { recordLLMUsage } from '../db';
import { chromium, Browser } from 'playwright';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// GPT-4o pricing: $2.50 per 1M input tokens, $10 per 1M output tokens
// Images are ~765 tokens for a 512x512 image (low detail) or more for high detail
const PRICING = {
  'gpt-4o': { input: 2.50 / 1_000_000, output: 10.00 / 1_000_000 },
};

let browser: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
  }
  return browser;
}

export async function detectLogo(
  url: string,
  sourceId?: string
): Promise<string | null> {
  console.log(`Detecting logo for: ${url}`);

  try {
    const browser = await getBrowser();
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    });
    const page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForTimeout(2000); // Let dynamic content load

    // Take screenshot
    const screenshot = await page.screenshot({ type: 'png' });
    const screenshotBase64 = screenshot.toString('base64');

    // Get potential logo URLs from HTML
    const logoHints = await page.evaluate(() => {
      const hints: string[] = [];

      // Favicons
      document.querySelectorAll('link[rel*="icon"]').forEach((el) => {
        const href = el.getAttribute('href');
        if (href) hints.push(href);
      });

      // OG image
      const ogImage = document.querySelector('meta[property="og:image"]');
      if (ogImage) {
        const content = ogImage.getAttribute('content');
        if (content) hints.push(content);
      }

      // Images with "logo" in src, class, id, or alt
      document.querySelectorAll('img').forEach((img) => {
        const src = img.src || '';
        const className = img.className || '';
        const id = img.id || '';
        const alt = img.alt || '';

        if (
          src.toLowerCase().includes('logo') ||
          className.toLowerCase().includes('logo') ||
          id.toLowerCase().includes('logo') ||
          alt.toLowerCase().includes('logo')
        ) {
          if (src) hints.push(src);
        }
      });

      // SVGs with "logo" in class or id
      document.querySelectorAll('svg').forEach((svg) => {
        const className = svg.getAttribute('class') || '';
        const id = svg.id || '';
        if (
          className.toLowerCase().includes('logo') ||
          id.toLowerCase().includes('logo')
        ) {
          // Can't easily extract SVG as URL, but note it exists
          hints.push('[SVG logo detected in DOM]');
        }
      });

      // Images in header/nav
      document.querySelectorAll('header img, nav img, [class*="header"] img, [class*="nav"] img').forEach((img) => {
        const src = (img as HTMLImageElement).src;
        if (src && !hints.includes(src)) {
          hints.push(src);
        }
      });

      return hints.slice(0, 10); // Limit to 10 hints
    });

    await context.close();

    // Build prompt with screenshot and hints
    const model = 'gpt-4o';
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `This is a screenshot of a website. I need to find the organization's logo.

Here are some potential logo URLs found in the HTML:
${logoHints.map((h, i) => `${i + 1}. ${h}`).join('\n')}

Please identify the main logo of this organization/website. Look for:
- The primary brand logo (usually in the header/top of the page)
- NOT social media icons, NOT partner logos, NOT decorative images

If you can identify which of the URLs above is the logo, return just that URL.
If the logo is an SVG embedded in the page (not a URL), return "SVG_EMBEDDED".
If you cannot identify a clear logo, return "NOT_FOUND".

Return ONLY the URL, "SVG_EMBEDDED", or "NOT_FOUND" - no explanation.`,
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:image/png;base64,${screenshotBase64}`,
                detail: 'low', // Use low detail to save tokens
              },
            },
          ],
        },
      ],
      max_tokens: 500,
    });

    // Track usage
    const usage = response.usage;
    if (usage) {
      const pricing = PRICING[model as keyof typeof PRICING];
      const cost = (usage.prompt_tokens * pricing.input) + (usage.completion_tokens * pricing.output);
      recordLLMUsage({
        sourceId: sourceId || null,
        model,
        promptTokens: usage.prompt_tokens,
        completionTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
        cost,
      });
    }

    const result = response.choices[0]?.message?.content?.trim() || 'NOT_FOUND';
    console.log(`  Logo detection result: ${result}`);

    if (result === 'NOT_FOUND' || result === 'SVG_EMBEDDED') {
      // Try to fall back to favicon
      const favicon = logoHints.find((h) => h.includes('favicon') || h.includes('icon'));
      if (favicon && !favicon.startsWith('[')) {
        // Make absolute URL
        const faviconUrl = new URL(favicon, url).href;
        console.log(`  Falling back to favicon: ${faviconUrl}`);
        return faviconUrl;
      }
      return null;
    }

    // Make sure it's an absolute URL
    try {
      const logoUrl = new URL(result, url).href;
      return logoUrl;
    } catch {
      return result; // Return as-is if it's already absolute
    }
  } catch (error) {
    console.error(`  Logo detection error:`, error);
    return null;
  }
}
