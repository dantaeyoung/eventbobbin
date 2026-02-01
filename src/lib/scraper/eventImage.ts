export interface EventPageDetails {
  imageUrl?: string;
  description?: string;
  fullText?: string;
  price?: string;
  venue?: string;
  startDate?: string;
  endDate?: string;
  schemaData?: Record<string, unknown>;
}

/**
 * Fetches metadata from an event's detail page.
 * Extracts og tags, JSON-LD schema, and main content - no LLM needed.
 */
export async function fetchEventPageDetails(url: string): Promise<EventPageDetails | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EventBobbin/1.0)',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();
    const details: EventPageDetails = {};

    // Extract og:image
    const ogImageMatch = html.match(
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
    ) || html.match(
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i
    );
    if (ogImageMatch?.[1]) {
      details.imageUrl = resolveUrl(ogImageMatch[1], url);
    }

    // Extract og:description
    const ogDescMatch = html.match(
      /<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i
    ) || html.match(
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:description["']/i
    );
    if (ogDescMatch?.[1]) {
      details.description = decodeHtmlEntities(ogDescMatch[1]);
    }

    // Fallback to meta description
    if (!details.description) {
      const metaDescMatch = html.match(
        /<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i
      ) || html.match(
        /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["']/i
      );
      if (metaDescMatch?.[1]) {
        details.description = decodeHtmlEntities(metaDescMatch[1]);
      }
    }

    // Extract JSON-LD structured data (Schema.org Event)
    const jsonLdMatches = html.matchAll(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
    for (const match of jsonLdMatches) {
      try {
        const data = JSON.parse(match[1]);
        const eventData = findEventSchema(data);
        if (eventData) {
          details.schemaData = eventData;
          // Extract specific fields from schema
          if (eventData.description && !details.description) {
            details.description = String(eventData.description);
          }
          if (eventData.offers) {
            const offers = Array.isArray(eventData.offers) ? eventData.offers[0] : eventData.offers;
            if (offers?.price) {
              details.price = `${offers.priceCurrency || '$'}${offers.price}`;
            }
          }
          const location = eventData.location as Record<string, unknown> | undefined;
          if (location?.name) {
            details.venue = String(location.name);
          }
          // Extract dates from schema - these are usually more accurate
          if (eventData.startDate) {
            details.startDate = String(eventData.startDate);
          }
          if (eventData.endDate) {
            details.endDate = String(eventData.endDate);
          }
          break;
        }
      } catch {
        // Invalid JSON, skip
      }
    }

    // Extract main content text (simplified)
    const mainMatch = html.match(/<main[^>]*>([\s\S]*?)<\/main>/i) ||
                      html.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
    if (mainMatch?.[1]) {
      // Strip HTML tags and clean up whitespace
      const text = mainMatch[1]
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (text.length > 50 && text.length < 10000) {
        details.fullText = text;
      }
    }

    return Object.keys(details).length > 0 ? details : null;
  } catch {
    return null;
  }
}

function resolveUrl(imageUrl: string, baseUrl: string): string {
  if (imageUrl.startsWith('http')) return imageUrl;
  if (imageUrl.startsWith('/')) {
    const urlObj = new URL(baseUrl);
    return `${urlObj.origin}${imageUrl}`;
  }
  return imageUrl;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function findEventSchema(data: unknown): Record<string, unknown> | null {
  if (!data || typeof data !== 'object') return null;

  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findEventSchema(item);
      if (found) return found;
    }
    return null;
  }

  const obj = data as Record<string, unknown>;
  if (obj['@type'] === 'Event') return obj;
  if (obj['@graph'] && Array.isArray(obj['@graph'])) {
    return findEventSchema(obj['@graph']);
  }
  return null;
}

/**
 * Fetches the og:image from an event's detail page.
 * This is a lightweight HTTP fetch (no browser rendering).
 * @deprecated Use fetchEventPageDetails instead for more data
 */
export async function fetchEventImage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; EventBobbin/1.0)',
      },
    });
    clearTimeout(timeout);

    if (!response.ok) return null;

    const html = await response.text();

    // Look for og:image meta tag
    const ogImageMatch = html.match(
      /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
    ) || html.match(
      /<meta[^>]*content=["']([^"']+)["'][^>]*property=["']og:image["']/i
    );

    if (ogImageMatch?.[1]) {
      let imageUrl = ogImageMatch[1];
      // Handle relative URLs
      if (imageUrl.startsWith('/')) {
        const urlObj = new URL(url);
        imageUrl = `${urlObj.origin}${imageUrl}`;
      }
      return imageUrl;
    }

    // Fallback: twitter:image
    const twitterImageMatch = html.match(
      /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i
    ) || html.match(
      /<meta[^>]*content=["']([^"']+)["'][^>]*name=["']twitter:image["']/i
    );

    if (twitterImageMatch?.[1]) {
      let imageUrl = twitterImageMatch[1];
      if (imageUrl.startsWith('/')) {
        const urlObj = new URL(url);
        imageUrl = `${urlObj.origin}${imageUrl}`;
      }
      return imageUrl;
    }

    return null;
  } catch (error) {
    // Timeout or network error - just skip
    return null;
  }
}
