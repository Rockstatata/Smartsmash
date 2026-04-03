import { ArrowRight, Play } from 'lucide-react';

/**
 * Hero section — The Opening Shot.
 * Full-viewport hero with animated headline, subtitle,
 * CTA buttons, and scroll indicator.
 */
export default function Hero({ onOpenAuth }) {
  return (
    <section id="hero" className="hero-section relative min-h-svh flex flex-col items-center justify-center isolate pt-16 sm:pt-20">
      {/* Background Image + Overlay */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1920&q=80"
          alt="Badminton arena"
          className="w-full h-full object-cover opacity-30"
          loading="eager"
        />
        <div className="absolute inset-0 bg-linear-to-b from-obsidian/70 via-obsidian/50 to-obsidian" />
      </div>

      {/* Hero Content */}
      <div className="relative z-10 text-center px-4 sm:px-6 max-w-4xl">
        <h1 className="hero-title">
          <span
            className="block text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-ivory opacity-0"
            id="hero-line1"
          >
            Intelligence meets
          </span>
          <span
            className="block text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-drama italic text-champagne mt-2 opacity-0"
            id="hero-line2"
          >
            Precision.
          </span>
        </h1>

        <p className="mt-6 sm:mt-8 text-base sm:text-lg md:text-xl text-ivory-muted font-light tracking-wide opacity-0" id="hero-sub">
          Simulate. Compete. Coach. Analyze.
        </p>

        <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 opacity-0" id="hero-ctas">
          <button
            className="group w-full sm:w-auto px-7 sm:px-8 py-3.5 sm:py-4 bg-champagne text-obsidian font-bold text-sm rounded-full hover:bg-champagne-dark transition-all duration-300 flex items-center justify-center gap-2"
            onClick={onOpenAuth}
          >
            Enter the Arena
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <a
            href="#game-arena"
            className="w-full sm:w-auto px-7 sm:px-8 py-3.5 sm:py-4 border border-white/10 text-ivory text-sm font-medium rounded-full hover:bg-white/5 transition-all duration-300 flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            Watch AI Battle
          </a>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 z-10 flex flex-col items-center gap-2 opacity-0" id="scroll-indicator">
        <span className="text-xs text-ivory-muted tracking-widest uppercase">Scroll</span>
        <div className="w-px h-8 bg-linear-to-b from-champagne to-transparent" />
      </div>
    </section>
  );
}
