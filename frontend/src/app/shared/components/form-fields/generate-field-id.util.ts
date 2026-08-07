let counter = 0;

/**
 * Génère un identifiant unique et stable pour lier un champ (`p-floatlabel`) à
 * son `<label>` (`id`/`inputId` ↔ `for`).
 */
export function generateFieldId(prefix: string): string {
  return `${prefix}-${++counter}`;
}
