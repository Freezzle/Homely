/**
 * Interpole un template de chaîne avec des paramètres nommés.
 * Exemple : format('Membre {index}', { index: 2 }) → 'Membre 2'
 */
export function format(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) =>
    params[key] !== undefined ? String(params[key]) : `{${key}}`
  );
}

