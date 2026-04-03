/**
 * Structured setup contract for the post-login match flow.
 */
export const DEFAULT_MATCH_SETUP = {
  mode: '',
  arena: {
    id: '',
    name: '',
    file: '',
  },
  players: {
    p1: { agentType: '', name: '', ability: 'none' },
    p2: { agentType: '', name: '', ability: 'none' },
  },
  strategy: {
    aggression: 55,
    defense: 50,
    risk: 45,
    depth: 60,
  },
  manualControl: false,
};

export const FLOW_ORDER = [
  'home',
  'mode',
  'agents',
  'abilities',
  'strategy',
  'arena',
  'loader',
  'live',
  'results',
  'analytics',
];

export const FLOW_LABELS = {
  home: 'Home',
  mode: 'Mode',
  agents: 'Agents',
  abilities: 'Abilities',
  strategy: 'Strategy',
  arena: 'Arena',
  loader: 'Initialize',
  live: 'Live Match',
  results: 'Results',
  analytics: 'Analytics',
};

export const MODE_OPTIONS = [
  {
    id: 'spectator',
    title: 'Spectator',
    subtitle: 'Observe and benchmark AI behavior',
    features: ['AI vs AI only', 'Telemetry overlays', 'Performance snapshots'],
    accent: 'border-white/10',
  },
  {
    id: 'competitor',
    title: 'Competitor',
    subtitle: 'Play yourself or challenge with mixed control',
    features: ['Human vs AI', 'Human vs Human', 'Dual-side live controls'],
    accent: 'border-champagne/40 ring-1 ring-champagne/20',
  },
];

export const ABILITY_OPTIONS = [
  {
    id: 'none',
    title: 'No Ability',
    description: 'Run pure baseline strategy without modifiers.',
    impact: 'Stable control',
  },
  {
    id: 'super_smash',
    title: 'Super Smash',
    description: 'Increases high-impact attack conversion windows.',
    impact: '+ Aggression spikes',
  },
  {
    id: 'speed_burst',
    title: 'Speed Burst',
    description: 'Improves recovery and transition speed during rallies.',
    impact: '+ Mobility',
  },
  {
    id: 'time_slow',
    title: 'Time Slow',
    description: 'Temporarily disrupts opponent decision timing.',
    impact: '+ Tempo control',
  },
  {
    id: 'illusion',
    title: 'Illusion',
    description: 'Adds deceptive shot telemetry and targeting variance.',
    impact: '+ Uncertainty',
  },
];

export const ARENA_OPTIONS = [
  {
    id: 'stadium_1',
    name: 'Velocity Court',
    file: 'Stadium-1.png',
    subtitle: 'Balanced visual clarity for neutral simulation sessions.',
    detail: 'Recommended for benchmark matches.',
  },
  {
    id: 'stadium_2',
    name: 'Pulse Dome',
    file: 'Stadium-2.png',
    subtitle: 'High-contrast arena backdrop for tactical readability.',
    detail: 'Strong lighting separation for HUD-heavy play.',
  },
  {
    id: 'stadium_3',
    name: 'Grand Arc Arena',
    file: 'Stadium-3.png',
    subtitle: 'Cinematic atmosphere with deep court perspective.',
    detail: 'Best fit for showcase matches and presentations.',
  },
  {
    id: 'stadium_4',
    name: 'Prime Rally Hall',
    file: 'Stadium-4.png',
    subtitle: 'Clean composition with focused competitive mood.',
    detail: 'Great for disciplined, analysis-first sessions.',
  },
];

export const LOADER_STEPS = [
  'Authenticating arena profile',
  'Loading selected agents and abilities',
  'Compiling tactical strategy matrix',
  'Initializing simulation environment',
  'Syncing real-time telemetry stream',
];

export function cloneDefaultSetup() {
  return JSON.parse(JSON.stringify(DEFAULT_MATCH_SETUP));
}

export function resolveDisplayName(user) {
  const username = user?.metadata?.username;
  if (typeof username === 'string' && username.trim()) return username.trim();

  const email = user?.email;
  if (typeof email === 'string' && email.includes('@')) {
    return email.split('@')[0];
  }

  return 'Challenger';
}
