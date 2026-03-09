import { ExternalLink } from 'lucide-react';

/**
 * Footer component.
 * Brand, system status indicator, platform links, and project links.
 */
export default function Footer({ isOnline }) {
  return (
    <footer className="relative mt-12 bg-obsidian-light rounded-t-4xl border-t border-white/5">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
          {/* Brand */}
          <div className="md:col-span-2">
            <a href="#" className="text-2xl font-bold">
              Smart<span className="text-champagne">Smash</span>
            </a>
            <p className="mt-3 text-sm text-ivory-muted max-w-sm">
              Classical AI Competition Arena. Where interpretable intelligence meets precision gameplay.
            </p>
            {/* System Status */}
            <div className="mt-6 flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-full animate-pulse-slow"
                style={{ backgroundColor: isOnline ? '#4ade80' : '#fbbf24' }}
              />
              <span className="text-xs font-data text-ivory-muted">
                {isOnline ? 'System Operational' : 'Demo Mode'}
              </span>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-xs font-data uppercase tracking-widest text-ivory-muted mb-4">Platform</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="#game-arena" className="text-ivory-muted hover:text-ivory transition-colors">Arena</a>
              </li>
              <li>
                <a href="#leaderboard" className="text-ivory-muted hover:text-ivory transition-colors">Leaderboard</a>
              </li>
              <li>
                <a href="#" className="text-ivory-muted hover:text-ivory transition-colors">Documentation</a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-data uppercase tracking-widest text-ivory-muted mb-4">Project</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a
                  href="https://github.com/Rockstatata/Smartsmash"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ivory-muted hover:text-ivory transition-colors flex items-center gap-1"
                >
                  GitHub <ExternalLink className="w-3 h-3" />
                </a>
              </li>
              <li>
                <a href="#" className="text-ivory-muted hover:text-ivory transition-colors">
                  CSE 3209 — AI
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-xs text-ivory-muted">&copy; 2026 SmartSmash. Classical AI Competition Arena.</p>
          <p className="text-xs text-ivory-muted font-data">Built for CSE 3209 — Artificial Intelligence</p>
        </div>
      </div>
    </footer>
  );
}
