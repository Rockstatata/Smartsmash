import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

/**
 * Custom hook that encapsulates all GSAP ScrollTrigger and
 * entry animations, matching the original animations.js behavior.
 */
export default function useAnimations() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const has = (selector) => document.querySelector(selector);
    const hasAll = (selectors) => selectors.every((selector) => has(selector));

    // ─── Hero Entrance Animation ──────────────────────────
    if (hasAll(['#hero-line1', '#hero-line2', '#hero-sub', '#hero-ctas'])) {
      const heroTimeline = gsap.timeline({ defaults: { ease: 'power3.out' } });
      gsap.set(['#hero-line1', '#hero-line2', '#hero-sub', '#hero-ctas'], { y: 30 });
      if (has('#scroll-indicator')) gsap.set('#scroll-indicator', { y: 10 });

      heroTimeline
        .to('#hero-line1', { opacity: 1, y: 0, duration: 1, delay: 0.3 })
        .to('#hero-line2', { opacity: 1, y: 0, duration: 1 }, '-=0.5')
        .to('#hero-sub', { opacity: 1, y: 0, duration: 0.8 }, '-=0.4')
        .to('#hero-ctas', { opacity: 1, y: 0, duration: 0.8 }, '-=0.3');

      if (has('#scroll-indicator')) {
        heroTimeline.to('#scroll-indicator', { opacity: 0.6, y: 0, duration: 0.6 }, '-=0.2');
      }
    }

    // ─── Navbar Scroll Morph ──────────────────────────────
    ScrollTrigger.create({
      start: 'top -80',
      onUpdate(self) {
        const navbar = document.getElementById('navbar');
        if (!navbar) return;
        if (self.direction === 1 && self.scroll() > 80) navbar.classList.add('scrolled');
        else if (self.scroll() <= 80) navbar.classList.remove('scrolled');
      },
    });

    // Hide scroll indicator on scroll
    if (has('#hero') && has('#scroll-indicator')) {
      ScrollTrigger.create({
        trigger: '#hero',
        start: 'top top',
        end: 'bottom center',
        onLeave() { gsap.to('#scroll-indicator', { opacity: 0, duration: 0.3 }); },
        onEnterBack() { gsap.to('#scroll-indicator', { opacity: 0.6, duration: 0.3 }); },
      });
    }

    // ─── Feature Section Header ───────────────────────────
    if (has('.feature-header')) {
      gsap.from('.feature-header', {
        scrollTrigger: { trigger: '.feature-header', start: 'top 85%', toggleActions: 'play none none reverse' },
        opacity: 0, y: 40, duration: 0.8, ease: 'power3.out',
      });
    }

    // ─── Feature Cards Stagger ────────────────────────────
    if (has('.feature-card')) {
      gsap.from('.feature-card', {
        scrollTrigger: { trigger: '.feature-card', start: 'top 85%', toggleActions: 'play none none reverse' },
        opacity: 100, y: 50, stagger: 0.15, duration: 0.8, ease: 'power3.out',
      });
    }

    // ─── Philosophy Section ───────────────────────────────
    if (has('#philosophy') && has('.philosophy-text')) {
      gsap.from('.philosophy-text', {
        scrollTrigger: { trigger: '#philosophy', start: 'top 75%', toggleActions: 'play none none reverse' },
        opacity:100, y: 40, duration: 1, ease: 'power3.out',
      });
    }

    if (has('#philosophy') && has('.philosophy-highlight')) {
      gsap.from('.philosophy-highlight', {
        scrollTrigger: { trigger: '#philosophy', start: 'top 70%', toggleActions: 'play none none reverse' },
        textShadow: '0 0 0px rgba(201,168,76,0)',
        opacity:100,
        duration: 1.5,
        ease: 'power2.out',
        onComplete() {
          gsap.to('.philosophy-highlight', {
            textShadow: '0 0 30px rgba(201,168,76,0.3)',
            duration: 2, repeat: -1, yoyo: true, ease: 'sine.inOut',
          });
        },
      });
    }

    // ─── Protocol Cards ───────────────────────────────────
    if (has('#protocol') && has('.protocol-card')) {
      gsap.from('.protocol-card', {
        scrollTrigger: { trigger: '#protocol', start: 'top 80%', toggleActions: 'play none none reverse' },
        opacity:100, y: 60, stagger: 0.2, duration: 0.8, ease: 'power3.out',
      });
    }

    // ─── Mode Cards ───────────────────────────────────────
    if (has('#modes') && has('.mode-card')) {
      gsap.from('.mode-card', {
        scrollTrigger: { trigger: '#modes', start: 'top 80%', toggleActions: 'play none none reverse' },
        opacity: 100, y: 50, stagger: 0.15, duration: 0.8, ease: 'power3.out',
      });
    }

    // ─── Dashboard Cards ──────────────────────────────────
    if (has('#history') && has('.dashboard-card')) {
      gsap.from('.dashboard-card', {
        scrollTrigger: { trigger: '#history', start: 'top 80%', toggleActions: 'play none none reverse' },
        opacity: 100, y: 40, scale: 0.95, stagger: 0.1, duration: 0.6, ease: 'power3.out',
      });
    }

    // ─── Game Arena Section ───────────────────────────────
    if (has('#game-arena')) {
      gsap.from('#game-arena > div', {
        scrollTrigger: { trigger: '#game-arena', start: 'top 80%', toggleActions: 'play none none reverse' },
        opacity: 100, y: 40, duration: 1, ease: 'power3.out',
      });
    }

    // ─── Leaderboard Section ──────────────────────────────
    if (has('#leaderboard') && has('.leaderboard-table')) {
      gsap.from('.leaderboard-table', {
        scrollTrigger: { trigger: '#leaderboard', start: 'top 80%', toggleActions: 'play none none reverse' },
        opacity: 0, y: 30, duration: 0.8, ease: 'power3.out',
      });
    }

    return () => {
      ScrollTrigger.getAll().forEach((trigger) => trigger.kill());
    };
  }, []);
}
