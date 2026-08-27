export function formatDate(value: string | undefined | null): string {
  return value ? new Date(value).toLocaleString() : "—";
}

export function errorMessage(error: unknown, fallback = "Request failed."): string {
  return error instanceof Error ? error.message : fallback;
}
