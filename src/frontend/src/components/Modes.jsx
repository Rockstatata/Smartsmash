import { Eye, Swords, BarChart3, Check } from 'lucide-react';

/**
 * Modes section — Competition Modes.
 * Three mode cards: Spectator, Competitor (highlighted), Analyst.
 */
export default function Modes() {
  const modes = [
    {
      icon: Eye,
      iconContainerClass: 'bg-slate',
      iconClass: 'text-ivory-muted',
      title: 'Spectator',
      subtitle: 'Observe and analyze',
      subtitleClass: 'text-ivory-muted',
      features: ['Watch AI vs AI', 'Bet on outcomes', 'Analyze metrics'],
      btnClass: 'border border-white/10 rounded-full text-sm font-medium hover:bg-white/5 transition-all duration-300',
      btnText: 'Enter as Spectator',
      cardClass:
        'mode-card relative bg-obsidian border border-white/5 rounded-2xl p-5 sm:p-6 md:p-8 hover:border-white/10 transition-all duration-500',
      badge: null,
    },
    {
      icon: Swords,
      iconContainerClass: 'bg-champagne/10',
      iconClass: 'text-champagne',
      title: 'Competitor',
      subtitle: 'Challenge the agents',
      subtitleClass: 'text-champagne',
      features: ['Play vs AI', 'Adjust strategy', 'Track performance'],
      btnClass:
        'bg-champagne text-obsidian font-bold rounded-full text-sm hover:bg-champagne-dark transition-all duration-300',
      btnText: 'Enter as Competitor',
      cardClass:
        'mode-card relative bg-obsidian border-2 border-champagne/40 rounded-2xl p-5 sm:p-6 md:p-8 ring-1 ring-champagne/10 shadow-[0_0_60px_rgba(201,168,76,0.08)] transform md:-translate-y-4 transition-all duration-500',
      badge: 'Recommended',
    },
    {
      icon: BarChart3,
      iconContainerClass: 'bg-slate',
      iconClass: 'text-ivory-muted',
      title: 'Analyst',
      subtitle: 'Deep dive into data',
      subtitleClass: 'text-ivory-muted',
      features: ['Compare agents', 'Access match logs', 'Tournament simulation'],
      btnClass: 'border border-white/10 rounded-full text-sm font-medium hover:bg-white/5 transition-all duration-300',
      btnText: 'Enter as Analyst',
      cardClass:
        'mode-card relative bg-obsidian border border-white/5 rounded-2xl p-5 sm:p-6 md:p-8 hover:border-white/10 transition-all duration-500',
      badge: null,
    },
  ];

  return (
    <section id="modes" className="relative py-20 sm:py-24 md:py-32 bg-obsidian-light/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12 sm:mb-16">
          <span className="text-xs tracking-[0.3em] uppercase text-champagne font-data">Access</span>
          <h2 className="mt-4 text-2xl sm:text-3xl md:text-5xl font-bold">Choose Your Mode</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 max-w-5xl mx-auto">
          {modes.map((mode) => {
            const Icon = mode.icon;
            return (
              <div key={mode.title} className={mode.cardClass}>
                {mode.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 bg-champagne text-obsidian text-[10px] font-bold tracking-widest uppercase rounded-full">
                    {mode.badge}
                  </div>
                )}
                <div className={`w-10 h-10 rounded-lg ${mode.iconContainerClass} flex items-center justify-center mb-6`}>
                  <Icon className={`w-5 h-5 ${mode.iconClass}`} />
                </div>
                <h3 className="text-xl font-bold">{mode.title}</h3>
                <p className={`mt-2 text-sm ${mode.subtitleClass}`}>{mode.subtitle}</p>
                <ul className="mt-6 space-y-3 text-sm text-ivory-muted">
                  {mode.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <Check className="w-4 h-4 text-champagne" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <button className={`mt-8 w-full py-3 ${mode.btnClass}`}>{mode.btnText}</button>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
