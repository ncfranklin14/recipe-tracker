export function formatSourceLabel(value: string) {
  return value
    .replace(/^www\./, "")
    .replace(/\.(com|net|org)$/i, "")
    .replace(/[-_]/g, " ");
}

export function linesToArray(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function arrayToLines(value: string[]) {
  return value.join("\n");
}
