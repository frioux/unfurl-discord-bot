const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/g;

export function extractUrls(text: string): string[] {
  const matches = text.match(URL_REGEX);
  if (!matches) return [];

  return matches.filter((match) => {
    try {
      new URL(match);
      return true;
    } catch {
      return false;
    }
  });
}

export function replaceUrl(
  urlString: string,
  sourceDomain: string,
  targetDomain: string
): string | null {
  const url = new URL(urlString);
  if (url.hostname !== sourceDomain) return null;
  url.hostname = targetDomain;
  return url.toString();
}
