import { useState, useMemo, useEffect } from 'react';
import { getLeaderboard, USE_API } from '../services/api';

/**
 * Default leaderboard data used when the API is unavailable.
 * Demonstrates the three classical AI agents under comparison.
 */
const defaultData = [
  {
    rank: 1, name: 'Minimax', elo: 1847, winrate: 72.5,
    points: 2450, matches: 48, color: '#4A9EFF',
    description: 'Depth-limited search with alpha-beta pruning',
  },
  {
    rank: 2, name: 'MCTS', elo: 1792, winrate: 65.8,
    points: 2180, matches: 48, color: '#A855F7',
    description: 'Monte Carlo Tree Search with UCT selection',
  },
  {
    rank: 3, name: 'Fuzzy', elo: 1685, winrate: 52.1,
    points: 1720, matches: 48, color: '#4ade80',
    description: 'Fuzzy logic rule-based inference system',
  },
];

/**
 * Leaderboard section — Full Sortable Agent Ranking Table.
 */
export default function Leaderboard() {
  const [data, setData] = useState(() => JSON.parse(JSON.stringify(defaultData)));
  const [sort, setSort] = useState({ field: 'elo', asc: false });

  // Try to load from API on mount (skip if disabled)
  useEffect(() => {
    if (!USE_API) return;
    getLeaderboard().then((apiData) => {
      if (apiData && Array.isArray(apiData) && apiData.length > 0) {
        setData(apiData);
      }
    });
  }, []);

  const sortedData = useMemo(() => {
    const sorted = [...data].sort((a, b) => {
      let valA = a[sort.field];
      let valB = b[sort.field];
      if (typeof valA === 'string') {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }
      if (valA < valB) return sort.asc ? -1 : 1;
      if (valA > valB) return sort.asc ? 1 : -1;
      return 0;
    });
    return sorted.map((agent, index) => ({ ...agent, rank: index + 1 }));
  }, [data, sort]);

  const handleSort = (field) => {
    setSort((prev) => ({
      field,
      asc: prev.field === field ? !prev.asc : false,
    }));
  };

  const columns = [
    { key: 'rank', label: '#', align: 'left' },
    { key: 'name', label: 'Agent', align: 'left' },
    { key: 'elo', label: 'ELO', align: 'right' },
    { key: 'winrate', label: 'Win Rate', align: 'right' },
    { key: 'points', label: 'Points', align: 'right' },
    { key: 'matches', label: 'Matches', align: 'right' },
  ];

  const getWinrateColor = (winrate) => {
    if (winrate >= 60) return '#4ade80';
    if (winrate >= 45) return '#fbbf24';
    return '#f87171';
  };

  return (
    <section id="leaderboard" className="relative py-24 md:py-32">
      <div className="max-w-5xl mx-auto px-6">
        <div className="text-center mb-16">
          <span className="text-xs tracking-[0.3em] uppercase text-champagne font-data">Rankings</span>
          <h2 className="mt-4 text-3xl md:text-5xl font-bold">Agent Leaderboard</h2>
        </div>

        <div className="bg-obsidian-light/80 backdrop-blur-sm border border-white/5 rounded-2xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm leaderboard-table">
              <thead>
                <tr className="border-b border-white/5">
                  {columns.map((col) => (
                    <th
                      key={col.key}
                      className={`${
                        col.align === 'right' ? 'text-right' : 'text-left'
                      } px-6 py-4 text-[10px] font-data uppercase tracking-widest text-ivory-muted cursor-pointer hover:text-champagne transition-colors ${
                        sort.field === col.key ? `sort-active ${sort.asc ? 'sort-asc' : ''}` : ''
                      }`}
                      onClick={() => handleSort(col.key)}
                    >
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="leaderboard-body">
                {sortedData.map((agent) => {
                  const winrateColor = getWinrateColor(agent.winrate);
                  return (
                    <tr key={agent.name} className="border-b border-white/5">
                      <td className="px-6 py-4">
                        <span
                          className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                            agent.rank === 1
                              ? 'bg-champagne/20 text-champagne'
                              : 'bg-white/5 text-ivory-muted'
                          }`}
                        >
                          {agent.rank}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-2 h-2 rounded-full" style={{ background: agent.color }} />
                          <div>
                            <div className="font-semibold">{agent.name}</div>
                            <div className="text-[10px] text-ivory-muted font-data">{agent.description}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-data font-bold text-champagne">{agent.elo}</td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1 bg-slate rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${agent.winrate}%`, background: winrateColor }}
                            />
                          </div>
                          <span className="font-data text-xs" style={{ color: winrateColor }}>
                            {agent.winrate.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-data">{agent.points.toLocaleString()}</td>
                      <td className="px-6 py-4 text-right font-data text-ivory-muted">{agent.matches}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}
