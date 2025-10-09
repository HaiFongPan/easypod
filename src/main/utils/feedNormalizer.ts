import sanitizeHtml from "sanitize-html";
import {
  ParsedFeed,
  ParsedEpisode,
  ParsedChapter,
  PodcastFunding,
  PodcastPerson,
} from "../types/feed";

/**
 * Feed Data Normalizer
 * Standardizes RSS feed data across different formats and extensions
 */

/**
 * Parse duration from various formats to seconds
 * Supports: HH:MM:SS, MM:SS, SS, or numeric seconds
 */
export function parseDuration(
  duration: string | number | undefined,
): number | undefined {
  if (!duration) return undefined;

  if (typeof duration === "number") {
    return Math.floor(duration);
  }

  const str = duration.toString().trim();
  if (!str) return undefined;

  // Check if it contains colons (time format)
  if (str.includes(":")) {
    // Parse time format (HH:MM:SS or MM:SS)
    const timeParts = str.split(":").map((part) => parseInt(part, 10));
    if (timeParts.length === 0 || timeParts.some(isNaN)) {
      return undefined;
    }

    let seconds = 0;
    if (timeParts.length === 3) {
      // HH:MM:SS
      seconds = timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2];
    } else if (timeParts.length === 2) {
      // MM:SS
      seconds = timeParts[0] * 60 + timeParts[1];
    } else if (timeParts.length === 1) {
      // SS
      seconds = timeParts[0];
    }

    return seconds > 0 ? seconds : undefined;
  }

  // Try parsing as number (seconds)
  const numeric = parseFloat(str);
  if (!isNaN(numeric)) {
    return Math.floor(numeric);
  }

  return undefined;
}

/**
 * Parse date from RSS pubDate or similar fields
 */
export function parseDate(dateStr: string | undefined): Date | undefined {
  if (!dateStr) return undefined;

  try {
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? undefined : date;
  } catch {
    return undefined;
  }
}

/**
 * Sanitize HTML content for description/summary fields
 * Uses blacklist approach: only filters out explicitly dangerous tags/attributes
 */
export function sanitizeDescription(html: string | undefined): string {
  if (!html) return "";

  return sanitizeHtml(html, {
    // Allow all tags by default, but explicitly filter dangerous ones
    allowedTags: false,
    allowedAttributes: false,
    disallowedTagsMode: "discard",

    // Blacklist: filter out all high-risk tags
    exclusiveFilter: (frame) => {
      const tag = frame.tag?.toLowerCase();

      // Script execution
      if (['script', 'iframe', 'object', 'embed', 'applet'].includes(tag)) {
        return true;
      }

      // Style injection
      if (['style', 'link'].includes(tag)) {
        return true;
      }

      // Forms and data capture
      if (['form', 'input', 'button', 'textarea', 'select'].includes(tag)) {
        return true;
      }

      // Frames
      if (['frame', 'frameset'].includes(tag)) {
        return true;
      }

      // Metadata and navigation
      if (['base', 'meta', 'title'].includes(tag)) {
        return true;
      }

      return false;
    },

    // Filter dangerous attributes
    transformTags: {
      '*': (tagName, attribs) => {
        const cleanAttribs: Record<string, string> = {};

        for (const [key, value] of Object.entries(attribs)) {
          const attrLower = key.toLowerCase();

          // Block all event handlers (on*)
          if (attrLower.startsWith('on')) {
            continue;
          }

          // Block dangerous attributes
          if (['formaction', 'action', 'srcdoc', 'data'].includes(attrLower)) {
            continue;
          }

          // Filter javascript: and data: protocols (except for images)
          if (['href', 'src'].includes(attrLower)) {
            const valueLower = value?.toLowerCase() || '';
            if (valueLower.startsWith('javascript:')) {
              continue;
            }
            if (attrLower === 'href' && valueLower.startsWith('data:')) {
              continue;
            }
          }

          cleanAttribs[key] = value;
        }

        return {
          tagName,
          attribs: cleanAttribs,
        };
      },
    },

    allowedSchemes: ["http", "https", "mailto", "data"],
    allowVulnerableTags: true, // Acknowledge we're handling risks via filtering
  });
}

