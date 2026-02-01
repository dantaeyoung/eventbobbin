/**
 * Instagram Post Scraper
 * Extracts post data from public Instagram posts using GraphQL API
 *
 * Note: Instagram changes doc_id values every 2-4 weeks, so this may need updates
 */

export interface InstagramPostData {
  shortcode: string;
  caption: string;
  timestamp: number;
  displayUrl: string;
  videoUrl?: string;
  isVideo: boolean;
  likeCount: number;
  commentCount: number;
  ownerUsername: string;
  ownerFullName?: string;
  ownerProfilePic?: string;
  location?: {
    name: string;
    address?: string;
  };
  carouselMedia?: Array<{
    displayUrl: string;
    videoUrl?: string;
    isVideo: boolean;
  }>;
}

// Extract shortcode from Instagram URL
// Supports: /p/CODE/, /reel/CODE/, /reels/CODE/
export function extractShortcode(url: string): string | null {
  const patterns = [
    /instagram\.com\/p\/([A-Za-z0-9_-]+)/,
    /instagram\.com\/reel\/([A-Za-z0-9_-]+)/,
    /instagram\.com\/reels\/([A-Za-z0-9_-]+)/,
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

// Check if URL is an Instagram post/reel
export function isInstagramUrl(url: string): boolean {
  return /instagram\.com\/(p|reel|reels)\//.test(url);
}

/**
 * Fetch Instagram post data using GraphQL API
 */
export async function fetchInstagramPost(url: string): Promise<InstagramPostData | null> {
  const shortcode = extractShortcode(url);
  if (!shortcode) {
    console.error('Could not extract shortcode from URL:', url);
    return null;
  }


  // GraphQL endpoint
  const graphqlUrl = 'https://www.instagram.com/graphql/query';

  // doc_id for post details - this may need to be updated periodically
  // Last updated: Feb 2025
  const docId = '8845758582119845';

  const variables = JSON.stringify({
    shortcode,
    fetch_tagged_user_count: null,
    hoisted_comment_id: null,
    hoisted_reply_id: null,
  });

  try {
    const response = await fetch(graphqlUrl, {
      method: 'POST',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'X-IG-App-ID': '936619743392459',
        'X-ASBD-ID': '129477',
        'X-FB-LSD': 'AVqbxe3J_YA',
        'Sec-Fetch-Dest': 'empty',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'same-origin',
        'Origin': 'https://www.instagram.com',
        'Referer': `https://www.instagram.com/p/${shortcode}/`,
      },
      body: `doc_id=${docId}&variables=${encodeURIComponent(variables)}`,
    });

    if (!response.ok) {
      return fetchInstagramPostFallback(url, shortcode);
    }

    const data = await response.json();
    const media = data?.data?.xdt_shortcode_media;

    if (!media) {
      return fetchInstagramPostFallback(url, shortcode);
    }

    return parseInstagramMedia(media);
  } catch {
    return fetchInstagramPostFallback(url, shortcode);
  }
}

/**
 * Fallback: Try oEmbed API first, then HTML scraping
 */
async function fetchInstagramPostFallback(url: string, shortcode: string): Promise<InstagramPostData | null> {
  // Try oEmbed API first - it's public and more reliable
  try {
    const oembedUrl = `https://api.instagram.com/oembed/?url=https://www.instagram.com/p/${shortcode}/`;
    const oembedResponse = await fetch(oembedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    });

    if (oembedResponse.ok) {
      const oembedData = await oembedResponse.json();

      // oEmbed returns: author_name, author_url, html, thumbnail_url, title, etc.
      // Extract caption from the title field (usually contains it)
      const caption = oembedData.title || '';
      const username = oembedData.author_name || 'unknown';
      const thumbnailUrl = oembedData.thumbnail_url || '';

      return {
        shortcode,
        caption,
        timestamp: Date.now() / 1000,
        displayUrl: thumbnailUrl,
        isVideo: false, // oEmbed doesn't tell us this directly
        likeCount: 0,
        commentCount: 0,
        ownerUsername: username,
      };
    }
  } catch {
    // oEmbed failed, continue to fallback
  }

  // Try the embed endpoint
  try {
    const embedUrl = `https://www.instagram.com/p/${shortcode}/embed/`;
    const response = await fetch(embedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      return fetchInstagramPageDirect(url, shortcode);
    }

    const html = await response.text();

    // Extract caption from embed page
    // Look for the caption in the embed HTML
    const captionMatch = html.match(/<div class="Caption"[^>]*>[\s\S]*?<div class="CaptionContent"[^>]*>([\s\S]*?)<\/div>/i) ||
                         html.match(/<div[^>]*class="[^"]*Caption[^"]*"[^>]*>([\s\S]*?)<\/div>/i);

    // Extract from script data
    const scriptMatch = html.match(/<script[^>]*>window\.__additionalDataLoaded\([^,]+,\s*({[\s\S]*?})\s*\);?<\/script>/);

    let caption = '';
    let imageUrl = '';
    let username = 'unknown';
    let isVideo = false;

    if (scriptMatch) {
      try {
        const data = JSON.parse(scriptMatch[1]);
        const media = data?.shortcode_media;
        if (media) {
          caption = media.edge_media_to_caption?.edges?.[0]?.node?.text || '';
          imageUrl = media.display_url || '';
          username = media.owner?.username || 'unknown';
          isVideo = media.is_video || false;
        }
      } catch {
        // JSON parse failed, continue with other methods
      }
    }

    // Fallback to HTML extraction
    if (!caption) {
      // Try to get caption from visible text
      const captionTextMatch = html.match(/<span[^>]*>([\s\S]*?)<\/span>[\s\S]*?<time/i);
      if (captionTextMatch) {
        caption = captionTextMatch[1].replace(/<[^>]+>/g, '').trim();
      }
    }

    if (!imageUrl) {
      // Try og:image from embed
      imageUrl = extractMetaContent(html, 'og:image') || '';
      // Or find img src
      const imgMatch = html.match(/<img[^>]*class="[^"]*EmbeddedMedia[^"]*"[^>]*src="([^"]+)"/i) ||
                       html.match(/<img[^>]*src="([^"]+)"[^>]*class="[^"]*EmbeddedMedia/i);
      if (imgMatch) {
        imageUrl = imgMatch[1];
      }
    }

    if (!username || username === 'unknown') {
      const usernameMatch = html.match(/<a[^>]*class="[^"]*Username[^"]*"[^>]*>([^<]+)<\/a>/i) ||
                            html.match(/instagram\.com\/([^/"?]+)/);
      if (usernameMatch) {
        username = usernameMatch[1];
      }
    }

    if (!caption && !imageUrl) {
      return fetchInstagramPageDirect(url, shortcode);
    }
    return {
      shortcode,
      caption: cleanCaption(caption),
      timestamp: Date.now() / 1000,
      displayUrl: imageUrl,
      isVideo,
      likeCount: 0,
      commentCount: 0,
      ownerUsername: username,
    };
  } catch {
    return fetchInstagramPageDirect(url, shortcode);
  }
}

/**
 * Direct page fetch as last resort
 */
async function fetchInstagramPageDirect(url: string, shortcode: string): Promise<InstagramPostData | null> {
  try {
    // Use more complete headers to appear as a real browser
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        'Cache-Control': 'max-age=0',
      },
    });

    // Even if we get a redirect or error page, try to extract what we can
    const html = await response.text();

    // Try to extract from meta tags first
    let rawDescription = extractMetaContent(html, 'og:description') ||
                         extractMetaContent(html, 'description') || '';
    let imageUrl = extractMetaContent(html, 'og:image');
    let title = extractMetaContent(html, 'og:title') || '';
    let username = '';

    // If meta tags are empty, try to extract from JSON in scripts
    if (!rawDescription && !imageUrl) {
      // Try window._sharedData (older format)
      const sharedDataMatch = html.match(/window\._sharedData\s*=\s*({[\s\S]*?});<\/script>/);
      if (sharedDataMatch) {
        try {
          const data = JSON.parse(sharedDataMatch[1]);
          const media = data?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
          if (media) {
            rawDescription = media.edge_media_to_caption?.edges?.[0]?.node?.text || '';
            imageUrl = media.display_url || '';
            username = media.owner?.username || '';
          }
        } catch { /* ignore parse errors */ }
      }

      // Try __additionalDataLoaded (another format)
      const additionalDataMatch = html.match(/__additionalDataLoaded\s*\([^,]+,\s*({[\s\S]*?})\s*\)/);
      if (additionalDataMatch && !rawDescription) {
        try {
          const data = JSON.parse(additionalDataMatch[1]);
          const media = data?.graphql?.shortcode_media || data?.shortcode_media;
          if (media) {
            rawDescription = media.edge_media_to_caption?.edges?.[0]?.node?.text || '';
            imageUrl = media.display_url || '';
            username = media.owner?.username || '';
          }
        } catch { /* ignore parse errors */ }
      }

      // Try looking for JSON-LD schema
      const jsonLdMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      if (jsonLdMatch && !rawDescription) {
        try {
          const data = JSON.parse(jsonLdMatch[1]);
          if (data['@type'] === 'VideoObject' || data['@type'] === 'ImageObject') {
            rawDescription = data.caption || data.description || '';
            imageUrl = data.thumbnailUrl || data.image || '';
            username = data.author?.name || '';
          }
        } catch { /* ignore parse errors */ }
      }
    }

    // Extract the actual caption text (without the "X likes, Y comments" prefix)
    const caption = extractCaptionFromDescription(rawDescription);


    // Extract username from description format: "X likes, Y comments - USERNAME on ..."
    if (!username) {
      const usernameFromDesc = rawDescription.match(/\d+\s+comments?\s*-\s*(\S+)\s+on/i);
      // Fallback to title format: "USERNAME on Instagram: ..."
      const usernameFromTitle = title.match(/^([^@\s]+)\s+on Instagram/i);
      username = usernameFromDesc?.[1] || usernameFromTitle?.[1] || 'unknown';
    }

    if (!caption && !imageUrl) {
      return null;
    }
    return {
      shortcode,
      caption,
      timestamp: Date.now() / 1000,
      displayUrl: imageUrl || '',
      isVideo: html.includes('"is_video":true') || html.includes('video_url'),
      likeCount: 0,
      commentCount: 0,
      ownerUsername: username,
    };
  } catch {
    return null;
  }
}

