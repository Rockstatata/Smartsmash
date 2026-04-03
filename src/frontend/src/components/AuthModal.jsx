import { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';
import gsap from 'gsap';
import { showNotification } from '../utils/notifications';
import { signIn, signUp } from '../services/api';

/**
 * Auth Modal component.
 * Sign In / Sign Up tabs with animated open/close via GSAP.
 */
export default function AuthModal({ isOpen, onClose, onAuthSuccess }) {
  const [activeTab, setActiveTab] = useState('signin');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const modalContentRef = useRef(null);

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
        opacity: 0,
        scale: 0.95,
        y: 20,
        duration: 0.25,
        ease: 'power3.in',
        onComplete: onClose,
      });
    } else {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape' && isOpen) handleClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, handleClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleSignIn = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || '');
    const password = String(form.get('password') || '');

    setIsSubmitting(true);
    try {
      const data = await signIn(email, password);
      if (data?.user) onAuthSuccess?.(data.user);
      showNotification('Welcome to the Arena!', 'success');
      handleClose();
    } catch (error) {
      showNotification(error.message || 'Sign in failed.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSignUp = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const form = new FormData(e.currentTarget);
    const username = String(form.get('username') || '');
    const email = String(form.get('email') || '');
    const password = String(form.get('password') || '');

    setIsSubmitting(true);
    try {
      const data = await signUp(email, password, username);
      if (data?.user) onAuthSuccess?.(data.user);

      if (data?.email_confirmation_required) {
        showNotification('Account created. Please verify your email to continue.', 'success');
      } else {
        showNotification('Account created. Welcome!', 'success');
      }

      handleClose();
    } catch (error) {
      showNotification(error.message || 'Sign up failed.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-60">
      <div className="absolute inset-0 bg-obsidian/80 backdrop-blur-sm" onClick={handleClose} />

      <div className="absolute inset-0 grid place-items-center p-3 sm:p-4">
        <div
          ref={modalContentRef}
          className="relative w-full max-w-md max-h-[calc(100svh-1.5rem)] overflow-y-auto bg-obsidian-light border border-white/10 rounded-2xl p-5 sm:p-8 shadow-2xl"
        >
          <button
            className="absolute top-4 right-4 text-ivory-muted hover:text-ivory transition-colors"
            onClick={handleClose}
          >
            <X className="w-5 h-5" />
          </button>

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

          {activeTab === 'signin' && (
            <form className="space-y-4" onSubmit={handleSignIn}>
              <div>
                <label className="block text-xs font-data uppercase tracking-widest text-ivory-muted mb-2">
                  Email
                </label>
                <input
                  type="email"
                  name="email"
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
                  name="password"
                  className="auth-input w-full px-4 py-3 bg-obsidian border border-white/10 rounded-xl text-ivory text-sm focus:border-champagne/40 focus:outline-none transition-colors"
                  placeholder="********"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-champagne text-obsidian font-bold rounded-xl hover:bg-champagne-dark transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Entering...' : 'Enter the Arena'}
              </button>
            </form>
          )}

          {activeTab === 'signup' && (
            <form className="space-y-4" onSubmit={handleSignUp}>
              <div>
                <label className="block text-xs font-data uppercase tracking-widest text-ivory-muted mb-2">
                  Username
                </label>
                <input
                  type="text"
                  name="username"
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
                  name="email"
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
                  name="password"
                  className="auth-input w-full px-4 py-3 bg-obsidian border border-white/10 rounded-xl text-ivory text-sm focus:border-champagne/40 focus:outline-none transition-colors"
                  placeholder="********"
                  required
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 bg-champagne text-obsidian font-bold rounded-xl hover:bg-champagne-dark transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Creating...' : 'Create Account'}
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
