export default function Footer({ className = '' }: { className?: string }) {
  return (
    <footer className={`py-5 text-center text-[11px] text-ink-3 ${className}`}>
      Made by: David Hefner
    </footer>
  );
}
