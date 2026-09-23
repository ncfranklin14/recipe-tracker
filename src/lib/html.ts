const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  quot: '"',
  apos: "'",
  lt: "<",
  gt: ">",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  deg: "°",
  frac12: "½",
  frac14: "¼",
  frac34: "¾",
  bull: "•",
  middot: "·",
};

// Decodes named entities plus decimal (&#064;) and hex (&#x1f35c;) entities.
// Instagram encodes emoji, "@" and line breaks this way.
export function decodeHtml(value: string) {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (full, entity: string) => {
    if (entity[0] === "#") {
      const codePoint =
        entity[1] === "x" || entity[1] === "X"
          ? Number.parseInt(entity.slice(2), 16)
          : Number.parseInt(entity.slice(1), 10);

      try {
        return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : full;
      } catch {
        return full;
      }
    }

    return NAMED_ENTITIES[entity.toLowerCase()] ?? full;
  });
}

export function stripTags(value: string) {
  return decodeHtml(value.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim());
}
