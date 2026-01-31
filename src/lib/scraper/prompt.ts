export function buildExtractionPrompt(
  pageText: string,
  links: { text: string; href: string }[],
  currentDate: string
): string {
  const linksText = links
    .slice(0, 100) // Limit to avoid token overflow
    .map((l) => `- "${l.text}" -> ${l.href}`)
    .join('\n');

  return `You are an event extraction assistant. Extract all events from the following webpage content.

CURRENT DATE: ${currentDate}

IMPORTANT RULES:
1. Only extract actual events with specific dates. Do not invent events.
2. If no events are found, return an empty array: []
3. For dates without a year, assume the upcoming occurrence (use ${currentDate.slice(0, 4)} or next year if the date has passed).
4. Parse various date formats: "Feb 3", "2/3/2026", "February 3rd", etc.
5. Parse various time formats: "7pm", "7:00 PM", "19:00", etc.
6. Convert all dates to ISO format: YYYY-MM-DDTHH:MM:SS
7. If only a date is given without time, use T00:00:00
8. Extract event URLs from the links section when available.

PAGE TEXT:
${pageText.slice(0, 15000)}

LINKS ON PAGE:
${linksText}

Respond with a JSON array of events. Each event should have:
- title (string, required): The event name
- startDate (string, required): ISO format date/time
- endDate (string, optional): ISO format date/time if specified
- location (string, optional): Venue name and/or address
- description (string, optional): Brief description if available
- url (string, optional): Direct link to event details
- imageUrl (string, optional): Event image/poster URL if clearly associated with this event. Only include if obvious - skip if uncertain. Ignore logos, icons, and generic site images.

Example response:
[
  {
    "title": "Dance Workshop",
    "startDate": "2026-02-15T19:00:00",
    "endDate": "2026-02-15T21:00:00",
    "location": "123 Main St, New York",
    "description": "Learn contemporary dance techniques",
    "url": "https://example.com/events/dance-workshop",
    "imageUrl": "https://example.com/images/dance-workshop.jpg"
  }
]

JSON ARRAY:`;
}
