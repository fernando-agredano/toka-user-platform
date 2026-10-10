const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** "ana.perez@toka.local" -> "Ana Perez". */
export const displayNameFromEmail = (email: string): string =>
  (email.split('@')[0] ?? email)
    .split(/[._-]+/)
    .filter(Boolean)
    .map(capitalize)
    .join(' ');
