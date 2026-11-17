const ENTIDADES: Record<string, string> = {
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
};

export const escHTML = (s: unknown): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ENTIDADES[c] ?? c);
