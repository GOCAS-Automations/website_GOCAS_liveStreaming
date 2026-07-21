// Tokens de marca GOCAS — paleta, tipografías y helpers.
// Regla 70·25·5 (70% fondos cálidos · 25% oliva · 5% ámbar).
export const colors = {
  olive: '#3d4a2a',
  oliveSoft: '#6b7553',
  oliveDeep: '#2b331d',
  amber: '#d97a3c',
  amberSoft: '#e08b52',
  bg: '#f5f1e8',
  surface: '#fffdf9',
  surface2: '#efe9dc',
  ink: '#23301a',
  muted: '#6f7860',
  line: '#e2d9c6',
  white: '#ffffff',
  danger: '#b0472c',
} as const;

export const font = {
  display: 'var(--font-manrope), system-ui, sans-serif',
  mono: 'var(--font-mono), ui-monospace, monospace',
} as const;

export const POSITIONS: { value: string; label: string }[] = [
  { value: 'top-left', label: 'Arriba izquierda' },
  { value: 'top-right', label: 'Arriba derecha' },
  { value: 'bottom-left', label: 'Abajo izquierda' },
  { value: 'bottom-right', label: 'Abajo derecha' },
  { value: 'center', label: 'Centro' },
];
