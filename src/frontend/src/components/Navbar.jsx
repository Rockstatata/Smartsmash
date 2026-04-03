import { useState, useEffect, useCallback } from 'react';
import { Menu, X } from 'lucide-react';

/**
 * Navbar component — The Arena Control Bar.
 * Fixed pill-shaped navbar with scroll morphing, nav links,
 * CTA button, and responsive mobile menu drawer.
 */
const DEFAULT_NAV_LINKS = [
  { id: 'arena', href: '#arena', label: 'Arena' },
  { id: 'agents', href: '#agents', label: 'Agents' },
  { id: 'leaderboard', href: '#leaderboard', label: 'Leaderboard' },
  { id: 'history', href: '#history', label: 'History' },
];

export default function Navbar({
  onOpenAuth,
  currentUser,
  onSignOut,
  navLinks = DEFAULT_NAV_LINKS,
  activeLink = null,
  onNavSelect = null,
  ctaLabel = null,
  onCtaClick = null,
  showUserEmail = true,
}) {
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

  const resolvedCtaLabel = ctaLabel || (currentUser ? 'Sign Out' : 'Enter the Arena');
  const handleCta = onCtaClick || (currentUser ? onSignOut : onOpenAuth);

  const isLinkActive = useCallback((link) => {
    if (!activeLink) return false;
    const normalized = String(activeLink).toLowerCase();
    return (
      normalized === String(link.id || '').toLowerCase()
      || normalized === String(link.href || '').toLowerCase()
      || normalized === String(link.label || '').toLowerCase()
    );
  }, [activeLink]);

  const handleNavClick = useCallback((event, link) => {
    if (typeof onNavSelect === 'function') {
      event.preventDefault();
      onNavSelect(link);
    }
    if (mobileOpen) closeMobile();
  }, [closeMobile, mobileOpen, onNavSelect]);

  return (
    <>
      {/* Desktop Navbar */}
      <nav
        id="navbar"
        className="fixed top-2.5 sm:top-4 left-1/2 -translate-x-1/2 z-50 px-3 sm:px-5 py-2.5 sm:py-3 rounded-full border border-white/5 backdrop-blur-md bg-obsidian/60 transition-all duration-500 flex items-center gap-2 sm:gap-5 nav-pill"
      >
        {/* Logo */}
        <a href="#" className="text-base sm:text-lg font-bold tracking-tight text-ivory whitespace-nowrap">
          Smart<span className="text-champagne">Smash</span>
        </a>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-4 lg:gap-6 text-sm text-ivory-muted">
          {navLinks.map((link) => (
            <a
              key={link.id || link.href}
              href={link.href || '#'}
              onClick={(event) => handleNavClick(event, link)}
              className={`nav-link hover:text-ivory transition-colors duration-300 ${isLinkActive(link) ? 'text-ivory nav-link-active' : ''}`}
            >
              {link.label}
            </a>
          ))}
        </div>

        {/* CTA */}
        {handleCta ? (
          <button
            className="hidden sm:inline-flex ml-auto px-4 lg:px-5 py-2 bg-champagne text-obsidian text-xs sm:text-sm font-semibold rounded-full hover:bg-champagne-dark transition-all duration-300 whitespace-nowrap"
            onClick={handleCta}
          >
            {resolvedCtaLabel}
          </button>
        ) : null}

        {showUserEmail && currentUser?.email ? (
          <span className="hidden lg:inline text-xs text-ivory-muted font-data whitespace-nowrap">
            {currentUser.email}
          </span>
        ) : null}

        {/* Mobile Menu Toggle */}
        <button className="md:hidden ml-auto w-9 h-9 rounded-full border border-white/10 bg-white/5 text-ivory inline-flex items-center justify-center" onClick={toggleMobile}>
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
            key={link.id || link.href}
            href={link.href || '#'}
            className={`text-ivory-muted hover:text-ivory transition-colors ${isLinkActive(link) ? 'text-ivory nav-link-active' : ''}`}
            onClick={(event) => handleNavClick(event, link)}
          >
            {link.label}
          </a>
        ))}
        {handleCta ? (
          <button
            className="px-8 py-3 bg-champagne text-obsidian font-semibold rounded-full"
            onClick={() => {
              handleCta();
              closeMobile();
            }}
          >
            {resolvedCtaLabel}
          </button>
        ) : null}
        <button className="absolute top-6 right-6 text-ivory" onClick={closeMobile}>
          <X className="w-6 h-6" />
        </button>
      </div>
    </>
  );
}
