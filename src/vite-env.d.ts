/// <reference types="vite/client" />

// Imports de CSS como side-effect (Vite los inyecta; para TS son sin valor).
declare module '*.css';

// Token CSRF que ERPNext inyecta en window (boot). Usado por FrappeBase.getHeaders.
interface Window {
  csrf_token?: string;
}
