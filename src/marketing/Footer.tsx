import { Link } from 'react-router-dom';

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line px-4 sm:px-6 xl:px-10 py-6 flex flex-col sm:flex-row gap-3 sm:gap-6 sm:items-center justify-between font-mono text-xs text-muted">
      <div>&copy; {year} Punch In. All rights reserved.</div>
      <nav className="flex gap-4">
        <Link to="/privacy" className="hover:text-ink">
          Privacy
        </Link>
        <Link to="/terms" className="hover:text-ink">
          Terms
        </Link>
        <a href="mailto:konathalavamsi123@gmail.com" className="hover:text-ink">
          Contact
        </a>
      </nav>
    </footer>
  );
}