function extractMetaContent(html: string, property: string): string | null {
  // Try property attribute
  const propMatch = html.match(
    new RegExp(`<meta[^>]*property=["'](?:og:)?${property}["'][^>]*content=["']([^"']+)["']`, 'i')
  ) || html.match(
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*property=["'](?:og:)?${property}["']`, 'i')
  );
  if (propMatch) return propMatch[1];

  // Try name attribute
  const nameMatch = html.match(
    new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']+)["']`, 'i')
  ) || html.match(
    new RegExp(`<meta[^>]*content=["']([^"']+)["'][^>]*name=["']${property}["']`, 'i')
  );
  return nameMatch ? nameMatch[1] : null;
}

function cleanCaption(caption: string): string {
  return caption
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#064;/g, '@')
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\\n/g, '\n')
    // Decode numeric HTML entities
    .replace(/&#(\d+);/g, (_, num) => String.fromCharCode(parseInt(num, 10)))
    .trim();
}

// Extract actual caption text from Instagram's og:description format
// Format: "X likes, Y comments - username on DATE: "CAPTION_TEXT..."
function extractCaptionFromDescription(description: string): string {
  // Decode HTML entities first so we can work with actual quote characters
  let decoded = cleanCaption(description);

  // Try to extract the quoted caption part
  // Match ": " followed by quote then content
  const quotedMatch = decoded.match(/:\s*"(.+)/);
  if (quotedMatch) {
    // Remove trailing quote if present
    let caption = quotedMatch[1];
    if (caption.endsWith('"')) caption = caption.slice(0, -1);
    return caption.trim();
  }

  // Fallback: remove the "X likes, Y comments - username on DATE:" prefix
  const prefixMatch = decoded.match(/^\d+\s+likes?,\s*\d+\s+comments?\s*-\s*\S+\s+on\s+[^:]+:\s*(.+)/i);
  if (prefixMatch) {
    // Remove surrounding quotes
    let caption = prefixMatch[1].trim();
    if (caption.startsWith('"')) caption = caption.substring(1);
    if (caption.endsWith('"')) caption = caption.slice(0, -1);
    return caption.trim();
  }

  return decoded;
}

function parseInstagramMedia(media: Record<string, unknown>): InstagramPostData {
  const caption = (media.edge_media_to_caption as { edges?: Array<{ node?: { text?: string } }> })
    ?.edges?.[0]?.node?.text || '';

  const owner = media.owner as Record<string, unknown> | undefined;
  const location = media.location as Record<string, unknown> | undefined;

  const result: InstagramPostData = {
    shortcode: media.shortcode as string,
    caption,
    timestamp: media.taken_at_timestamp as number || Date.now() / 1000,
    displayUrl: media.display_url as string || '',
    isVideo: media.is_video as boolean || false,
    likeCount: (media.edge_media_preview_like as { count?: number })?.count || 0,
    commentCount: (media.edge_media_to_parent_comment as { count?: number })?.count || 0,
    ownerUsername: (owner?.username as string) || 'unknown',
    ownerFullName: owner?.full_name as string,
    ownerProfilePic: owner?.profile_pic_url as string,
  };

  if (media.is_video) {
    result.videoUrl = media.video_url as string;
  }

  if (location) {
    result.location = {
      name: location.name as string,
      address: location.address_json as string,
    };
  }

  // Handle carousel posts
  const sidecar = media.edge_sidecar_to_children as { edges?: Array<{ node?: Record<string, unknown> }> };
  if (sidecar?.edges && sidecar.edges.length > 0) {
    result.carouselMedia = sidecar.edges.map((edge) => ({
      displayUrl: edge.node?.display_url as string || '',
      videoUrl: edge.node?.video_url as string,
      isVideo: edge.node?.is_video as boolean || false,
    }));
  }

  return result;
}

/**
 * Extract event information from an Instagram post
 * Returns data in a format compatible with the existing event schema
 */
export async function extractEventFromInstagram(url: string): Promise<{
  title: string;
  description: string;
  imageUrl?: string;
  location?: string;
  rawData: string;
  instagramData: InstagramPostData;
} | null> {
  const postData = await fetchInstagramPost(url);
  if (!postData) return null;

  // Use the first line of caption as title, or truncate if too long
  const captionLines = postData.caption.split('\n').filter(line => line.trim());
  let title = captionLines[0] || `Post by @${postData.ownerUsername}`;
  if (title.length > 100) {
    title = title.substring(0, 97) + '...';
  }

  return {
    title,
    description: postData.caption,
    imageUrl: postData.displayUrl,
    location: postData.location?.name,
    rawData: JSON.stringify(postData, null, 2),
    instagramData: postData,
  };
}
