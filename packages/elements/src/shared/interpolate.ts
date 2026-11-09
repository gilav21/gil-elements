/** Fills `{name}` placeholders in a locale string; an unknown name is left as written. */
export function interpolate(template: string, values: Record<string, string | number>): string {
    return template.replaceAll(/\{(\w+)\}/g, (match, name: string) => String(values[name] ?? match));
}
