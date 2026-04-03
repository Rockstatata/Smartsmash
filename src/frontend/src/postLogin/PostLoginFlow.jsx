
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BrainCircuit,
  ChevronLeft,
  ChevronRight,
  Gauge,
  Pause,
  Play,
  ShieldCheck,
  Shield,
  Sparkles,
  Swords,
  Target,
  Trophy,
  UserRound,
  Zap,
} from 'lucide-react';

import GameArena from '../components/GameArena';
import Navbar from '../components/Navbar';
import { getAgents, getLeaderboard, getMatchHistory, USE_API } from '../services/api';
import { showNotification } from '../utils/notifications';
import {
  ABILITY_OPTIONS,
  ARENA_OPTIONS,
  cloneDefaultSetup,
  FLOW_ORDER,
  FLOW_LABELS,
  LOADER_STEPS,
  MODE_OPTIONS,
  resolveDisplayName,
} from './flowConfig';

function findFlowIndex(screen) {
  return FLOW_ORDER.indexOf(screen);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function formatAbilityLabel(abilityId) {
  const ability = ABILITY_OPTIONS.find((item) => item.id === abilityId);
  return ability ? ability.title : 'No Ability';
}

function getAgentMeta(agents, type) {
  return agents.find((agent) => agent.type === type) || null;
}

const HUMAN_AGENT = {
  name: 'Human',
  type: 'human',
  description: 'Manual control with keyboard input only. No AI auto-shot assistance.',
  algorithm: 'Manual Input',
  config: {},
  color: '#22d3ee',
};

function toPercent(value, max) {
  if (max <= 0) return 0;
  return clamp(Math.round((value / max) * 100), 0, 100);
}

function FlowTopBar({ currentUser, onSignOut, screen, progressIndex, onScreenSelect }) {
  const displayName = resolveDisplayName(currentUser);
  const navLinks = [
    { id: 'home', href: '#home', label: 'Home' },
    { id: 'mode', href: '#mode', label: 'Setup' },
    { id: 'arena', href: '#arena', label: 'Arena' },
    { id: 'analytics', href: '#analytics', label: 'Analytics' },
  ];

  return (
    <>
      <Navbar
        currentUser={currentUser}
        onSignOut={onSignOut}
        navLinks={navLinks}
        activeLink={screen}
        onNavSelect={(link) => onScreenSelect(link.id)}
        ctaLabel="Sign Out"
        onCtaClick={onSignOut}
        showUserEmail={false}
      />

      <div className="pt-20 sm:pt-24 px-4 sm:px-5">
        <div className="max-w-7xl mx-auto rounded-2xl border border-white/10 bg-obsidian-light/55 backdrop-blur-md px-4 sm:px-5 py-3 sm:py-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-ivory-muted font-data">Control Room</p>
            <p className="text-sm sm:text-base text-ivory mt-1 wrap-break-word">
              Logged in as <span className="text-champagne font-data">{displayName}</span>
            </p>
          </div>

          <div className="inline-flex w-full sm:w-auto justify-center sm:justify-start items-center gap-2 rounded-full border border-white/10 bg-obsidian/60 px-4 py-2">
            <ShieldCheck className="w-4 h-4 text-champagne" />
            <span className="text-xs uppercase tracking-[0.18em] font-data text-ivory-muted">
              {FLOW_LABELS[screen] || screen}
            </span>
            <span className="text-xs font-data text-champagne">
              {progressIndex + 1}/{FLOW_ORDER.length}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}

function FlowStepper({ screen }) {
  const index = findFlowIndex(screen);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-5 pt-3 sm:pt-4 pb-6 sm:pb-8">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {FLOW_ORDER.map((item, i) => {
          const active = i === index;
          const done = i < index;
          return (
            <div
              key={item}
              className={`min-w-32 flex-none rounded-lg px-2.5 py-2.5 border text-xs uppercase tracking-[0.16em] font-data text-center transition-all ${
                active
                  ? 'border-champagne/50 bg-champagne/10 text-champagne'
                  : done
                    ? 'border-green-500/30 bg-green-500/10 text-green-300'
                    : 'border-white/10 bg-obsidian-light/60 text-ivory-muted'
              }`}
            >
              {FLOW_LABELS[item] || item}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Panel({ title, subtitle, right, children }) {
  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-5 pb-8 sm:pb-12">
      <div className="rounded-2xl border border-white/10 bg-obsidian-light/68 backdrop-blur-md overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="px-4 sm:px-6 md:px-8 py-5 sm:py-6 border-b border-white/5 flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <p className="text-[11px] uppercase tracking-[0.22em] text-champagne font-data">Session Stage</p>
            <h2 className="mt-2 text-2xl sm:text-3xl md:text-4xl font-bold leading-tight">{title}</h2>
            {subtitle ? <p className="mt-2 text-base text-ivory-muted max-w-3xl">{subtitle}</p> : null}
          </div>
          {right ? <div className="w-full xl:w-auto xl:shrink-0">{right}</div> : null}
        </div>
        <div className="p-4 sm:p-6 md:p-8">{children}</div>
      </div>
    </section>
  );
}

function HomeDashboardScreen({ displayName, leaderboard, history, onStart, lastResult, onGoAnalytics }) {
  const top = leaderboard[0];
  const averageElo = useMemo(() => {
    if (leaderboard.length === 0) return 0;
    return Math.round(leaderboard.reduce((sum, row) => sum + Number(row.elo || 0), 0) / leaderboard.length);
  }, [leaderboard]);

  return (
    <Panel
      title={`Welcome back, ${displayName}`}
      subtitle="Home Dashboard"
      right={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onStart}
            className="px-4 py-2.5 rounded-lg bg-champagne text-obsidian font-semibold text-sm hover:bg-champagne-dark transition-colors w-full sm:w-auto"
          >
            Start Match Setup
          </button>
          <button
            onClick={onGoAnalytics}
            disabled={!lastResult}
            className="px-4 py-2.5 rounded-lg border border-white/15 text-sm hover:border-champagne/40 disabled:opacity-40 w-full sm:w-auto"
          >
            Last Analytics
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard icon={Trophy} label="Top Agent" value={top?.name || 'N/A'} extra={top ? `ELO ${top.elo}` : 'offline'} />
        <StatCard icon={Gauge} label="Average ELO" value={String(averageElo)} extra={`${leaderboard.length} agents`} />
        <StatCard icon={Swords} label="Recent Matches" value={String(history.length)} extra="Latest history feed" />
        <StatCard
          icon={BrainCircuit}
          label="Last Winner"
          value={lastResult?.winnerName || 'No match yet'}
          extra={lastResult ? `${lastResult.score.p1}-${lastResult.score.p2}` : 'run a match'}
        />
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-obsidian/70 p-5 md:p-6">
          <h3 className="text-xs uppercase tracking-[0.18em] text-ivory-muted font-data mb-4">Leaderboard Snapshot</h3>
          <div className="space-y-2">
            {leaderboard.slice(0, 5).map((row, idx) => (
              <div key={`${row.name}-${idx}`} className="flex items-center justify-between rounded-lg px-4 py-3 bg-white/3 border border-white/5">
                <span className="text-base pr-2 truncate">{idx + 1}. {row.name}</span>
                <span className="text-base font-data text-champagne">{row.elo}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-obsidian/70 p-5 md:p-6">
          <h3 className="text-xs uppercase tracking-[0.18em] text-ivory-muted font-data mb-4">Recent Match History</h3>
          <div className="space-y-2">
            {history.slice(0, 5).map((entry, idx) => {
              const p1 = entry?.score?.p1 ?? 0;
              const p2 = entry?.score?.p2 ?? 0;
              return (
                <div key={entry.id || idx} className="rounded-lg px-4 py-3 bg-white/3 border border-white/5 flex items-center justify-between">
                  <div className="text-base text-ivory-muted pr-2 truncate">{entry.agent1} vs {entry.agent2}</div>
                  <div className="font-data text-base text-champagne">{p1}-{p2}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function StatCard({ icon, label, value, extra }) {
  const Icon = icon;
  return (
    <article className="rounded-xl border border-white/10 bg-obsidian/70 p-5 md:p-6">
      <div className="flex items-center gap-2.5">
        <Icon className="w-4 h-4 text-champagne" />
        <span className="text-xs uppercase tracking-[0.2em] text-ivory-muted font-data">{label}</span>
      </div>
      <p className="mt-4 text-3xl font-semibold">{value}</p>
      <p className="text-sm text-ivory-muted mt-2">{extra}</p>
    </article>
  );
}

function ModeSelectionScreen({ setup, onSelect, onNext, onBack }) {
  return (
    <Panel
      title="Game Mode Selection"
      subtitle="Choose how this session should run."
      right={
        <NavActions onBack={onBack} onNext={onNext} nextText="Continue to Agent Selection" />
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {MODE_OPTIONS.map((mode) => {
          const selected = setup.mode === mode.id;
          return (
            <button
              key={mode.id}
              onClick={() => onSelect(mode.id)}
              className={`text-left rounded-xl p-6 border transition-all bg-obsidian/60 ${
                selected ? 'border-champagne/50 ring-1 ring-champagne/20' : mode.accent
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="text-2xl font-semibold">{mode.title}</h3>
                {selected ? <Sparkles className="w-5 h-5 text-champagne" /> : null}
              </div>
              <p className="mt-3 text-base text-ivory-muted">{mode.subtitle}</p>
              <ul className="mt-5 space-y-2 text-base text-ivory-muted">
                {mode.features.map((feature) => (
                  <li key={feature}>• {feature}</li>
                ))}
              </ul>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function AgentSelectionScreen({ setup, agents, onAgentSelect, onBack, onNext, loading }) {
  const selectableAgents = useMemo(() => {
    if (setup.mode === 'competitor') {
      return [...agents, HUMAN_AGENT];
    }
    return agents.filter((agent) => agent.type !== 'human');
  }, [agents, setup.mode]);

  return (
    <Panel
      title="AI Agent Selection"
      subtitle={setup.mode === 'competitor'
        ? 'Pick AI or Human for each side. Human uses only manual controls.'
        : 'Spectator mode allows AI agents only.'}
      right={<NavActions onBack={onBack} onNext={onNext} nextText="Continue to Ability Selection" />}
    >
      {loading ? <p className="text-base text-ivory-muted">Fetching agents from API...</p> : null}
      {!loading && agents.length === 0 ? (
        <p className="text-sm text-amber-300/90 font-data mb-3">
          No agent registry received from backend. Check `/api/agents`.
        </p>
      ) : null}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mt-2">
        {['p1', 'p2'].map((slot) => {
          const slotLabel = slot === 'p1' ? 'Player One' : 'Player Two';
          const selectedType = setup.players[slot].agentType;

          return (
            <div key={slot} className="rounded-xl border border-white/10 bg-obsidian/70 p-4 sm:p-5 md:p-6">
              <h3 className="text-xs uppercase tracking-[0.2em] text-ivory-muted font-data mb-4">{slotLabel}</h3>
              <div className="space-y-2">
                {selectableAgents.map((agent) => {
                  const selected = selectedType === agent.type;
                  return (
                    <button
                      key={`${slot}-${agent.type}`}
                      onClick={() => onAgentSelect(slot, agent)}
                      className={`w-full text-left rounded-lg border px-4 py-4 transition-all ${
                        selected
                          ? 'border-champagne/50 bg-champagne/10'
                          : 'border-white/10 hover:border-champagne/30 bg-obsidian-light/40'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-lg">{agent.name}</p>
                          <p className="text-sm text-ivory-muted mt-1">{agent.description}</p>
                        </div>
                        <span className="text-xs font-data tracking-[0.2em]" style={{ color: agent.color || '#C9A84C' }}>
                          {agent.type.toUpperCase()}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}
function AbilitySelectionScreen({ setup, onSelectAbility, onBack, onNext }) {
  return (
    <Panel
      title="Ability Selection"
      subtitle="Assign one ability loadout to each agent."
      right={<NavActions onBack={onBack} onNext={onNext} nextText="Continue to Strategy" />}
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5">
        {['p1', 'p2'].map((slot) => {
          const selected = setup.players[slot].ability;
          const slotName = slot === 'p1' ? (setup.players.p1.name || 'Player One') : (setup.players.p2.name || 'Player Two');

          return (
            <div key={slot} className="rounded-xl border border-white/10 bg-obsidian/70 p-4 sm:p-5 md:p-6">
              <h3 className="text-xs uppercase tracking-[0.2em] text-ivory-muted font-data mb-4">
                {slotName} Ability
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {ABILITY_OPTIONS.map((ability) => (
                  <button
                    key={`${slot}-${ability.id}`}
                    onClick={() => onSelectAbility(slot, ability.id)}
                    className={`rounded-lg border px-4 py-4 text-left transition-all ${
                      selected === ability.id
                        ? 'border-champagne/50 bg-champagne/10'
                        : 'border-white/10 hover:border-champagne/35 bg-obsidian-light/40'
                    }`}
                  >
                    <p className="font-semibold text-base">{ability.title}</p>
                    <p className="text-sm text-ivory-muted mt-1.5">{ability.description}</p>
                    <p className="text-xs text-champagne mt-2 font-data tracking-[0.08em]">{ability.impact}</p>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function StrategyConfigScreen({ setup, onStrategyChange, onApplyPreset, onBack, onNext }) {
  const strategyItems = [
    { id: 'aggression', label: 'Aggression', icon: Zap },
    { id: 'defense', label: 'Defense', icon: Shield },
    { id: 'risk', label: 'Risk Tolerance', icon: Target },
    { id: 'depth', label: 'Search Depth Bias', icon: BrainCircuit },
  ];

  return (
    <Panel
      title="Strategy Configuration"
      subtitle="Tune tactical behavior before simulation initialization."
      right={<NavActions onBack={onBack} onNext={onNext} nextText="Initialize Match" />}
    >
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <button
          onClick={() => onApplyPreset({ aggression: 55, defense: 50, risk: 45, depth: 60 })}
          className="px-4 py-2.5 rounded-lg border border-white/15 text-xs uppercase tracking-wider font-data hover:border-champagne/40"
        >
          Balanced
        </button>
        <button
          onClick={() => onApplyPreset({ aggression: 80, defense: 35, risk: 70, depth: 72 })}
          className="px-4 py-2.5 rounded-lg border border-white/15 text-xs uppercase tracking-wider font-data hover:border-champagne/40"
        >
          Aggressive
        </button>
        <button
          onClick={() => onApplyPreset({ aggression: 35, defense: 78, risk: 20, depth: 65 })}
          className="px-4 py-2.5 rounded-lg border border-white/15 text-xs uppercase tracking-wider font-data hover:border-champagne/40"
        >
          Defensive
        </button>
      </div>

      <div className="space-y-4">
        {strategyItems.map((item) => {
          const Icon = item.icon;
          const value = setup.strategy[item.id];
          return (
            <div key={item.id} className="rounded-xl border border-white/10 bg-obsidian/70 p-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4 text-champagne" />
                  <span className="text-base">{item.label}</span>
                </div>
                <span className="text-base font-data text-champagne">{value}</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={value}
                onChange={(event) => onStrategyChange(item.id, Number(event.target.value))}
                className="w-full accent-champagne"
              />
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function ArenaSelectionScreen({ setup, onSelectArena, onBack, onNext }) {
  const selectedArenaId = setup.arena?.id || '';

  return (
    <Panel
      title="Arena Selection"
      subtitle="Choose the stadium overlay for this session before match initialization."
      right={<NavActions onBack={onBack} onNext={onNext} nextText="Initialize Match" />}
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {ARENA_OPTIONS.map((arena) => {
          const selected = selectedArenaId === arena.id;
          return (
            <button
              key={arena.id}
              onClick={() => onSelectArena(arena)}
              className={`group relative overflow-hidden rounded-xl border text-left transition-all ${
                selected
                  ? 'border-champagne/60 ring-1 ring-champagne/25'
                  : 'border-white/10 hover:border-champagne/40'
              }`}
            >
              <div className="absolute inset-0">
                <img
                  src={`/${arena.file}`}
                  alt={arena.name}
                  className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-linear-to-t from-obsidian via-obsidian/70 to-obsidian/35" />
              </div>
              <div className="relative p-6 md:p-7 min-h-56 flex flex-col justify-end">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-2xl font-semibold">{arena.name}</h3>
                  {selected ? (
                    <span className="rounded-full border border-champagne/40 bg-champagne/10 px-3 py-1 text-[10px] font-data tracking-[0.18em] uppercase text-champagne">
                      Selected
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 text-base text-ivory-muted">{arena.subtitle}</p>
                <p className="mt-3 text-xs tracking-[0.16em] font-data uppercase text-champagne">{arena.detail}</p>
              </div>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

function MatchInitLoaderScreen({ setup, runId, onComplete, onBack }) {
  const [stepIndex, setStepIndex] = useState(0);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setStepIndex((prev) => Math.min(prev + 1, LOADER_STEPS.length - 1));
    }, 1000);

    const doneTimeout = window.setTimeout(() => {
      onComplete();
    }, LOADER_STEPS.length * 1000 + 500);

    return () => {
      window.clearInterval(interval);
      window.clearTimeout(doneTimeout);
    };
  }, [onComplete, runId]);

  const p1Ability = formatAbilityLabel(setup.players.p1.ability);
  const p2Ability = formatAbilityLabel(setup.players.p2.ability);

  return (
    <Panel
      title="Match Initialization"
      subtitle="Preparing environment, agents, and tactical directives."
      right={<NavActions onBack={onBack} disableNext nextText="Loading..." />}
    >
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 rounded-xl border border-white/10 bg-obsidian/70 p-5 md:p-6">
          <div className="space-y-3">
            {LOADER_STEPS.map((step, index) => {
              const active = index === stepIndex;
              const done = index < stepIndex;
              return (
                <div key={step} className="flex items-center gap-3">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      done ? 'bg-green-400' : active ? 'bg-champagne animate-pulse' : 'bg-white/25'
                    }`}
                  />
                  <p className={`${active ? 'text-ivory' : 'text-ivory-muted'} text-base`}>{step}</p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-obsidian/70 p-5 md:p-6 space-y-3 text-base">
          <p className="font-semibold text-champagne">Session Snapshot</p>
          <p><span className="text-ivory-muted">Mode:</span> {setup.mode || 'n/a'}</p>
          <p><span className="text-ivory-muted">Arena:</span> {setup.arena?.name || 'n/a'}</p>
          <p><span className="text-ivory-muted">P1:</span> {setup.players.p1.name || 'n/a'} ({p1Ability})</p>
          <p><span className="text-ivory-muted">P2:</span> {setup.players.p2.name || 'n/a'} ({p2Ability})</p>
          <p><span className="text-ivory-muted">Depth Bias:</span> {setup.strategy.depth}</p>
          <p><span className="text-ivory-muted">Aggression:</span> {setup.strategy.aggression}</p>
        </div>
      </div>
    </Panel>
  );
}

function MatchResultsScreen({ result, onRematch, onAnalytics, onHome }) {
  const summary = result;
  if (!summary) {
    return (
      <Panel title="Match Results" subtitle="No match result is available yet.">
        <p className="text-base text-ivory-muted">Run a match to generate real result data.</p>
      </Panel>
    );
  }
  const p1 = summary.score?.p1 ?? 0;
  const p2 = summary.score?.p2 ?? 0;

  return (
    <Panel
      title="Match Results"
      subtitle="Simulation complete. Review final outcome and tactical summary."
      right={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onRematch}
            className="px-4 py-2.5 rounded-lg bg-champagne text-obsidian text-sm font-semibold hover:bg-champagne-dark w-full sm:w-auto"
          >
            Rematch
          </button>
          <button
            onClick={onAnalytics}
            className="px-4 py-2.5 rounded-lg border border-white/15 text-sm hover:border-champagne/40 w-full sm:w-auto"
          >
            Final Analytics
          </button>
          <button
            onClick={onHome}
            className="px-4 py-2.5 rounded-lg border border-white/15 text-sm hover:border-champagne/40 w-full sm:w-auto"
          >
            Back Home
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-obsidian/70 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-ivory-muted font-data">Winner</p>
          <h3 className="text-3xl font-bold mt-2 text-champagne">{summary.winnerName}</h3>
          <p className="mt-2 text-base text-ivory-muted">Final Score: {p1} - {p2}</p>
          <div className="mt-4 h-2 rounded-full bg-slate overflow-hidden">
            <div className="h-full bg-champagne" style={{ width: `${toPercent(p1, p1 + p2)}%` }} />
          </div>
        </div>

        <div className="rounded-xl border border-white/10 bg-obsidian/70 p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-ivory-muted font-data">Performance</p>
          <div className="mt-3 space-y-2 text-base">
            <p><span className="text-ivory-muted">Rallies:</span> {summary.rallyCount}</p>
            <p><span className="text-ivory-muted">Duration:</span> {summary.durationSec}s</p>
            <p><span className="text-ivory-muted">Avg Decision:</span> {summary.averageDecisionMs}ms</p>
            <p><span className="text-ivory-muted">Peak Decision:</span> {summary.maxDecisionMs}ms</p>
          </div>
        </div>
      </div>
    </Panel>
  );
}
function FinalAnalyticsScreen({ result, onBackHome, onRematch }) {
  const summary = result;
  if (!summary) {
    return (
      <Panel title="Final AI Agent Analytics" subtitle="No analytics data is available yet.">
        <p className="text-base text-ivory-muted">Complete a live match to unlock analytics.</p>
      </Panel>
    );
  }
  const maxShots = Math.max(1, ...Object.values(summary.shotCounts || {}));
  const strategy = summary.strategy || { aggression: 0, defense: 0, risk: 0, depth: 0 };

  return (
    <Panel
      title="Final AI Agent Analytics"
      subtitle="Post-match ability impact and tactical behavior diagnostics."
      right={
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <button
            onClick={onRematch}
            className="px-4 py-2.5 rounded-lg bg-champagne text-obsidian text-sm font-semibold hover:bg-champagne-dark w-full sm:w-auto"
          >
            New Match
          </button>
          <button
            onClick={onBackHome}
            className="px-4 py-2.5 rounded-lg border border-white/15 text-sm hover:border-champagne/40 w-full sm:w-auto"
          >
            Home Dashboard
          </button>
        </div>
      }
    >
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-white/10 bg-obsidian/70 p-5 md:p-6">
          <h3 className="text-sm uppercase tracking-[0.2em] font-data text-ivory-muted mb-3">Shot Distribution</h3>
          {Object.entries(summary.shotCounts || {}).map(([key, value]) => (
            <div key={key} className="mb-3">
              <div className="flex items-center justify-between text-base mb-1">
                <span className="capitalize">{key}</span>
                <span className="font-data text-champagne">{value}</span>
              </div>
              <div className="h-2 rounded bg-slate overflow-hidden">
                <div className="h-full bg-champagne" style={{ width: `${toPercent(value, maxShots)}%` }} />
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-white/10 bg-obsidian/70 p-5 md:p-6">
          <h3 className="text-sm uppercase tracking-[0.2em] font-data text-ivory-muted mb-3">Ability Activations</h3>
          <div className="space-y-2 text-base">
            <p>Player One: <span className="font-data text-champagne">{summary.abilityActivations?.p1 ?? 0}</span></p>
            <p>Player Two: <span className="font-data text-champagne">{summary.abilityActivations?.p2 ?? 0}</span></p>
          </div>

          <h3 className="text-sm uppercase tracking-[0.2em] font-data text-ivory-muted mt-5 mb-3">Strategy Snapshot</h3>
          <div className="space-y-2 text-base">
            <p>Aggression: <span className="font-data text-champagne">{strategy.aggression}</span></p>
            <p>Defense: <span className="font-data text-champagne">{strategy.defense}</span></p>
            <p>Risk: <span className="font-data text-champagne">{strategy.risk}</span></p>
            <p>Depth: <span className="font-data text-champagne">{strategy.depth}</span></p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function NavActions({ onBack, onNext, nextText = 'Continue', disableNext = false }) {
  return (
    <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
      <button
        onClick={onBack}
        className="px-4 py-2.5 rounded-lg border border-white/15 text-sm hover:border-champagne/40 transition-colors flex items-center justify-center gap-1.5 w-full sm:w-auto"
      >
        <ChevronLeft className="w-4 h-4" />
        Back
      </button>
      <button
        onClick={onNext}
        disabled={disableNext}
        className="px-4 py-2.5 rounded-lg bg-champagne text-obsidian font-semibold text-sm hover:bg-champagne-dark transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto"
      >
        {nextText}
        <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
}

function PauseOverlay({ onResume, onRestart, onExit }) {
  return (
    <div className="fixed inset-0 z-75 bg-obsidian/80 backdrop-blur-sm flex items-center justify-center px-4">
      <div className="w-full max-w-lg max-h-[90svh] overflow-y-auto rounded-2xl border border-white/15 bg-obsidian-light p-5 sm:p-7">
        <h3 className="text-3xl font-bold">Pause Menu</h3>
        <p className="mt-2 text-base text-ivory-muted">Simulation is paused. Choose your next action.</p>

        <div className="mt-6 space-y-3">
          <button
            onClick={onResume}
            className="w-full px-4 py-3.5 rounded-xl bg-champagne text-obsidian font-semibold flex items-center justify-center gap-2"
          >
            <Play className="w-4 h-4" />
            Resume Match
          </button>
          <button
            onClick={onRestart}
            className="w-full px-4 py-3.5 rounded-xl border border-white/15 hover:border-champagne/40 flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" />
            Restart Match
          </button>
          <button
            onClick={onExit}
            className="w-full px-4 py-3.5 rounded-xl border border-white/15 hover:border-champagne/40 flex items-center justify-center gap-2"
          >
            <UserRound className="w-4 h-4" />
            Exit to Home Dashboard
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PostLoginFlow({ currentUser, onSignOut }) {
  const [screen, setScreen] = useState('home');
  const [setup, setSetup] = useState(() => cloneDefaultSetup());
  const [agents, setAgents] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [leaderboard, setLeaderboard] = useState([]);
  const [history, setHistory] = useState([]);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [loaderRunId, setLoaderRunId] = useState(0);
  const [matchSession, setMatchSession] = useState(0);
  const [latestResult, setLatestResult] = useState(null);
  const [resultHistory, setResultHistory] = useState([]);

  const fetchedAgentsRef = useRef(false);
  const displayName = resolveDisplayName(currentUser);
  const flowIndex = findFlowIndex(screen);

  useEffect(() => {
    let active = true;

    if (!USE_API) {
      return () => {
        active = false;
      };
    }

    Promise.all([getLeaderboard(), getMatchHistory(8)])
      .then(([leaderboardRows, historyRows]) => {
        if (!active) return;
        if (Array.isArray(leaderboardRows) && leaderboardRows.length) setLeaderboard(leaderboardRows);
        if (Array.isArray(historyRows) && historyRows.length) setHistory(historyRows);
      })
      .catch(() => {
        if (!active) return;
        setLeaderboard([]);
        setHistory([]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (screen !== 'agents') return;
    if (fetchedAgentsRef.current) return;
    fetchedAgentsRef.current = true;

    if (!USE_API) return;

    const loadingTimer = window.setTimeout(() => {
      setLoadingAgents(true);
    }, 0);

    getAgents()
      .then((rows) => {
        if (Array.isArray(rows) && rows.length > 0) {
          setAgents(rows);
        }
      })
      .catch(() => {
        showNotification('Agent API unavailable. Unable to load agent registry.', 'error');
      })
      .finally(() => {
        window.setTimeout(() => setLoadingAgents(false), 0);
      });

    return () => {
      window.clearTimeout(loadingTimer);
    };
  }, [screen]);

  const updateSetup = useCallback((updater) => {
    setSetup((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
  }, []);

  const validateCurrentStep = useCallback(() => {
    if (screen === 'mode' && !setup.mode) {
      showNotification('Select a game mode before proceeding.', 'error');
      return false;
    }

    if (screen === 'agents') {
      const p1 = setup.players.p1.agentType;
      const p2 = setup.players.p2.agentType;
      if (!p1 || !p2) {
        showNotification('Select participants for both players.', 'error');
        return false;
      }

      const p1Human = p1 === 'human';
      const p2Human = p2 === 'human';

      if (setup.mode === 'spectator' && (p1Human || p2Human)) {
        showNotification('Spectator mode allows AI vs AI only.', 'error');
        return false;
      }

      if (setup.mode === 'competitor' && !p1Human && !p2Human) {
        showNotification('Competitor mode requires at least one Human side.', 'error');
        return false;
      }

      if (p1 === p2 && p1 !== 'human') {
        showNotification('Choose two different agents for clearer comparison.', 'error');
        return false;
      }
    }

    if (screen === 'abilities') {
      if (!setup.players.p1.ability || !setup.players.p2.ability) {
        showNotification('Assign abilities for both players.', 'error');
        return false;
      }
    }

    if (screen === 'arena') {
      if (!setup.arena?.id) {
        showNotification('Select an arena before initializing the match.', 'error');
        return false;
      }
    }

    return true;
  }, [screen, setup]);

  const goBack = useCallback(() => {
    if (screen === 'home') return;
    if (screen === 'live' || screen === 'results' || screen === 'analytics') return;

    const index = findFlowIndex(screen);
    if (index <= 0) return;
    setScreen(FLOW_ORDER[index - 1]);
  }, [screen]);

  const goNext = useCallback(() => {
    if (!validateCurrentStep()) return;

    if (screen === 'arena') {
      setPauseOpen(false);
      setLoaderRunId((prev) => prev + 1);
      setScreen('loader');
      return;
    }

    const index = findFlowIndex(screen);
    if (index === -1 || index + 1 >= FLOW_ORDER.length) return;
    setScreen(FLOW_ORDER[index + 1]);
  }, [screen, validateCurrentStep]);

  const beginLiveFromLoader = useCallback(() => {
    setPauseOpen(false);
    setMatchSession((prev) => prev + 1);
    setScreen('live');
  }, []);

  const handleMatchComplete = useCallback((summary) => {
    setPauseOpen(false);
    setLatestResult(summary);
    setResultHistory((prev) => [summary, ...prev].slice(0, 10));
    setScreen('results');
  }, []);

  const restartMatch = useCallback(() => {
    setPauseOpen(false);
    setLoaderRunId((prev) => prev + 1);
    setScreen('loader');
  }, []);

  const goHome = useCallback(() => {
    setPauseOpen(false);
    setScreen('home');
  }, []);

  const handleAgentSelect = useCallback((slot, agent) => {
    updateSetup((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next.players[slot].agentType = agent.type;
      next.players[slot].name = agent.name;
      return next;
    });
  }, [updateSetup]);

  const handleModeSelect = useCallback((modeId) => {
    updateSetup((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next.mode = modeId;
      next.manualControl = modeId === 'competitor';

      if (modeId === 'spectator') {
        if (next.players.p1.agentType === 'human') {
          next.players.p1 = { agentType: '', name: '', ability: 'none' };
        }
        if (next.players.p2.agentType === 'human') {
          next.players.p2 = { agentType: '', name: '', ability: 'none' };
        }
      }

      return next;
    });
  }, [updateSetup]);

  const handleAbilitySelect = useCallback((slot, abilityId) => {
    updateSetup((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next.players[slot].ability = abilityId;
      return next;
    });
  }, [updateSetup]);

  const handleArenaSelect = useCallback((arena) => {
    updateSetup((prev) => ({
      ...prev,
      arena: {
        id: arena.id,
        name: arena.name,
        file: arena.file,
      },
    }));
  }, [updateSetup]);

  const handleStrategyChange = useCallback((key, value) => {
    updateSetup((prev) => {
      const next = JSON.parse(JSON.stringify(prev));
      next.strategy[key] = clamp(value, 0, 100);
      return next;
    });
  }, [updateSetup]);

  const applyStrategyPreset = useCallback((preset) => {
    updateSetup((prev) => ({
      ...prev,
      strategy: {
        ...prev.strategy,
        ...preset,
      },
    }));
  }, [updateSetup]);

  const p1Agent = getAgentMeta(agents, setup.players.p1.agentType);
  const p2Agent = getAgentMeta(agents, setup.players.p2.agentType);
  const arenaName = setup.arena?.name || 'Not selected';

  const handleTopNavSelect = useCallback((target) => {
    if (target === 'home') {
      goHome();
      return;
    }

    if (target === 'mode') {
      setScreen('mode');
      return;
    }

    if (target === 'arena') {
      if (
        !setup.mode
        || !setup.players.p1.agentType
        || !setup.players.p2.agentType
        || !setup.players.p1.ability
        || !setup.players.p2.ability
      ) {
        showNotification('Complete mode, agent, and ability setup before arena selection.', 'info');
        return;
      }
      setScreen('arena');
      return;
    }

    if (target === 'analytics') {
      if (!latestResult) {
        showNotification('Run a match first to unlock analytics.', 'info');
        return;
      }
      setScreen('analytics');
    }
  }, [
    goHome,
    latestResult,
    setup.mode,
    setup.players.p1.agentType,
    setup.players.p1.ability,
    setup.players.p2.agentType,
    setup.players.p2.ability,
  ]);

  return (
    <div className="min-h-dvh bg-obsidian text-ivory">
      <FlowTopBar
        currentUser={currentUser}
        onSignOut={onSignOut}
        screen={screen}
        progressIndex={Math.max(flowIndex, 0)}
        onScreenSelect={handleTopNavSelect}
      />
      <FlowStepper screen={screen} />

      {screen === 'home' && (
        <HomeDashboardScreen
          displayName={displayName}
          leaderboard={leaderboard.length ? leaderboard : []}
          history={history.length ? history : resultHistory.map((row, i) => ({
            id: `local-${i}`,
            agent1: row.setupSnapshot?.players?.p1?.name || 'P1',
            agent2: row.setupSnapshot?.players?.p2?.name || 'P2',
            score: row.score,
          }))}
          onStart={() => setScreen('mode')}
          lastResult={latestResult}
          onGoAnalytics={() => setScreen('analytics')}
        />
      )}

      {screen === 'mode' && (
        <ModeSelectionScreen
          setup={setup}
          onSelect={handleModeSelect}
          onBack={goBack}
          onNext={goNext}
        />
      )}

      {screen === 'agents' && (
        <AgentSelectionScreen
          setup={setup}
          agents={agents}
          loading={loadingAgents}
          onAgentSelect={handleAgentSelect}
          onBack={goBack}
          onNext={goNext}
        />
      )}

      {screen === 'abilities' && (
        <AbilitySelectionScreen
          setup={setup}
          onSelectAbility={handleAbilitySelect}
          onBack={goBack}
          onNext={goNext}
        />
      )}

      {screen === 'strategy' && (
        <StrategyConfigScreen
          setup={setup}
          onStrategyChange={handleStrategyChange}
          onApplyPreset={applyStrategyPreset}
          onBack={goBack}
          onNext={goNext}
        />
      )}

      {screen === 'arena' && (
        <ArenaSelectionScreen
          setup={setup}
          onSelectArena={handleArenaSelect}
          onBack={goBack}
          onNext={goNext}
        />
      )}

      {screen === 'loader' && (
        <MatchInitLoaderScreen
          key={`loader-${loaderRunId}`}
          setup={setup}
          runId={loaderRunId}
          onComplete={beginLiveFromLoader}
          onBack={goBack}
        />
      )}

      {screen === 'live' && (
        <section className="max-w-7xl mx-auto px-4 sm:px-5 pb-8 sm:pb-10">
          <div className="mb-4 rounded-xl border border-white/10 bg-obsidian-light/60 p-4 sm:p-5 md:p-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-ivory-muted font-data">Active Match</p>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-semibold mt-1">
                {setup.players.p1.name || p1Agent?.name || 'Player One'} vs {setup.players.p2.name || p2Agent?.name || 'Player Two'}
              </h2>
              <p className="text-sm sm:text-base text-ivory-muted mt-2">
                Mode: {setup.mode || 'competitor'} • Arena: {arenaName} • Abilities: {formatAbilityLabel(setup.players.p1.ability)} / {formatAbilityLabel(setup.players.p2.ability)}
              </p>
              {setup.mode === 'competitor' && (setup.players.p1.agentType === 'human' || setup.players.p2.agentType === 'human') ? (
                <p className="text-sm text-cyan-300 mt-2 font-data">
                  Controls: P1 uses WASD + J/K/L + U(power). P2 uses Arrow keys + 1/2/3 + 9(power).
                </p>
              ) : null}
            </div>
            <button
              onClick={() => setPauseOpen(true)}
              className="px-4 py-2.5 rounded-lg border border-white/15 hover:border-champagne/40 flex items-center justify-center gap-2 w-full sm:w-auto"
            >
              <Pause className="w-4 h-4" />
              Pause Menu
            </button>
          </div>

          <GameArena
            key={`arena-${matchSession}`}
            matchSetup={setup}
            isPaused={pauseOpen}
            onPauseRequest={() => setPauseOpen(true)}
            onResumeRequest={() => setPauseOpen(false)}
            onMatchComplete={handleMatchComplete}
            matchInstanceKey={matchSession}
            immersive
          />
        </section>
      )}

      {screen === 'results' && (
        <MatchResultsScreen
          result={latestResult}
          onRematch={restartMatch}
          onAnalytics={() => setScreen('analytics')}
          onHome={goHome}
        />
      )}

      {screen === 'analytics' && (
        <FinalAnalyticsScreen
          result={latestResult}
          onBackHome={goHome}
          onRematch={restartMatch}
        />
      )}

      {pauseOpen && screen === 'live' ? (
        <PauseOverlay
          onResume={() => setPauseOpen(false)}
          onRestart={restartMatch}
          onExit={goHome}
        />
      ) : null}
    </div>
  );
}
