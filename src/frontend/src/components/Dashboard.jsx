import { useEffect, useMemo, useState } from 'react';
import { Trophy, ScrollText, TrendingUp, Coins } from 'lucide-react';
import { getLeaderboard, getMatchHistory, USE_API } from '../services/api';

export default function Dashboard() {
  const [leaderboard, setLeaderboard] = useState([]);
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(USE_API);
  const [loadError, setLoadError] = useState(
    USE_API ? null : 'API is disabled. Enable backend connectivity to load live metrics.',
  );

  useEffect(() => {
    if (!USE_API) return;

    Promise.all([getLeaderboard(), getMatchHistory(4)])
      .then(([leaderboardData, historyData]) => {
        setLoadError(null);
        if (Array.isArray(leaderboardData) && leaderboardData.length > 0) {
          const compact = leaderboardData.slice(0, 3).map((entry, index) => ({
            rank: index + 1,
            name: entry.name,
            elo: entry.elo,
          }));
          setLeaderboard(compact);
        } else {
          setLeaderboard([]);
        }

        if (Array.isArray(historyData) && historyData.length > 0) {
          setHistory(historyData);
        } else {
          setHistory([]);
        }
      })
      .catch((error) => {
        setLoadError(error?.message || 'Failed to load dashboard data.');
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const averageElo = useMemo(() => {
    if (leaderboard.length === 0) return 0;
    return Math.round(leaderboard.reduce((sum, row) => sum + Number(row.elo || 0), 0) / leaderboard.length);
  }, [leaderboard]);

  const totalMatches = useMemo(() => {
    return history.length;
  }, [history]);

  return (
    <section id="history" className="relative py-20 sm:py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-12 sm:mb-16">
          <span className="text-xs tracking-[0.3em] uppercase text-champagne font-data">Intelligence Hub</span>
          <h2 className="mt-4 text-2xl sm:text-3xl md:text-5xl font-bold">Dashboard Preview</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="dashboard-card bg-obsidian-light/80 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-champagne/20 transition-all duration-500">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-4 h-4 text-champagne" />
              <span className="text-xs font-data uppercase tracking-widest text-ivory-muted">Leaderboard</span>
            </div>
          <div className="space-y-3">
              {isLoading ? <p className="text-xs text-ivory-muted">Loading leaderboard…</p> : null}
              {!isLoading && leaderboard.length === 0 ? (
                <p className="text-xs text-ivory-muted">No leaderboard data available yet.</p>
              ) : null}
              {leaderboard.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span
                      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                        entry.rank === 1
                          ? 'bg-champagne/20 text-champagne'
                          : 'bg-white/10 text-ivory-muted'
                      }`}
                    >
                      {entry.rank}
                    </span>
                    {entry.name}
                  </span>
                  <span className={`font-data ${entry.rank === 1 ? 'text-champagne' : 'text-ivory-muted'}`}>
                    {entry.elo}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="dashboard-card bg-obsidian-light/80 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-champagne/20 transition-all duration-500">
            <div className="flex items-center gap-2 mb-4">
              <ScrollText className="w-4 h-4 text-champagne" />
              <span className="text-xs font-data uppercase tracking-widest text-ivory-muted">Match History</span>
            </div>
            <div className="space-y-3">
              {isLoading ? <p className="text-xs text-ivory-muted">Loading match history…</p> : null}
              {!isLoading && history.length === 0 ? (
                <p className="text-xs text-ivory-muted">No recorded matches available yet.</p>
              ) : null}
              {history.slice(0, 4).map((entry, i) => {
                const p1 = entry?.score?.p1 ?? 0;
                const p2 = entry?.score?.p2 ?? 0;
                return (
                  <div key={entry.id || i} className="flex items-center justify-between text-xs font-data">
                    <span className="text-ivory-muted">{entry.agent1} vs {entry.agent2}</span>
                    <span className={p1 >= p2 ? 'text-green-400' : 'text-red-400'}>{p1}-{p2}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="dashboard-card bg-obsidian-light/80 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-champagne/20 transition-all duration-500">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-champagne" />
              <span className="text-xs font-data uppercase tracking-widest text-ivory-muted">Performance</span>
            </div>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-ivory-muted">Average ELO</span>
                  <span className="font-data text-champagne">{averageElo}</span>
                </div>
                <div className="h-1 bg-slate rounded-full">
                  <div className="h-full bg-champagne/60 rounded-full" style={{ width: `${Math.min(100, averageElo / 20)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-ivory-muted">Tracked Matches</span>
                  <span className="font-data text-champagne">{totalMatches}</span>
                </div>
                <div className="h-1 bg-slate rounded-full">
                  <div className="h-full bg-champagne/60 rounded-full" style={{ width: `${Math.min(100, totalMatches * 12)}%` }} />
                </div>
              </div>
            </div>
          </div>

          <div className="dashboard-card bg-obsidian-light/80 backdrop-blur-sm border border-white/5 rounded-2xl p-6 hover:border-champagne/20 transition-all duration-500">
            <div className="flex items-center gap-2 mb-4">
              <Coins className="w-4 h-4 text-champagne" />
              <span className="text-xs font-data uppercase tracking-widest text-ivory-muted">Betting</span>
            </div>
            <p className="text-xs text-ivory-muted">
              Betting ledger is not connected to a backend feed yet.
            </p>
          </div>
        </div>
        {loadError ? (
          <p className="mt-5 text-xs text-amber-300/90 font-data">{loadError}</p>
        ) : null}
      </div>
    </section>
  );
}
