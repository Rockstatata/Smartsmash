import { useState, useEffect, useCallback } from 'react';

import Navbar from './components/Navbar';
import Hero from './components/Hero';
import Features from './components/Features';
import Philosophy from './components/Philosophy';
import Protocol from './components/Protocol';
import Modes from './components/Modes';
import Dashboard from './components/Dashboard';
import GameArena from './components/GameArena';
import Leaderboard from './components/Leaderboard';
import Footer from './components/Footer';
import AuthModal from './components/AuthModal';

import useAnimations from './hooks/useAnimations';
import { healthCheck, USE_API } from './services/api';

/**
 * SmartSmash — Root Application Component
 * Orchestrates all sections, manages global state (auth modal, backend status),
 * initialises GSAP animations, and handles smooth scroll + keyboard shortcuts.
 */
export default function App() {
  const [authOpen, setAuthOpen] = useState(false);
  const [isOnline, setIsOnline] = useState(false);

  /* ─── Boot Sequence ──────────────────────────────────── */
  useEffect(() => {
    console.log(
      '%c SmartSmash Arena %c v1.0 ',
      'background: #C9A84C; color: #0D0D12; font-weight: bold; padding: 4px 8px; border-radius: 4px 0 0 4px;',
      'background: #2A2A35; color: #FAF8F5; padding: 4px 8px; border-radius: 0 4px 4px 0;',
    );

    // Backend health check (skip if API disabled)
    if (!USE_API) {
      setIsOnline(false);
      console.log('[SmartSmash] API disabled — running in demo mode.');
    } else {
      healthCheck()
        .then((healthy) => {
          setIsOnline(healthy);
          if (healthy) {
            console.log('[SmartSmash] Backend connected.');
          } else {
            console.log('[SmartSmash] Backend offline — running in demo mode.');
          }
        })
        .catch(() => {
          setIsOnline(false);
          console.log('[SmartSmash] Backend unreachable — demo mode.');
        });
    }

    console.log('[SmartSmash] All modules initialized.');
  }, []);

  /* ─── GSAP ScrollTrigger Animations ──────────────────── */
  useAnimations();

  /* ─── Smooth Scroll for Anchor Links ─────────────────── */
  useEffect(() => {
    const handler = (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const targetId = link.getAttribute('href');
      if (targetId === '#') return;
      const target = document.querySelector(targetId);
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  /* ─── Auth Modal Helpers ─────────────────────────────── */
  const openAuth = useCallback(() => setAuthOpen(true), []);
  const closeAuth = useCallback(() => setAuthOpen(false), []);

  /* ─── Render ─────────────────────────────────────────── */
  return (
    <>
      <Navbar onOpenAuth={openAuth} />

      <main>
        <Hero onOpenAuth={openAuth} />
        <Features />
        <Philosophy />
        <Protocol />
        <Modes onOpenAuth={openAuth} />
        <Dashboard />
        <GameArena />
        <Leaderboard />
      </main>

      <Footer isOnline={isOnline} />

      <AuthModal isOpen={authOpen} onClose={closeAuth} />
    </>
  );
}
