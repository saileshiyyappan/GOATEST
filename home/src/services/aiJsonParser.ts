/**
 * Parses JSON returned by an AI model without changing JSON string content.
 * Supports plain JSON, fenced Markdown JSON, and harmless surrounding prose.
 */
export function parseAiJsonResponse<T>(text: string): T {
  let cleaned = String(text || '').trim();
  if (!cleaned) throw new Error('AI returned an empty JSON response.');

  cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const candidate = findFirstCompleteJson(cleaned);
    if (candidate !== null) {
      try {
        return JSON.parse(candidate) as T;
      } catch {
        // Continue to the clear structured parsing error below.
      }
    }
  }

  throw new Error('AI returned invalid JSON for Daily Q/A questions.');
}

function findFirstCompleteJson(text: string): string | null {
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '[' && text[start] !== '{') continue;
    const opening = text[start];
    const closing = opening === '[' ? ']' : '}';
    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let index = start; index < text.length; index += 1) {
      const character = text[index];
      if (inString) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') inString = false;
        continue;
      }
      if (character === '"') { inString = true; continue; }
      if (character === opening) depth += 1;
      else if (character === closing) {
        depth -= 1;
        if (depth === 0) return text.slice(start, index + 1);
      }
    }
  }
  return null;
}
