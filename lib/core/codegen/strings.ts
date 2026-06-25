/** "AppTable" -> "appTable", "Web" -> "web". */
export function camelCase(name: string): string {
  if (!name) return name;
  return name[0].toLowerCase() + name.slice(1);
}

/** "resize images" -> "ResizeImages", "process-job" -> "ProcessJob". For identifiers. */
export function pascalCase(name: string): string {
  const camel = name.replace(/[\s_-]+(.)?/g, (_, c: string | undefined) =>
    c ? c.toUpperCase() : '',
  );
  return camel ? camel[0].toUpperCase() + camel.slice(1) : camel;
}

/** "ProcessJob" -> "process-job", "AppTable" -> "app-table". */
export function kebabCase(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/** Deduplicate while preserving first-seen order. */
export function uniq<T>(items: T[]): T[] {
  const seen = new Set<T>();
  const out: T[] = [];
  for (const item of items) {
    if (!seen.has(item)) {
      seen.add(item);
      out.push(item);
    }
  }
  return out;
}

/** Indent every line of `text` by `spaces`. */
export function indent(text: string, spaces: number): string {
  const pad = ' '.repeat(spaces);
  return text
    .split('\n')
    .map((line) => (line.length ? pad + line : line))
    .join('\n');
}
