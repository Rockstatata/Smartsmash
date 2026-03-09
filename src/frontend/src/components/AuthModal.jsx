import { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import gsap from 'gsap';
import { showNotification } from '../utils/notifications';

/**
 * Auth Modal component.
 * Sign In / Sign Up tabs with animated open/close via GSAP,
 * matching the original modal behavior exactly.
 */
export default function AuthModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('signin');
  const modalContentRef = useRef(null);

  // Animate in on open
  useEffect(() => {
    if (isOpen && modalContentRef.current) {
      gsap.fromTo(
        modalContentRef.current,
        { opacity: 0, scale: 0.95, y: 20 },
        { opacity: 1, scale: 1, y: 0, duration: 0.4, ease: 'power3.out' },
      );
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    if (modalContentRef.current) {
      gsap.to(modalContentRef.current, {
        opacity: 0, scale: 0.95, y: 20, duration: 0.25, ease: 'power3.in',
        onComplete: onClose,
      });
    } else {
      onClose();
    }
  }, [onClose]);

  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && isOpen) handleClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  const handleSignIn = (e) => {
    e.preventDefault();
    const email = e.target.querySelector('input[type="email"]').value;
    console.log('[Auth] Sign in attempt:', email);

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Entering...';
    btn.disabled = true;

    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
      handleClose();
      showNotification('Welcome to the Arena!', 'success');
    }, 1500);
  };

  const handleSignUp = (e) => {
    e.preventDefault();
    const email = e.target.querySelectorAll('input[type="email"]')[0].value;
    console.log('[Auth] Sign up attempt:', email);

    const btn = e.target.querySelector('button[type="submit"]');
    const originalText = btn.textContent;
    btn.textContent = 'Creating...';
    btn.disabled = true;

    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
      handleClose();
      showNotification('Account created. Welcome!', 'success');
    }, 1500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-obsidian/80 backdrop-blur-sm" onClick={handleClose} />

      {/* Modal Content */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md">
        <div
          ref={modalContentRef}
          className="bg-obsidian-light border border-white/10 rounded-2xl p-8 shadow-2xl mx-4"
        >
          {/* Close button */}
          <button
            className="absolute top-4 right-4 text-ivory-muted hover:text-ivory transition-colors"
            onClick={handleClose}
          >
            <X className="w-5 h-5" />
          </button>

          {/* Tabs */}
          <div className="flex gap-6 mb-8">
            <button
              className={`auth-tab text-lg font-bold border-b-2 pb-1 hover:text-ivory transition-colors ${
                activeTab === 'signin'
                  ? 'active text-ivory border-champagne'
                  : 'text-ivory-muted border-transparent'
              }`}
              onClick={() => setActiveTab('signin')}
            >
              Sign In
            </button>
            <button
              className={`auth-tab text-lg font-bold border-b-2 pb-1 hover:text-ivory transition-colors ${
                activeTab === 'signup'
                  ? 'active text-ivory border-champagne'
                  : 'text-ivory-muted border-transparent'
              }`}
              onClick={() => setActiveTab('signup')}
            >
              Sign Up
            </button>
          </div>

          {/* Sign In Form */}
          {activeTab === 'signin' && (
            <form className="space-y-4" onSubmit={handleSignIn}>
              <div>
                <label className="block text-xs font-data uppercase tracking-widest text-ivory-muted mb-2">
                  Email
                </label>
                <input
                  type="email"
                  className="auth-input w-full px-4 py-3 bg-obsidian border border-white/10 rounded-xl text-ivory text-sm focus:border-champagne/40 focus:outline-none transition-colors"
                  placeholder="agent@smartsmash.ai"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-data uppercase tracking-widest text-ivory-muted mb-2">
                  Password
                </label>
                <input
                  type="password"
                  className="auth-input w-full px-4 py-3 bg-obsidian border border-white/10 rounded-xl text-ivory text-sm focus:border-champagne/40 focus:outline-none transition-colors"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-champagne text-obsidian font-bold rounded-xl hover:bg-champagne-dark transition-all duration-300"
              >
                Enter the Arena
              </button>
            </form>
          )}

          {/* Sign Up Form */}
          {activeTab === 'signup' && (
            <form className="space-y-4" onSubmit={handleSignUp}>
              <div>
                <label className="block text-xs font-data uppercase tracking-widest text-ivory-muted mb-2">
                  Username
                </label>
                <input
                  type="text"
                  className="auth-input w-full px-4 py-3 bg-obsidian border border-white/10 rounded-xl text-ivory text-sm focus:border-champagne/40 focus:outline-none transition-colors"
                  placeholder="champion_01"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-data uppercase tracking-widest text-ivory-muted mb-2">
                  Email
                </label>
                <input
                  type="email"
                  className="auth-input w-full px-4 py-3 bg-obsidian border border-white/10 rounded-xl text-ivory text-sm focus:border-champagne/40 focus:outline-none transition-colors"
                  placeholder="agent@smartsmash.ai"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-data uppercase tracking-widest text-ivory-muted mb-2">
                  Password
                </label>
                <input
                  type="password"
                  className="auth-input w-full px-4 py-3 bg-obsidian border border-white/10 rounded-xl text-ivory text-sm focus:border-champagne/40 focus:outline-none transition-colors"
                  placeholder="••••••••"
                  required
                />
              </div>
              <button
                type="submit"
                className="w-full py-3 bg-champagne text-obsidian font-bold rounded-xl hover:bg-champagne-dark transition-all duration-300"
              >
                Create Account
              </button>
            </form>
          )}

          <p className="mt-6 text-center text-xs text-ivory-muted">
            By entering, you agree to the arena protocols.
          </p>
        </div>
      </div>
    </div>
  );
}

