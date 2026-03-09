import { Trophy, ScrollText, TrendingUp, Coins } from 'lucide-react';

/**
 * Dashboard section — Dashboard Preview.
 * Four preview cards: Leaderboard, Match History, Performance, Betting.
 */
export default function Dashboard() {
  return (
    <section id="history" className="relative py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-xs tracking-[0.3em] uppercase text-champagne font-data">Intelligence Hub</span>
          <h2 className="mt-4 text-3xl md:text-5xl font-bold">Dashboard Preview</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Leaderboard Card */}
          <div className="dashboard-card bg-obsidian-light/80 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-champagne/20 transition-all duration-500">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-4 h-4 text-champagne" />
              <span className="text-xs font-data uppercase tracking-widest text-ivory-muted">Leaderboard</span>
            </div>
            <div className="space-y-3">
              {[
                { rank: 1, name: 'Minimax', score: '1847', highlight: true },
                { rank: 2, name: 'MCTS', score: '1792', highlight: false },
                { rank: 3, name: 'Fuzzy', score: '1685', highlight: false },
              ].map((entry) => (
                <div key={entry.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        entry.highlight
                          ? 'bg-champagne/20 text-champagne'
                          : 'bg-white/10 text-ivory-muted'
                      }`}
                    >
                      {entry.rank}
                    </span>
                    {entry.name}
                  </span>
                  <span className={`font-data ${entry.highlight ? 'text-champagne' : 'text-ivory-muted'}`}>
                    {entry.score}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Match History Card */}
          <div className="dashboard-card bg-obsidian-light/80 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-champagne/20 transition-all duration-500">
            <div className="flex items-center gap-2 mb-4">
              <ScrollText className="w-4 h-4 text-champagne" />
              <span className="text-xs font-data uppercase tracking-widest text-ivory-muted">Match History</span>
            </div>
            <div className="space-y-3">
              {[
                { match: 'Minimax vs MCTS', score: '21-18', win: true },
                { match: 'MCTS vs Fuzzy', score: '21-15', win: true },
                { match: 'Minimax vs Fuzzy', score: '21-12', win: true },
                { match: 'MCTS vs Minimax', score: '18-21', win: false },
              ].map((entry, i) => (
                <div key={i} className="flex items-center justify-between text-xs font-data">
                  <span className="text-ivory-muted">{entry.match}</span>
                  <span className={entry.win ? 'text-green-400' : 'text-red-400'}>{entry.score}</span>
                </div>
              ))}
            </div>
          </div>

          {/* AI Performance Card */}
          <div className="dashboard-card bg-obsidian-light/80 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-champagne/20 transition-all duration-500">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-champagne" />
              <span className="text-xs font-data uppercase tracking-widest text-ivory-muted">Performance</span>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Minimax Avg Decision', value: '12ms', width: '35%' },
                { label: 'MCTS Avg Decision', value: '89ms', width: '70%' },
                { label: 'Fuzzy Avg Decision', value: '3ms', width: '15%' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-ivory-muted">{item.label}</span>
                    <span className="font-data text-champagne">{item.value}</span>
                  </div>
                  <div className="h-1 bg-slate rounded-full">
                    <div className="h-full bg-champagne/60 rounded-full" style={{ width: item.width }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Betting History Card */}
          <div className="dashboard-card bg-obsidian-light/80 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-champagne/20 transition-all duration-500">
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-4 h-4 text-champagne" />
              <span className="text-xs font-data uppercase tracking-widest text-ivory-muted">Betting</span>
            </div>
            <div className="space-y-3">
              {[
                { label: 'Bet on Minimax', value: '+250 pts', positive: true },
                { label: 'Bet on Fuzzy', value: '-100 pts', positive: false },
                { label: 'Bet on MCTS', value: '+180 pts', positive: true },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-xs">
                  <span className="text-ivory-muted">{item.label}</span>
                  <span className={`font-data ${item.positive ? 'text-green-400' : 'text-red-400'}`}>
                    {item.value}
                  </span>
                </div>
              ))}
              <div className="mt-2 pt-2 border-t border-white/5 flex justify-between text-xs font-bold">
                <span>Balance</span>
                <span className="font-data text-champagne">2,330 pts</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