/**
 * Extract and clean text content from HTML
 */
export function extractTextContent(html: string | undefined): string {
  if (!html) return "";

  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extract chapter timestamps from shownotes
 * Looks for patterns like "00:12:34" or "12:34" followed by a title
 */
export function extractChaptersFromShownotes(html: string): ParsedChapter[] {
  if (!html) return [];

  const chapters: ParsedChapter[] = [];
  const text = extractTextContent(html);

  // Regex to match timestamps: (00:)12:34 or 12:34 at start of line or after whitespace
  const timestampRegex =
    /(?:^|\n)\s*(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s*[-–—:\s]*(.+?)(?=\n|$)/gm;

  let match;
  while ((match = timestampRegex.exec(text)) !== null) {
    const [, hours, minutes, seconds, title] = match;

    const startTime =
      parseInt(hours || "0", 10) * 3600 +
      parseInt(minutes, 10) * 60 +
      parseInt(seconds, 10);

    const cleanTitle = title.trim().replace(/^[-–—:]\s*/, "");

    if (cleanTitle) {
      chapters.push({
        title: cleanTitle,
        startTime,
        source: "shownote",
      });
    }
  }

  // Sort chapters by start time
  return chapters.sort((a, b) => a.startTime - b.startTime);
}

/**
 * Normalize iTunes category string
 */
export function normalizeCategory(
  category: string | undefined,
): string | undefined {
  if (!category) return undefined;

  return category
    .replace(/^iTunes\s*/i, "")
    .replace(/&amp;/g, "&")
    .trim();
}

/**
 * Parse keywords from iTunes keywords field
 */
export function parseKeywords(keywords: string | undefined): string[] {
  if (!keywords) return [];

  return keywords
    .split(",")
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
}

/**
 * Validate and clean URL
 */
export function validateUrl(url: string | undefined): string | undefined {
  if (!url) return undefined;

  try {
    const cleanUrl = url.trim();
    new URL(cleanUrl); // Validate URL format
    return cleanUrl;
  } catch {
    return undefined;
  }
}

/**
 * Generate consistent GUID for episodes
 * Falls back to URL or title+pubDate if no GUID provided
 */
export function generateEpisodeGuid(
  guid: string | undefined,
  audioUrl: string,
  title: string,
  pubDate: Date | undefined,
): string {
  if (guid?.trim()) {
    return guid.trim();
  }

  if (audioUrl) {
    return audioUrl;
  }

  // Fallback to title + date
  const dateStr = pubDate ? pubDate.toISOString().split("T")[0] : "unknown";
  return `${title}-${dateStr}`.replace(/[^a-zA-Z0-9-]/g, "-").toLowerCase();
}

/**
 * Normalize podcast funding information
 */
export function normalizeFunding(funding: any[]): PodcastFunding[] {
  if (!Array.isArray(funding)) return [];

  return funding
    .map((item) => ({
      url: validateUrl(item.url || item._),
      message: item.message || undefined,
    }))
    .filter((item) => item.url) as PodcastFunding[];
}

/**
 * Normalize podcast person information
 */
export function normalizePersons(persons: any[]): PodcastPerson[] {
  if (!Array.isArray(persons)) return [];

  return persons
    .map((person) => ({
      name: person._ || person.name || "",
      role: person.role || undefined,
      group: person.group || undefined,
      img: validateUrl(person.img),
      href: validateUrl(person.href),
    }))
    .filter((person) => person.name.trim());
}

/**
 * Clean and validate image URL with fallback logic
 */
export function getImageUrl(
  primary?: string,
  fallback?: string,
): string | undefined {
  const primaryUrl = validateUrl(primary);
  if (primaryUrl) return primaryUrl;

  return validateUrl(fallback);
}
