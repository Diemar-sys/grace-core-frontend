import { useEffect } from 'react';

const SKIP_TYPES = new Set([
  'password', 'email', 'number', 'hidden', 'checkbox', 'radio',
  'file', 'date', 'time', 'datetime-local', 'tel', 'color', 'range', 'month', 'week'
]);

const setNativeValue = (el, value) => {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set;
  setter?.call(el, value);
};

export function useAutoUppercase() {
  useEffect(() => {
    const handler = (e) => {
      const t = e.target;
      if (!t) return;
      const tag = t.tagName;
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') return;
      if (tag === 'INPUT' && SKIP_TYPES.has(t.type)) return;
      if (t.dataset.noUpper === 'true') return;
      if (t.closest('[data-no-upper]')) return;
      const upper = t.value.toUpperCase();
      if (upper === t.value) return;
      const start = t.selectionStart;
      const end = t.selectionEnd;
      setNativeValue(t, upper);
      try { t.setSelectionRange(start, end); } catch (_) { /* readonly inputs */ }
      t.dispatchEvent(new Event('input', { bubbles: true }));
    };
    document.addEventListener('input', handler, true);
    return () => document.removeEventListener('input', handler, true);
  }, []);
}
