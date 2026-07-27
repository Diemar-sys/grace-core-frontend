import { useEffect } from 'react';

const SKIP_TYPES = new Set<string>([
  'password', 'email', 'number', 'hidden', 'checkbox', 'radio',
  'file', 'date', 'time', 'datetime-local', 'tel', 'color', 'range', 'month', 'week',
]);

// Señal nativa de "esto es una contraseña", independiente del type visible.
const PWD_AUTOCOMPLETE = new Set<string>(['current-password', 'new-password', 'one-time-code']);

const setNativeValue = (el: HTMLInputElement | HTMLTextAreaElement, value: string): void => {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
};

export function useAutoUppercase(): void {
  useEffect(() => {
    const handler = (e: Event): void => {
      const t = e.target as HTMLInputElement | HTMLTextAreaElement | null;
      if (!t) return;
      const tag = t.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;
      if (tag === 'INPUT' && SKIP_TYPES.has((t as HTMLInputElement).type)) return;
      // Un campo de contraseña con "ojito" cambia a type=text al revelarse, y ahí
      // dejaba de ser 'password': la mayúscula automática estropeaba la clave que
      // se estaba escribiendo. autocomplete no cambia con el toggle, así que manda.
      if (PWD_AUTOCOMPLETE.has(t.autocomplete)) return;
      if (t.dataset.noUpper === 'true') return;
      if (t.closest('[data-no-upper]')) return;
      const upper = t.value.toUpperCase();
      if (upper === t.value) return;
      const start = t.selectionStart;
      const end = t.selectionEnd;
      setNativeValue(t, upper);
      try { t.setSelectionRange(start, end); } catch { /* readonly inputs */ }
      t.dispatchEvent(new Event('input', { bubbles: true }));
    };
    document.addEventListener('input', handler, true);
    return () => document.removeEventListener('input', handler, true);
  }, []);
}
