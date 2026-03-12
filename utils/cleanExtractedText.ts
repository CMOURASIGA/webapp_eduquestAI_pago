export function cleanExtractedText(text: string, maxLength = 2000): string {
  if (!text) return "";
  let cleaned = text
    .replace(/\r/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[^\S\r\n]{2,}/g, " ")
    .trim();

  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength) + "...";
  }
  return cleaned;
}
