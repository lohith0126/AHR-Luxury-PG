export default function Logo({ size = 40 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      <path d="M8 42V20l8-6v28M16 42V10l10-6 10 6v32M36 42V22l4 3v17" stroke="#f2b632" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
      <path d="M22 16h8M22 22h8M22 28h8M22 34h8" stroke="#f2b632" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 42h40" stroke="#f2b632" strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}
