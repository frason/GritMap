/** Keeps the items whose name contains every word of `query`, ignoring case and extra spaces. An empty query keeps everything. */
export function filterByName<T>(items: readonly T[], query: string, nameOf: (item: T) => string | undefined): T[] {
  const words = query.toLowerCase().split(/\s+/).filter((word) => word.length > 0);
  if (words.length === 0) return [...items];
  return items.filter((item) => {
    const name = nameOf(item)?.toLowerCase();
    return name !== undefined && words.every((word) => name.includes(word));
  });
}
