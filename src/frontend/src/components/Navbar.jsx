import { useState, useEffect, useCallback } from 'react';
import { Menu, X } from 'lucide-react';

/**
 * Navbar component — The Arena Control Bar.
 * Fixed pill-shaped navbar with scroll morphing, nav links,
 * CTA button, and responsive mobile menu drawer.
 */
export default function Navbar({ onOpenAuth }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const toggleMobile = useCallback(() => {
    setMobileOpen((prev) => {
      document.body.style.overflow = !prev ? 'hidden' : '';
      return !prev;
    });
  }, []);

  const closeMobile = useCallback(() => {
    setMobileOpen(false);
    document.body.style.overflow = '';
  }, []);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') closeMobile(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [closeMobile]);

  const navLinks = [
    { href: '#arena', label: 'Arena' },
    { href: '#agents', label: 'Agents' },
    { href: '#leaderboard', label: 'Leaderboard' },
    { href: '#history', label: 'History' },
  ];

  return (
    <>
      {/* Desktop Navbar */}
      <nav
        id="navbar"
        className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-full border border-white/5 backdrop-blur-md bg-obsidian/60 transition-all duration-500 flex items-center gap-8 nav-pill"
      >
        {/* Logo */}
        <a href="#" className="text-lg font-bold tracking-tight text-ivory whitespace-nowrap">
          Smart<span className="text-champagne">Smash</span>
        </a>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-6 text-sm text-ivory-muted">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="nav-link hover:text-ivory transition-colors duration-300"
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        <button
          className="ml-auto px-5 py-2 bg-champagne text-obsidian text-sm font-semibold rounded-full hover:bg-champagne-dark transition-all duration-300 whitespace-nowrap"
          onClick={onOpenAuth}
        >
          Enter the Arena
        </button>

        {/* Mobile Menu Toggle */}
        <button className="md:hidden ml-2 text-ivory" onClick={toggleMobile}>
          <Menu className="w-5 h-5" />
        </button>
      </nav>

      {/* Mobile Menu Drawer */}
      <div
        className={`fixed inset-0 z-40 bg-obsidian/95 backdrop-blur-xl flex flex-col items-center justify-center gap-8 text-lg transition-all duration-500 ${
          mobileOpen ? '' : 'hidden'
        }`}
      >
        {navLinks.map((link) => (
          <a
            key={link.href}
            href={link.href}
            className="text-ivory-muted hover:text-ivory transition-colors"
            onClick={closeMobile}
          >
            {link.label}
          </a>
        ))}
        <button
          className="px-8 py-3 bg-champagne text-obsidian font-semibold rounded-full"
          onClick={() => { onOpenAuth(); closeMobile(); }}
        >
          Enter the Arena
        </button>
        <button className="absolute top-6 right-6 text-ivory" onClick={closeMobile}>
          <X className="w-6 h-6" />
        </button>
      </div>
    </>
  );
}
