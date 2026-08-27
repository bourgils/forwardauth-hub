export function normalizeHostname(input: string): string | null {
  const value = input.trim().toLowerCase().replace(/\.$/, "");
  if (!value || value.length > 253 || value.includes(":") || value.includes("/") || value.includes("@")) return null;
  if (value === "localhost") return value;
  const labels = value.split(".");
  if (labels.some((label) => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  return value;
}

export function forwardedHostname(header: string | undefined): string | null {
  if (!header) return null;
  const first = header.split(",", 1)[0]?.trim();
  if (!first) return null;
  try {
    return normalizeHostname(new URL(`http://${first}`).hostname);
  } catch {
    return null;
  }
}
