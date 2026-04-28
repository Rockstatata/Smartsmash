import { useState, useEffect, useRef, useCallback } from 'react';
import { decideAction, startMatch, USE_API } from '../services/api';

// Map a backend agent action (SMASH/CLEAR/...) onto the canvas shot type.
const ACTION_TO_SHOT_TYPE = {
  SMASH: 'smash',
  SPECIAL: 'special',
  DRIVE: 'long',
  CLEAR: 'long',
  LOB: 'long',
  DROP_SHOT: 'short',
  NET_SHOT: 'short',
};

const AI_AGENT_TYPES = new Set(['minimax', 'mcts', 'fuzzy']);

const DEMO_ACTIONS = [
  { agent: 'Minimax', action: 'SMASH to zone 3', color: '#4A9EFF' },
  { agent: 'MCTS', action: 'CLEAR to zone 1', color: '#FF6B6B' },
  { agent: 'Minimax', action: 'DROP_SHOT zone 5', color: '#4A9EFF' },
  { agent: 'MCTS', action: 'LOB to zone 2', color: '#FF6B6B' },
  { agent: 'System', action: 'Rally point awarded', color: '#C9A84C' },
  { agent: 'Fuzzy', action: 'CLEAR (low stamina rule)', color: '#4ade80' },
];

const STADIUMS = ['Stadium-1.png', 'Stadium-2.png', 'Stadium-3.png', 'Stadium-4.png'];

const PLAYER_SKINS = [
  {
    left: { stance: 'Player-1-Stance.png', hitStance: 'Player-1-Hit-Stance.png', hit: 'Player-1-Hit.png' },
    right: {
      stance: 'Player-1-Stance-Mirror.png',
      hitStance: 'Player-1-Hit-Stance-Mirror.png',
      hit: 'Player-1-Hit-Mirror.png',
    },
  },
  {
    left: { stance: 'Player-2-Stance.png', hitStance: 'Player-2-Hit-Stance.png', hit: 'Player-2-Hit.png' },
    right: {
      stance: 'Player-2-Stance-Mirror.png',
      hitStance: 'Player-2-Hit-Stance-Mirror.png',
      hit: 'Player-2-Hit-Mirror.png',
    },
  },
  {
    left: { stance: 'Player-3-Stance.png', hitStance: 'Player-3-Hit-Stance.png', hit: 'Player-3-Hit.png' },
    right: {
      stance: 'Player-3-Stance-Mirror.png',
      hitStance: 'Player-3-Hit-Stance-Mirror.png',
      hit: 'Player-3-Hit-Mirror.png',
    },
  },
  {
    left: { stance: 'Player-4-Stance.png', hitStance: 'Player-4-Hit-Stance.png', hit: 'Player-4-Hit.png' },
    right: {
      stance: 'Player-4-Stance-Mirror.png',
      hitStance: 'Player-4-Hit-Stance-Mirror.png',
      hit: 'Player-4-Hit-Mirror.png',
    },
  },
];

const SHUTTLE_FILE = 'shuttle.svg';

// Each special ability maps to one character skin (index into PLAYER_SKINS).
// 'none' falls back to the default skin (Player-1).
const ABILITY_SKIN_INDEX = {
  super_smash: 0,
  speed_burst: 1,
  illusion: 2,
  time_slow: 3,
};
const DEFAULT_SKIN_INDEX = 0;

// Arena-specific visual calibration. Each entry maps the in-engine court
// rectangle (normalised 0..1 in the canvas) onto the painted court surface
// in the stadium background. Tweaks below were measured against the four
// stadium PNGs so players land on the painted court and shuttle is sized
// consistently across all arenas.
//
// Fields:
//   courtTop, courtHeight   — vertical band of the painted court in canvas-y
//   playerGroundOffset      — added to player.y (after court mapping) so feet
//                             plant on the court surface, not above/below
//   playerScale             — multiplier on baseline sprite height
//   shuttleScale            — multiplier on baseline shuttle size
const ARENA_TUNING = {
  'Stadium-1.png': {
    courtTop: 0.001,
    courtHeight: 0.9,
    playerGroundOffset: 0.06,
    playerScale: 0.87,
    shuttleScale: 0.62,
  },
  'Stadium-2.png': {
    courtTop: 0.2,
    courtHeight: 0.85,
    playerGroundOffset: 0.04,
    playerScale: 0.95,
    shuttleScale: 0.55,
  },
  'Stadium-3.png': {
    courtTop: 0.01,
    courtHeight: 0.9,
    playerGroundOffset: 0.04,
    playerScale: .95,
    shuttleScale: 0.6,
  },
  'Stadium-4.png': {
    courtTop: 0.23,
    courtHeight: 0.9,
    playerGroundOffset: 0.06,
    playerScale: 0.9,
    shuttleScale: 0.6,
  },
};

// Manual tweak section: shared simulation and animation controls.
// Court geometry uses normalised coords on a 16:10 canvas. The court rectangle
// is bounded by [courtInBoundsX0..courtInBoundsX1] horizontally and
// [courtInBoundsY0..courtInBoundsY1] vertically. Players move within wider
// "playable" bounds so they can reach shots dropping near the lines.
const GAMEPLAY_TUNING = {
  canvasAspect: 1.6,
  courtMarginX: 0.03,
  courtWidth: 0.94,
  // Half centres pushed slightly further from net to use more depth.
  leftHalfCenterX: 0.27,
  rightHalfCenterX: 0.73,
  // Baseline = where players idle. Slightly back so they have forward room
  // to step into net play. Receiver pulls toward the landing y dynamically.
  baselineY: 0.74,
  // Court playable bounds (normalised). Used by isInBounds() and clamps.
  courtInBoundsX0: 0.07,
  courtInBoundsX1: 0.93,
  courtInBoundsY0: 0.55,
  courtInBoundsY1: 0.88,
  // Player movement bounds — slightly wider than the in-bounds rect so they
  // can reach a shuttle landing exactly on the line.
  playerBoundsX: { p1: [0.10, 0.485], p2: [0.515, 0.90] },
  playerBoundsY: [0.58, 0.86],
  receiveYOffset: 0.0,
  xTrackAmplitude: 0.018,
  yTrackAmplitude: 0.010,
  xResponse: 7.6,
  yResponse: 6.8,
  aiMaxMoveSpeed: 0.40,
  aiMinMoveSpeed: 0.18,
  lowStaminaMoveThreshold: 32,
  manualAcceleration: 1.4,
  manualMaxSpeed: 0.24,
  manualMinSpeed: 0.12,
  manualDrag: 7.6,
  // Strike happens slightly later in the flight so the receiver has time to
  // close in on the landing point.
  strikeProgress: 0.82,
  aiReachDistance: 0.20,
  humanReachDistance: 0.22,
  smashReachPenalty: 0.015,
  missFeedbackLife: 0.9,
  hitFeedbackLife: 0.7,
  serveShortChance: 0.45,
  humanServeIdleWindowSec: 1.4,
  abilityMinStamina: 40,
  abilityMinSuccessfulShots: 2,
  abilityMinPoints: 0,
  abilityCooldownSec: 5.5,
  // Genuine unforced errors — kept low and only when the random target lands
  // outside the in-bounds rectangle. No more "false outs" inside the court.
  longOutChance: 0.05,
  longOutDistance: [0.012, 0.03],
  // Landing distance from the net (toward the back of the receiver's court).
  shortLandingDistance: [0.06, 0.13],
  longLandingDistance: [0.22, 0.36],
  netX: 0.5,
  // Visual + physics net height (top of net in normalised z units). The
  // shuttle's z must clear this at the net crossing or it's a NET fault.
  netHeight: 0.105,
  minNetClearance: 0.13,
  netFaultThreshold: 0.085,
  baseMistakeChance: 0.02,
  mistakeGrowthPerShot: 0.011,
  fatigueMistakeFactor: 0.24,
  distanceMistakeFactor: 0.22,
  specialMinRally: 2,
  specialMinStamina: 40,
  specialMinSuccessfulShots: 1,
  specialTryChance: 0.6,
  betweenRallyStaminaRecovery: 3.5,
  successfulHitStaminaRecovery: 0.6,
  movementStaminaDrain: 42,
  receiveMovementDrainMultiplier: 1.4,
  lowStaminaSlowThreshold: 22,
  criticalStaminaNoHitThreshold: 8,
  exhaustedHitFailChance: 0.9,
  playerSpriteHeight: 0.49,
  playerDepthBase: 0.9,
  playerDepthGain: 0.4,
  playerAnchor: 0.94,
  shuttleSize: 0.058,
  trailLength: 28,
  trailFadeRate: 0.034,
  flightTimeScale: 0.92,
  hitPoseDuration: 0.34,
  hitPoseStrongWindow: 0.17,
  prepPoseProgress: 0.68,
  decisionBaseMs: 15,
  decisionSwingMs: 105,
  // Post-point reset: how long players take to walk back to baseline before
  // the serve begins. Provides a clear visual "between rallies" pause.
  postPointResetSec: 1.1,
  // Jump-smash: extra vertical lift applied to the smasher while the hit
  // pose is active. This is in normalised y units (subtracted from y).
  smashJumpLift: 0.058,
  smashJumpRiseSec: 0.18,
  speedBurstDurationSec: 2.4,
  speedBurstMoveMultiplier: 1.33,
  speedBurstDrainMultiplier: 0.58,
  timeSlowDurationSec: 2.2,
  timeSlowMoveMultiplier: 0.72,
  timeSlowResponseMultiplier: 0.62,
  timeSlowDecisionPenaltyMs: 36,
  illusionDurationSec: 0.68,
  illusionSpread: 0.018,
};

const SHOT_PROFILES = {
  short: {
    flightTime: [1.10, 1.32],
    arc: [0.19, 0.25],
    jumpTime: 0.22,
    jumpPower: 0.022,
  },
  smash: {
    // Smashes are fast, low-arc, and trigger an overhead jump.
    flightTime: [0.78, 0.96],
    arc: [0.20, 0.26],
    jumpTime: 0.42,
    jumpPower: 0.085,
    isSmash: true,
  },
  special: {
    // A special is a single high-commitment attacking shot.
    flightTime: [0.72, 0.88],
    arc: [0.18, 0.24],
    jumpTime: 0.46,
    jumpPower: 0.095,
    isSmash: true,
    isSpecial: true,
  },
  long: {
    flightTime: [1.42, 1.74],
    arc: [0.32, 0.42],
    jumpTime: 0.30,
    jumpPower: 0.045,
  },
};

const SHOT_STAMINA_COSTS = {
  short: 12,
  long: 16,
  smash: 28,
  special: 26,
};

const HIT_HIGHLIGHT_COLORS = {
  short: '#4ade80',
  long: '#60a5fa',
  smash: '#f97316',
  special: '#facc15',
};

const MANUAL_CONTROL_DEFAULT = {
  enabled: false,
};

const HUD_DEFAULT = {
  p1Score: 0,
  p2Score: 0,
  rally: 0,
  p1Stamina: 100,
  p2Stamina: 100,
  decisionTime: 0,
  p1Name: 'Minimax',
  p2Name: 'MCTS',
};

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function sampleRange(min, max) {
  return min + Math.random() * (max - min);
}

function smoothApproach(current, target, response, dtSec) {
  const blend = 1 - Math.exp(-response * dtSec);
  return current + (target - current) * blend;
}

function smoothApproachWithSpeedCap(current, target, response, maxSpeed, dtSec) {
  const next = smoothApproach(current, target, response, dtSec);
  const maxStep = Math.max(0, maxSpeed) * dtSec;
  const delta = next - current;
  if (Math.abs(delta) <= maxStep || maxStep <= 0) return next;
  return current + Math.sign(delta) * maxStep;
}

function isInBounds(x, y) {
  return (
    x >= GAMEPLAY_TUNING.courtInBoundsX0
    && x <= GAMEPLAY_TUNING.courtInBoundsX1
    && y >= GAMEPLAY_TUNING.courtInBoundsY0
    && y <= GAMEPLAY_TUNING.courtInBoundsY1
  );
}

function shuttleHeightAtProgress(progress, arc) {
  return 4 * arc * progress * (1 - progress);
}

function staminaRatio(stamina) {
  return clamp(Number(stamina) / 100, 0, 1);
}

function movementSpeedForStamina(baseSpeed, minSpeed, stamina) {
  const t = staminaRatio(stamina);
  return minSpeed + (baseSpeed - minSpeed) * (0.4 + 0.6 * t);
}

function safeStamina(stamina) {
  if (!Number.isFinite(stamina)) return 0;
  return clamp(stamina, 0, 100);
}

function isEffectActive(untilTs, nowTs) {
  return Number.isFinite(untilTs) && untilTs > nowTs;
}

export default function useGameCanvas(canvasRef, options = {}) {
  const {
    matchSetup = null,
    onMatchComplete = null,
    targetScore = 5,
  } = options;

  const [hudState, setHudState] = useState(HUD_DEFAULT);
  const [actionLog, setActionLog] = useState([{ id: 0, text: '> Loading visual assets...', color: null, agent: null }]);
  const [matchComplete, setMatchComplete] = useState(false);
  const [matchSummary, setMatchSummary] = useState(null);
  const [analytics, setAnalytics] = useState({
    averageDecisionMs: 0,
    maxDecisionMs: 0,
    abilityActivations: { p1: 0, p2: 0 },
    shotCounts: { smash: 0, long: 0, short: 0, special: 0 },
  });

  const isPlayingRef = useRef(true);
  const animFrameRef = useRef(null);
  const lastFrameTimeRef = useRef(0);
  const timeRef = useRef(0);
  const loopRef = useRef(null);
  const particlesRef = useRef([]);
  const feedbackRef = useRef([]);
  const assetCacheRef = useRef(new Map());
  const assetsReadyRef = useRef(false);
  const logIdCounter = useRef(1);
  const onMatchCompleteRef = useRef(onMatchComplete);
  const pauseRef = useRef(() => {});
  const matchOptionsRef = useRef({ matchSetup, targetScore });
  const matchFinishedRef = useRef(false);
  const matchStartTimeRef = useRef(0);
  // Backend agent bridge: cached decision per player + active match id.
  const matchIdRef = useRef(null);
  const pendingDecisionRef = useRef({ p1: null, p2: null });
  const inFlightDecisionRef = useRef({ p1: false, p2: false });
  const lastAgentDecisionRef = useRef({ p1: null, p2: null });
  const backendDecisionTimeRef = useRef(0);
  const analyticsRef = useRef({
    totalDecisionMs: 0,
    decisionSamples: 0,
    maxDecisionMs: 0,
    abilityActivations: { p1: 0, p2: 0 },
    shotCounts: { smash: 0, long: 0, short: 0, special: 0 },
  });

  const courtRef = useRef({ x: 0, y: 0, w: 0, h: 0, aspectRatio: 13.4 / 6.1 });
  const controlRef = useRef({
    ...MANUAL_CONTROL_DEFAULT,
    leftP1: false,
    rightP1: false,
    upP1: false,
    downP1: false,
    leftP2: false,
    rightP2: false,
    upP2: false,
    downP2: false,
    requestedShotP1: null,
    requestedShotP2: null,
    abilityTriggerP1: false,
    abilityTriggerP2: false,
    movedAtP1: 0,
    movedAtP2: 0,
  });

  const stateRef = useRef({
    p1: {
      x: GAMEPLAY_TUNING.leftHalfCenterX,
      y: GAMEPLAY_TUNING.baselineY,
      vx: 0,
      vy: 0,
      stamina: 100,
      name: 'Minimax',
      hitTime: 0,
      jumpTime: 0,
      jumpDuration: 0,
      jumpPower: 0,
      successShots: 0,
      pointsWon: 0,
      lastAbilityAt: -999,
      smashing: false,
      specialUsed: false,
      lastShotType: 'long',
      speedBurstUntil: 0,
      timeSlowUntil: 0,
      illusionUntil: 0,
    },
    p2: {
      x: GAMEPLAY_TUNING.rightHalfCenterX,
      y: GAMEPLAY_TUNING.baselineY,
      vx: 0,
      vy: 0,
      stamina: 100,
      name: 'MCTS',
      hitTime: 0,
      jumpTime: 0,
      jumpDuration: 0,
      jumpPower: 0,
      successShots: 0,
      pointsWon: 0,
      lastAbilityAt: -999,
      smashing: false,
      specialUsed: false,
      lastShotType: 'long',
      speedBurstUntil: 0,
      timeSlowUntil: 0,
      illusionUntil: 0,
    },
    shuttle: {
      x: GAMEPLAY_TUNING.netX,
      y: GAMEPLAY_TUNING.baselineY,
      prevX: GAMEPLAY_TUNING.netX,
      prevY: GAMEPLAY_TUNING.baselineY,
      active: true,
      trail: [],
      from: 'p1',
      to: 'p2',
      fromX: GAMEPLAY_TUNING.leftHalfCenterX,
      fromY: GAMEPLAY_TUNING.baselineY,
      targetX: GAMEPLAY_TUNING.rightHalfCenterX,
      targetY: GAMEPLAY_TUNING.baselineY,
      z: 0,
      progress: 0,
      elapsedSec: 0,
      flightTimeSec: 0.9,
      arc: 0.18,
      outOfCourt: false,
      contactResolved: false,
      shotType: 'long',
      illusionSource: null,
      illusionEndsAt: 0,
    },
    waitingServe: {
      active: false,
      server: 'p1',
      receiver: 'p2',
      reason: '',
      startedAt: 0,
    },
    score: { p1: 0, p2: 0 },
    rally: 0,
    decisionTime: 0,
    shotCount: 0,
    currentTurn: 'p1',
    playerSkinIndex: 0,
    stadiumIndex: 0,
  });

  useEffect(() => {
    onMatchCompleteRef.current = onMatchComplete;
  }, [onMatchComplete]);

  useEffect(() => {
    matchOptionsRef.current = {
      matchSetup,
      targetScore,
    };
  }, [matchSetup, targetScore]);

  const resolvePlayerName = useCallback((playerKey, fallback) => {
    const setupName = matchOptionsRef.current?.matchSetup?.players?.[playerKey]?.name;
    if (typeof setupName === 'string' && setupName.trim().length > 0) {
      return setupName.trim();
    }
    return fallback;
  }, []);

  const resolvePlayerAbility = useCallback((playerKey) => {
    return matchOptionsRef.current?.matchSetup?.players?.[playerKey]?.ability || 'none';
  }, []);

  const resolveStrategyValue = useCallback((key, fallback = 50) => {
    const raw = Number(matchOptionsRef.current?.matchSetup?.strategy?.[key]);
    if (Number.isFinite(raw)) return raw;
    return fallback;
  }, []);

  const resolveArenaIndex = useCallback(() => {
    const selectedFile = matchOptionsRef.current?.matchSetup?.arena?.file;
    if (typeof selectedFile === 'string' && selectedFile.trim().length > 0) {
      const index = STADIUMS.indexOf(selectedFile);
      if (index >= 0) return index;
    }
    return null;
  }, []);

  const resolveHumanPlayer = useCallback((playerKey) => {
    const mode = matchOptionsRef.current?.matchSetup?.mode;
    if (mode !== 'competitor') return false;
    return matchOptionsRef.current?.matchSetup?.players?.[playerKey]?.agentType === 'human';
  }, []);

  const resolveAgentType = useCallback((playerKey) => {
    const type = matchOptionsRef.current?.matchSetup?.players?.[playerKey]?.agentType;
    return typeof type === 'string' ? type.toLowerCase() : '';
  }, []);

  const buildAgentSnapshot = useCallback((playerKey) => {
    const state = stateRef.current;
    const me = state[playerKey];
    const opponentKey = playerKey === 'p1' ? 'p2' : 'p1';
    const opponent = state[opponentKey];
    const shuttle = state.shuttle;

    const lateral = clamp(shuttle.x, 0, 1);
    const depth = clamp(shuttle.y, 0.5, 0.85);
    const lateralBucket = Math.round(lateral * 7) + 1; // 1..8
    const heightMeters = clamp(shuttle.z * 18 + 1.0, 0.2, 4.5);

    return {
      player: playerKey,
      player_pos: { x: me.x, y: me.y },
      opponent_pos: { x: opponent.x, y: opponent.y },
      shuttle_zone: clamp(lateralBucket, 1, 8),
      shuttle_height: heightMeters,
      stamina: me.stamina,
      opponent_stamina: opponent.stamina,
      power: me.successShots * 12,
      opponent_power: opponent.successShots * 12,
      score: { p1: state.score.p1, p2: state.score.p2 },
      shuttle_depth_norm: depth,
    };
  }, []);

  const requestAgentDecision = useCallback(async (playerKey) => {
    if (!USE_API) return null;
    const matchId = matchIdRef.current;
    if (!matchId) return null;
    const agentType = resolveAgentType(playerKey);
    if (!AI_AGENT_TYPES.has(agentType)) return null;
    if (inFlightDecisionRef.current[playerKey]) return null;

    inFlightDecisionRef.current[playerKey] = true;
    try {
      const snapshot = buildAgentSnapshot(playerKey);
      const result = await decideAction(matchId, snapshot);
      inFlightDecisionRef.current[playerKey] = false;
      if (!result || !result.action) return null;
      const shot = ACTION_TO_SHOT_TYPE[result.action] || null;
      const cached = {
        shotType: shot,
        rawAction: result.action,
        decisionMs: result.decision_time_ms ?? 0,
        agentName: result.agent || playerKey,
        explanation: result.explanation || null,
      };
      pendingDecisionRef.current[playerKey] = cached;
      lastAgentDecisionRef.current[playerKey] = cached;
      backendDecisionTimeRef.current = cached.decisionMs;
      return cached;
    } catch {
      inFlightDecisionRef.current[playerKey] = false;
      return null;
    }
  }, [buildAgentSnapshot, resolveAgentType]);

  const consumePendingAgentShot = useCallback((playerKey) => {
    const pending = pendingDecisionRef.current[playerKey];
    if (!pending || !pending.shotType) return null;
    pendingDecisionRef.current[playerKey] = null;
    return pending;
  }, []);

  const resolveManualControlEnabled = useCallback(() => {
    const mode = matchOptionsRef.current?.matchSetup?.mode;
    if (mode !== 'competitor') return false;
    return resolveHumanPlayer('p1') || resolveHumanPlayer('p2');
  }, [resolveHumanPlayer]);

  const resolveArenaTuning = useCallback(() => {
    const selectedFile = matchOptionsRef.current?.matchSetup?.arena?.file;
    const fallbackFile = STADIUMS[stateRef.current.stadiumIndex] || STADIUMS[0];
    const key = selectedFile && ARENA_TUNING[selectedFile] ? selectedFile : fallbackFile;
    return ARENA_TUNING[key] || ARENA_TUNING[STADIUMS[0]];
  }, []);

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const viewportHeight = window.visualViewport?.height || window.innerHeight || 0;
    // When the canvas (or any ancestor) is the fullscreen element we want
    // to fill the available space without the normal height cap.
    const fullscreenEl = (typeof document !== 'undefined')
      ? (document.fullscreenElement || document.webkitFullscreenElement || null)
      : null;
    const inFullscreen = Boolean(fullscreenEl) && fullscreenEl.contains(canvas);

    const naturalW = Math.max(1, rect.width);
    const naturalH = naturalW / GAMEPLAY_TUNING.canvasAspect;
    const viewportMaxH = inFullscreen
      ? Math.max(naturalH, viewportHeight)
      : (viewportHeight > 0 ? Math.max(220, Math.min(viewportHeight * 0.74, 760)) : naturalH);
    const constrainedH = inFullscreen
      ? Math.min(rect.height || viewportHeight, viewportHeight)
      : Math.min(naturalH, viewportMaxH);
    const constrainedW = inFullscreen
      ? Math.min(naturalW, constrainedH * GAMEPLAY_TUNING.canvasAspect)
      : Math.min(naturalW, constrainedH * GAMEPLAY_TUNING.canvasAspect);

    canvas.width = Math.max(1, Math.round(constrainedW * dpr));
    canvas.height = Math.max(1, Math.round(constrainedH * dpr));
    canvas.style.width = `${constrainedW}px`;
    canvas.style.height = `${constrainedH}px`;
    canvas.style.maxWidth = '100%';
    canvas.style.margin = '0 auto';

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const displayW = constrainedW;
    const displayH = constrainedH;
    const court = courtRef.current;
    const arenaTuning = resolveArenaTuning();

    court.x = displayW * GAMEPLAY_TUNING.courtMarginX;
    court.w = displayW * GAMEPLAY_TUNING.courtWidth;
    court.y = displayH * arenaTuning.courtTop;
    court.h = displayH * arenaTuning.courtHeight;
  }, [canvasRef, resolveArenaTuning]);

  const addActionLogEntry = useCallback((custom) => {
    const action = custom ?? DEMO_ACTIONS[Math.floor(Math.random() * DEMO_ACTIONS.length)];
    const id = logIdCounter.current++;
    setActionLog((prev) => {
      const next = [...prev, { id, agent: action.agent, text: action.action, color: action.color }];
      return next.length > 40 ? next.slice(-40) : next;
    });
  }, []);

  const spawnScoreParticles = useCallback((x, y) => {
    for (let i = 0; i < 16; i++) {
      const angle = (Math.PI * 2 / 16) * i;
      particlesRef.current.push({
        x,
        y,
        vx: Math.cos(angle) * 0.004,
        vy: Math.sin(angle) * 0.004,
        life: 1,
      });
    }
  }, []);

  const preloadAssets = useCallback(async () => {
    const files = [
      ...STADIUMS,
      SHUTTLE_FILE,
      ...PLAYER_SKINS.flatMap((skin) => [
        skin.left.stance,
        skin.left.hitStance,
        skin.left.hit,
        skin.right.stance,
        skin.right.hitStance,
        skin.right.hit,
      ]),
    ];

    const uniqueFiles = [...new Set(files)];

    const loadResults = await Promise.allSettled(
      uniqueFiles.map(
        (fileName) =>
          new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
              assetCacheRef.current.set(fileName, image);
              resolve(fileName);
            };
            image.onerror = () => reject(new Error(fileName));
            image.src = `/${fileName}`;
          }),
      ),
    );

    const failed = loadResults
      .filter((entry) => entry.status === 'rejected')
      .map((entry) => entry.reason?.message || 'unknown-asset');

    assetsReadyRef.current = true;

    if (failed.length > 0) {
      setActionLog([
        {
          id: 0,
          text: `> Some assets failed (${failed.length}). Running fallback rendering.`,
          color: '#fbbf24',
          agent: 'System',
        },
      ]);
    } else {
      setActionLog([{ id: 0, text: '> All arena assets loaded. Simulation started.', color: null, agent: null }]);
    }
  }, []);

  const canUseSpecialShot = useCallback((playerKey) => {
    const state = stateRef.current;
    const player = state[playerKey];
    if (!player || player.specialUsed) return false;
    const enoughRallies = state.rally >= GAMEPLAY_TUNING.specialMinRally;
    const enoughStamina = player.stamina >= GAMEPLAY_TUNING.specialMinStamina;
    const enoughShots = player.successShots >= GAMEPLAY_TUNING.specialMinSuccessfulShots;
    return enoughRallies && enoughStamina && enoughShots;
  }, []);

  const pickShotType = useCallback((playerKey) => {
    // Prefer the backend agent's cached decision when available.
    const agentChoice = consumePendingAgentShot(playerKey);
    if (agentChoice && agentChoice.shotType) {
      const state = stateRef.current;
      const stamina = state[playerKey].stamina;
      const rally = state.rally;
      const timeSlowed = isEffectActive(state[playerKey].timeSlowUntil, timeRef.current);
      const canUseSpecial = canUseSpecialShot(playerKey);
      let resolvedShot = agentChoice.shotType;
      if (resolvedShot === 'long' && stamina >= 58 && rally >= 2 && Math.random() < 0.55) {
        resolvedShot = 'smash';
      }
      if (resolvedShot === 'short' && stamina >= 62 && rally >= 3 && Math.random() < 0.42) {
        resolvedShot = 'smash';
      }
      if (
        canUseSpecial
        && (
          (resolvedShot === 'smash' && Math.random() < 0.82)
          || (resolvedShot === 'long' && rally >= 3 && Math.random() < 0.34)
          || (rally >= 4 && stamina >= 52 && Math.random() < 0.62)
        )
      ) {
        resolvedShot = 'special';
      }
      if (resolvedShot === 'special' && !canUseSpecial) {
        resolvedShot = stamina > 50 ? 'smash' : 'long';
      }
      if (timeSlowed && Math.random() < 0.42) {
        const fallback = Math.random() < 0.55 ? 'short' : 'long';
        resolvedShot = fallback;
      }
      addActionLogEntry({
        agent: agentChoice.agentName,
        action: `${agentChoice.rawAction} -> ${resolvedShot.toUpperCase()}${timeSlowed ? ' (time-slowed)' : ''}`,
        color: playerKey === 'p1' ? '#4A9EFF' : '#FF6B6B',
      });
      return resolvedShot;
    }

    const state = stateRef.current;
    const stamina = state[playerKey].stamina;
    const aggression = resolveStrategyValue('aggression', 55);
    const risk = resolveStrategyValue('risk', 45);
    const ability = resolvePlayerAbility(playerKey);
    const roll = Math.random();

    let smashChance = stamina > 65 ? 0.52 : stamina > 35 ? 0.35 : 0.14;
    let longChance = stamina > 65 ? 0.25 : stamina > 35 ? 0.34 : 0.30;

    smashChance += (aggression - 50) / 240;
    smashChance += (risk - 50) / 300;
    if (ability === 'super_smash') smashChance += 0.12;
    if (ability === 'speed_burst') longChance += 0.06;
    if (ability === 'illusion') smashChance += 0.04;

    if (canUseSpecialShot(playerKey)) {
      const specialChance = clamp(
        GAMEPLAY_TUNING.specialTryChance + (aggression - 50) / 280 + (risk - 50) / 320,
        0.34,
        0.78,
      );
      if (roll < specialChance) return 'special';
    }

    smashChance = clamp(smashChance, 0.1, 0.86);
    longChance = clamp(longChance, 0.08, 0.65);

    if (stamina > 65) {
      if (roll < smashChance) return 'smash';
      if (roll < smashChance + longChance) return 'long';
      return 'short';
    }

    if (stamina > 35) {
      if (roll < smashChance) return 'smash';
      if (roll < smashChance + longChance) return 'long';
      return 'short';
    }

    return roll < 0.65 ? 'short' : 'long';
  }, [addActionLogEntry, canUseSpecialShot, consumePendingAgentShot, resolvePlayerAbility, resolveStrategyValue]);

  const consumeRequestedShotForPlayer = useCallback((playerKey, minTimestamp = -Infinity) => {
    const slot = playerKey === 'p1' ? 'requestedShotP1' : 'requestedShotP2';
    const requested = controlRef.current[slot];
    controlRef.current[slot] = null;
    if (!requested) return null;

    if (
      typeof requested === 'object'
      && (requested.type === 'short' || requested.type === 'long' || requested.type === 'smash')
      && Number.isFinite(requested.at)
      && requested.at >= minTimestamp
    ) {
      return requested.type;
    }

    if (
      typeof requested === 'string'
      && (requested === 'short' || requested === 'long' || requested === 'smash')
      && minTimestamp <= 0
    ) {
      return requested;
    }
    return null;
  }, []);

  const pushFeedback = useCallback((kind, x, y, text, color) => {
    const life = kind === 'hit' ? GAMEPLAY_TUNING.hitFeedbackLife : GAMEPLAY_TUNING.missFeedbackLife;
    feedbackRef.current.push({ kind, x, y, text, color, life, ttl: life });
  }, []);

  const canActivateAbility = useCallback((playerKey) => {
    const state = stateRef.current;
    const player = state[playerKey];
    if (!player) return false;

    const ability = resolvePlayerAbility(playerKey);
    if (!ability || ability === 'none') return false;

    const enoughStamina = player.stamina >= GAMEPLAY_TUNING.abilityMinStamina;
    const enoughShots = player.successShots >= GAMEPLAY_TUNING.abilityMinSuccessfulShots;
    const enoughPoints = player.pointsWon >= GAMEPLAY_TUNING.abilityMinPoints;
    const offCooldown = (timeRef.current - player.lastAbilityAt) >= GAMEPLAY_TUNING.abilityCooldownSec;
    return enoughStamina && enoughShots && enoughPoints && offCooldown;
  }, [resolvePlayerAbility]);

  const wasHumanRecentlyActive = useCallback((playerKey, minTimestamp = -Infinity) => {
    const now = timeRef.current;
    const ts = playerKey === 'p1' ? controlRef.current.movedAtP1 : controlRef.current.movedAtP2;
    return ts >= minTimestamp && now - ts <= GAMEPLAY_TUNING.humanServeIdleWindowSec;
  }, []);

  const getTargetX = useCallback((receiver, shotType) => {
    const towardLeft = receiver === 'p1';
    const direction = towardLeft ? -1 : 1;

    if (shotType === 'short') {
      return GAMEPLAY_TUNING.netX + direction * sampleRange(
        GAMEPLAY_TUNING.shortLandingDistance[0],
        GAMEPLAY_TUNING.shortLandingDistance[1],
      );
    }

    if (shotType === 'long') {
      return GAMEPLAY_TUNING.netX + direction * sampleRange(
        GAMEPLAY_TUNING.longLandingDistance[0],
        GAMEPLAY_TUNING.longLandingDistance[1],
      );
    }

    const smashNear = sampleRange(0.13, 0.19);
    const smashFar = sampleRange(0.23, 0.32);
    return GAMEPLAY_TUNING.netX + direction * lerp(smashNear, smashFar, 0.62);
  }, []);

  // Landing y depends on shot type: short = mid-court, smash = mid-deep,
  // long = deep court. Sampled within the actual playable y range so the
  // receiver can always reach it without leaving its half.
  const getTargetY = useCallback((shotType) => {
    if (shotType === 'short') return sampleRange(0.62, 0.72);
    if (shotType === 'smash' || shotType === 'special') return sampleRange(0.68, 0.80);
    return sampleRange(0.74, 0.84);
  }, []);

  const buildNextShot = useCallback((from, to, shotType) => {
    const state = stateRef.current;
    const shuttle = state.shuttle;
    if (shotType === 'special' && !canUseSpecialShot(from)) {
      shotType = state[from].stamina > 50 ? 'smash' : 'long';
    }
    const profile = SHOT_PROFILES[shotType] || SHOT_PROFILES.long;
    const playerAbility = resolvePlayerAbility(from);
    const playerIsHuman = resolveHumanPlayer(from);

    const fromPlayer = state[from];
    const targetX = getTargetX(to, shotType);
    const targetY = clamp(
      getTargetY(shotType),
      GAMEPLAY_TUNING.courtInBoundsY0,
      GAMEPLAY_TUNING.courtInBoundsY1,
    );

    shuttle.from = from;
    shuttle.to = to;
    shuttle.fromX = clamp(
      fromPlayer.x,
      GAMEPLAY_TUNING.courtInBoundsX0,
      GAMEPLAY_TUNING.courtInBoundsX1,
    );
    shuttle.fromY = clamp(
      fromPlayer.y - GAMEPLAY_TUNING.receiveYOffset,
      GAMEPLAY_TUNING.courtInBoundsY0,
      GAMEPLAY_TUNING.courtInBoundsY1,
    );
    shuttle.targetX = targetX;
    shuttle.targetY = targetY;
    shuttle.z = 0;
    shuttle.progress = 0;
    shuttle.elapsedSec = 0;
    shuttle.flightTimeSec = sampleRange(profile.flightTime[0], profile.flightTime[1]);
    shuttle.flightTimeSec *= GAMEPLAY_TUNING.flightTimeScale;
    shuttle.arc = sampleRange(profile.arc[0], profile.arc[1]);
    shuttle.outOfCourt = false;
    shuttle.contactResolved = false;
    shuttle.shotType = shotType;
    shuttle.illusionSource = null;
    shuttle.illusionEndsAt = 0;

    // Regular shot effort is persistent so fatigue naturally builds up.
    const baseCost = SHOT_STAMINA_COSTS[shotType] ?? 7;
    state[from].stamina = clamp(state[from].stamina - baseCost, 0, 100);
    state[from].lastShotType = shotType;
    if (shotType === 'special') {
      state[from].specialUsed = true;
      addActionLogEntry({
        agent: state[from].name,
        action: 'SPECIAL unleashed',
        color: '#facc15',
      });
    }

    // Lower stamina lowers control and can push targets out or into trouble.
    const fatigue = 1 - staminaRatio(state[from].stamina);
    shuttle.targetX = clamp(
      shuttle.targetX + sampleRange(-1, 1) * (0.006 + fatigue * 0.032),
      GAMEPLAY_TUNING.courtInBoundsX0 - 0.06,
      GAMEPLAY_TUNING.courtInBoundsX1 + 0.06,
    );
    shuttle.targetY = clamp(
      shuttle.targetY + sampleRange(-1, 1) * (0.004 + fatigue * 0.026),
      GAMEPLAY_TUNING.courtInBoundsY0 - 0.05,
      GAMEPLAY_TUNING.courtInBoundsY1 + 0.06,
    );

    // Genuine unforced "long" out: only on long shots, low probability, and
    // we explicitly push the target *past* the back line. The contact
    // resolver decides OUT by checking isInBounds(targetX, targetY) — no
    // more declaring out for shots that landed in the court.
    if (shotType === 'long' && Math.random() < GAMEPLAY_TUNING.longOutChance) {
      const overshoot = sampleRange(GAMEPLAY_TUNING.longOutDistance[0], GAMEPLAY_TUNING.longOutDistance[1]);
      shuttle.targetX += to === 'p1' ? -overshoot : overshoot;
      shuttle.targetY = clamp(
        shuttle.targetY + sampleRange(0.005, 0.02),
        GAMEPLAY_TUNING.courtInBoundsY0 - 0.05,
        GAMEPLAY_TUNING.courtInBoundsY1 + 0.05,
      );
    }
    // Authoritative out flag derives purely from the actual target.
    shuttle.outOfCourt = !isInBounds(shuttle.targetX, shuttle.targetY);

    const deltaX = shuttle.targetX - shuttle.fromX;
    const netProgress = deltaX === 0 ? 0.5 : (GAMEPLAY_TUNING.netX - shuttle.fromX) / deltaX;
    if (netProgress > 0 && netProgress < 1) {
      const netArcFactor = Math.max(0.12, 4 * netProgress * (1 - netProgress));
      const minimumArc = GAMEPLAY_TUNING.minNetClearance / netArcFactor;
      shuttle.arc = Math.max(shuttle.arc, minimumArc);
    }

    analyticsRef.current.shotCounts[shotType] = (analyticsRef.current.shotCounts[shotType] || 0) + 1;

    const triggerSlot = from === 'p1' ? 'abilityTriggerP1' : 'abilityTriggerP2';
    const triggerRequested = controlRef.current[triggerSlot] === true;
    const canUseAbility = canActivateAbility(from);
    const shouldAutoTry = !playerIsHuman;
    const shouldHumanTry = playerIsHuman && triggerRequested;

    let abilityTriggered = false;
    if (shouldHumanTry) {
      if (!canUseAbility) {
        addActionLogEntry({
          agent: state[from].name,
          action: 'Ability preconditions not met',
          color: '#f87171',
        });
      } else {
        abilityTriggered = true;
      }
    }

    if (shouldAutoTry && canUseAbility) {
      const chance = playerAbility === 'super_smash' ? 0.48 : playerAbility === 'speed_burst' ? 0.4 : 0.34;
      abilityTriggered = Math.random() < chance;
    }

    if (abilityTriggered) {
      if (playerAbility === 'speed_burst') {
        state[from].speedBurstUntil = timeRef.current + GAMEPLAY_TUNING.speedBurstDurationSec;
        shuttle.flightTimeSec *= 0.92;
        addActionLogEntry({
          agent: state[from].name,
          action: 'SPEED BURST: movement boost + stamina efficiency',
          color: '#facc15',
        });
      }

      if (playerAbility === 'super_smash' && shotType === 'smash') {
        shuttle.flightTimeSec *= 0.92;
        shuttle.arc *= 1.15;
        addActionLogEntry({
          agent: state[from].name,
          action: 'SUPER SMASH amplified',
          color: '#f59e0b',
        });
      }

      if (playerAbility === 'illusion') {
        shuttle.targetX = clamp(shuttle.targetX + sampleRange(-0.04, 0.04), 0.1, 0.9);
        shuttle.illusionSource = from;
        shuttle.illusionEndsAt = timeRef.current + GAMEPLAY_TUNING.illusionDurationSec;
        state[from].illusionUntil = shuttle.illusionEndsAt;
        addActionLogEntry({
          agent: state[from].name,
          action: 'ILLUSION: decoy shuttle trail deployed',
          color: '#60a5fa',
        });
      }

      if (playerAbility === 'time_slow') {
        state[to].timeSlowUntil = timeRef.current + GAMEPLAY_TUNING.timeSlowDurationSec;
        shuttle.flightTimeSec *= 1.1;
        addActionLogEntry({
          agent: state[from].name,
          action: 'TIME SLOW: opponent reaction disrupted',
          color: '#a78bfa',
        });
      }

      state[from].lastAbilityAt = timeRef.current;
      analyticsRef.current.abilityActivations[from] += 1;
      state[from].stamina = clamp(state[from].stamina - 6, 0, 100);
    }

    controlRef.current[triggerSlot] = false;

    state.currentTurn = to;

    addActionLogEntry({
      agent: from === 'p1' ? state.p1.name : state.p2.name,
      action: `${shotType.toUpperCase()} shot`,
      color: from === 'p1' ? '#4A9EFF' : '#FF6B6B',
    });

    // Kick off backend agent decision for the receiver so it's ready at strike time.
    if (AI_AGENT_TYPES.has(resolveAgentType(to))) {
      requestAgentDecision(to);
    }
  }, [addActionLogEntry, canActivateAbility, canUseSpecialShot, getTargetX, getTargetY, requestAgentDecision, resolveAgentType, resolveHumanPlayer, resolvePlayerAbility]);

  const tryStartWaitingServe = useCallback(() => {
    const state = stateRef.current;
    const waiting = state.waitingServe;
    if (!waiting.active || matchFinishedRef.current) return;

    const server = waiting.server;
    const receiver = waiting.receiver;
    const serverHuman = resolveHumanPlayer(server);
    const p1Human = resolveHumanPlayer('p1');
    const p2Human = resolveHumanPlayer('p2');
    const serveGateTime = waiting.startedAt || 0;

    // Enforce a visible reset pause after a point so players can walk back
    // to the baseline before the serve starts.
    if (waiting.reason === 'point') {
      const elapsed = timeRef.current - waiting.startedAt;
      if (elapsed < GAMEPLAY_TUNING.postPointResetSec) return;
    }

    let serveType = null;

    if (serverHuman) {
      const requested = consumeRequestedShotForPlayer(server, serveGateTime);
      if (!requested) return;
      serveType = requested === 'smash' ? 'long' : requested;
    } else {
      const hasAnyHuman = p1Human || p2Human;
      if (hasAnyHuman) {
        const humanReady = (p1Human && wasHumanRecentlyActive('p1', serveGateTime)) || (p2Human && wasHumanRecentlyActive('p2', serveGateTime));
        if (!humanReady) return;
      }
      serveType = Math.random() < GAMEPLAY_TUNING.serveShortChance ? 'short' : 'long';
    }

    waiting.active = false;
    state.shuttle.active = true;
    buildNextShot(server, receiver, serveType);
  }, [buildNextShot, consumeRequestedShotForPlayer, resolveHumanPlayer, wasHumanRecentlyActive]);

  const buildMatchSummary = useCallback((winner) => {
    const state = stateRef.current;
    const decisionSamples = Math.max(1, analyticsRef.current.decisionSamples);
    const durationSec = Math.max(1, Math.round((Date.now() - matchStartTimeRef.current) / 1000));

    return {
      winner,
      winnerName: winner === 'p1' ? state.p1.name : state.p2.name,
      score: { ...state.score },
      rallyCount: state.rally,
      durationSec,
      averageDecisionMs: Math.round(analyticsRef.current.totalDecisionMs / decisionSamples),
      maxDecisionMs: Math.round(analyticsRef.current.maxDecisionMs),
      abilityActivations: { ...analyticsRef.current.abilityActivations },
      shotCounts: { ...analyticsRef.current.shotCounts },
      strategy: {
        aggression: resolveStrategyValue('aggression', 55),
        defense: resolveStrategyValue('defense', 50),
        risk: resolveStrategyValue('risk', 45),
        depth: resolveStrategyValue('depth', 60),
      },
      setupSnapshot: matchOptionsRef.current?.matchSetup
        ? JSON.parse(JSON.stringify(matchOptionsRef.current.matchSetup))
        : null,
    };
  }, [resolveStrategyValue]);

  const registerPoint = useCallback((winner) => {
    const state = stateRef.current;
    const winnerName = winner === 'p1' ? state.p1.name : state.p2.name;
    const configuredTarget = Number(matchOptionsRef.current?.targetScore || 5);

    state.score[winner] += 1;
    state[winner].pointsWon += 1;
    const loser = winner === 'p1' ? 'p2' : 'p1';
    state[loser].successShots = 0;
    state.rally += 1;
    state.shotCount = 0;
    state.p1.stamina = 100;
    state.p2.stamina = 100;
    // Special is limited per rally, not for the entire match.
    state.p1.specialUsed = false;
    state.p2.specialUsed = false;
    state.p1.speedBurstUntil = 0;
    state.p2.speedBurstUntil = 0;
    state.p1.timeSlowUntil = 0;
    state.p2.timeSlowUntil = 0;
    state.p1.illusionUntil = 0;
    state.p2.illusionUntil = 0;
    const lockedArenaIndex = resolveArenaIndex();
    state.stadiumIndex = lockedArenaIndex ?? (state.rally % STADIUMS.length);

    spawnScoreParticles(state.shuttle.x, state.shuttle.y);
    addActionLogEntry({
      agent: 'System',
      action: `Rally ${state.rally}: point for ${winnerName}`,
      color: '#C9A84C',
    });

    const p1Score = state.score.p1;
    const p2Score = state.score.p2;
    const leadingScore = Math.max(p1Score, p2Score);
    const hasWinner = leadingScore >= configuredTarget;

    if (hasWinner && !matchFinishedRef.current) {
      matchFinishedRef.current = true;
      state.shuttle.active = false;

      const summary = buildMatchSummary(winner);
      setMatchComplete(true);
      setMatchSummary(summary);
      setAnalytics({
        averageDecisionMs: summary.averageDecisionMs,
        maxDecisionMs: summary.maxDecisionMs,
        abilityActivations: { ...summary.abilityActivations },
        shotCounts: { ...summary.shotCounts },
      });

      addActionLogEntry({
        agent: 'System',
        action: `MATCH COMPLETE: ${summary.winnerName} wins ${summary.score.p1}-${summary.score.p2}`,
        color: '#34d399',
      });

      pauseRef.current();
      if (typeof onMatchCompleteRef.current === 'function') {
        onMatchCompleteRef.current(summary);
      }
      return;
    }

    const server = winner;
    const receiver = winner === 'p1' ? 'p2' : 'p1';

    state.p1.hitTime = 0;
    state.p1.jumpTime = 0;
    state.p2.hitTime = 0;
    state.p2.jumpTime = 0;

    state.shuttle.x = state[server].x;
    state.shuttle.y = state[server].y;
    state.shuttle.prevX = state.shuttle.x;
    state.shuttle.prevY = state.shuttle.y;
    state.shuttle.trail = [];
    state.shuttle.active = false;
    state.shuttle.contactResolved = false;
    state.shuttle.illusionSource = null;
    state.shuttle.illusionEndsAt = 0;
    state.waitingServe.active = true;
    state.waitingServe.server = server;
    state.waitingServe.receiver = receiver;
    state.waitingServe.reason = 'point';
    state.waitingServe.startedAt = timeRef.current;

    controlRef.current.requestedShotP1 = null;
    controlRef.current.requestedShotP2 = null;

    addActionLogEntry({
      agent: 'System',
      action: `Rally stopped. Awaiting serve from ${state[server].name}`,
      color: '#93c5fd',
    });
  }, [addActionLogEntry, buildMatchSummary, resolveArenaIndex, spawnScoreParticles]);

  const updatePlayers = useCallback((dtSec) => {
    const state = stateRef.current;
    const shuttle = state.shuttle;
    const p1PrevX = state.p1.x;
    const p1PrevY = state.p1.y;
    const p2PrevX = state.p2.x;
    const p2PrevY = state.p2.y;
    const manualEnabled = resolveManualControlEnabled();
    const waiting = state.waitingServe;
    const inResetWindow = waiting.active
      && waiting.reason === 'point'
      && (timeRef.current - waiting.startedAt) < GAMEPLAY_TUNING.postPointResetSec;

    const p1Receiving = shuttle.to === 'p1' && shuttle.active;
    const p2Receiving = shuttle.to === 'p2' && shuttle.active;
    const now = timeRef.current;
    const p1SpeedBurst = isEffectActive(state.p1.speedBurstUntil, now);
    const p2SpeedBurst = isEffectActive(state.p2.speedBurstUntil, now);
    const p1TimeSlowed = isEffectActive(state.p1.timeSlowUntil, now);
    const p2TimeSlowed = isEffectActive(state.p2.timeSlowUntil, now);

    // While in post-point reset, both players walk back to their home
    // baseline so the rally start is visually clear.
    const homeP1X = GAMEPLAY_TUNING.leftHalfCenterX;
    const homeP2X = GAMEPLAY_TUNING.rightHalfCenterX;
    const homeY = GAMEPLAY_TUNING.baselineY;
    const [p1MinX, p1MaxX] = GAMEPLAY_TUNING.playerBoundsX.p1;
    const [p2MinX, p2MaxX] = GAMEPLAY_TUNING.playerBoundsX.p2;
    const [pMinY, pMaxY] = GAMEPLAY_TUNING.playerBoundsY;

    const wobbleX1 = Math.sin(timeRef.current * 0.95) * GAMEPLAY_TUNING.xTrackAmplitude;
    const wobbleX2 = Math.cos(timeRef.current * 0.95) * GAMEPLAY_TUNING.xTrackAmplitude;
    const wobbleY1 = Math.sin(timeRef.current * 0.75) * GAMEPLAY_TUNING.yTrackAmplitude;
    const wobbleY2 = Math.cos(timeRef.current * 0.75) * GAMEPLAY_TUNING.yTrackAmplitude;

    let p1TargetX;
    let p1TargetY;
    let p2TargetX;
    let p2TargetY;

    if (inResetWindow) {
      p1TargetX = homeP1X;
      p2TargetX = homeP2X;
      p1TargetY = homeY;
      p2TargetY = homeY;
    } else {
      p1TargetX = p1Receiving
        ? clamp(shuttle.targetX, p1MinX, p1MaxX)
        : clamp(homeP1X + wobbleX1, p1MinX, p1MaxX);
      p2TargetX = p2Receiving
        ? clamp(shuttle.targetX, p2MinX, p2MaxX)
        : clamp(homeP2X + wobbleX2, p2MinX, p2MaxX);
      p1TargetY = p1Receiving
        ? clamp(shuttle.targetY + GAMEPLAY_TUNING.receiveYOffset, pMinY, pMaxY)
        : clamp(homeY + wobbleY1, pMinY, pMaxY);
      p2TargetY = p2Receiving
        ? clamp(shuttle.targetY + GAMEPLAY_TUNING.receiveYOffset, pMinY, pMaxY)
        : clamp(homeY + wobbleY2, pMinY, pMaxY);
    }

    const p1Human = manualEnabled && resolveHumanPlayer('p1');
    const p2Human = manualEnabled && resolveHumanPlayer('p2');

    if (p1Human) {
      const inputX = (controlRef.current.rightP1 ? 1 : 0) - (controlRef.current.leftP1 ? 1 : 0);
      const inputY = (controlRef.current.downP1 ? 1 : 0) - (controlRef.current.upP1 ? 1 : 0);

      state.p1.vx += inputX * GAMEPLAY_TUNING.manualAcceleration * dtSec;
      state.p1.vy += inputY * GAMEPLAY_TUNING.manualAcceleration * dtSec;

      const damping = Math.exp(-GAMEPLAY_TUNING.manualDrag * dtSec);
      state.p1.vx *= damping;
      state.p1.vy *= damping;

      const speed = Math.hypot(state.p1.vx, state.p1.vy);
      const p1ManualMax = movementSpeedForStamina(
        GAMEPLAY_TUNING.manualMaxSpeed,
        GAMEPLAY_TUNING.manualMinSpeed,
        state.p1.stamina,
      );
      const p1ExhaustedScale = state.p1.stamina <= GAMEPLAY_TUNING.lowStaminaSlowThreshold ? 0.45 : 1;
      const p1ManualCap = p1ManualMax * p1ExhaustedScale;
      const p1ManualBuffedCap = p1ManualCap
        * (p1SpeedBurst ? GAMEPLAY_TUNING.speedBurstMoveMultiplier : 1)
        * (p1TimeSlowed ? GAMEPLAY_TUNING.timeSlowMoveMultiplier : 1);
      if (speed > p1ManualBuffedCap) {
        const scale = p1ManualBuffedCap / Math.max(0.0001, speed);
        state.p1.vx *= scale;
        state.p1.vy *= scale;
      }

      state.p1.x = clamp(state.p1.x + state.p1.vx * dtSec, p1MinX, p1MaxX);
      state.p1.y = clamp(state.p1.y + state.p1.vy * dtSec, pMinY, pMaxY);

      if (state.p1.x <= p1MinX + 0.001 || state.p1.x >= p1MaxX - 0.001) state.p1.vx *= 0.25;
      if (state.p1.y <= pMinY + 0.001 || state.p1.y >= pMaxY - 0.001) state.p1.vy *= 0.25;
    } else {
      state.p1.vx = 0;
      state.p1.vy = 0;
      const p1AiSpeed = movementSpeedForStamina(
        GAMEPLAY_TUNING.aiMaxMoveSpeed,
        GAMEPLAY_TUNING.aiMinMoveSpeed,
        state.p1.stamina,
      );
      const p1AiCap = p1AiSpeed * (state.p1.stamina <= GAMEPLAY_TUNING.lowStaminaSlowThreshold ? 0.42 : 1);
      const p1AiCapWithEffects = p1AiCap
        * (p1SpeedBurst ? GAMEPLAY_TUNING.speedBurstMoveMultiplier : 1)
        * (p1TimeSlowed ? GAMEPLAY_TUNING.timeSlowMoveMultiplier : 1);
      const p1XResponse = GAMEPLAY_TUNING.xResponse * (p1TimeSlowed ? GAMEPLAY_TUNING.timeSlowResponseMultiplier : 1);
      const p1YResponse = GAMEPLAY_TUNING.yResponse * (p1TimeSlowed ? GAMEPLAY_TUNING.timeSlowResponseMultiplier : 1);
      state.p1.x = smoothApproachWithSpeedCap(
        state.p1.x,
        p1TargetX,
        p1XResponse,
        p1AiCapWithEffects,
        dtSec,
      );
      state.p1.y = smoothApproachWithSpeedCap(
        state.p1.y,
        p1TargetY,
        p1YResponse,
        p1AiCapWithEffects,
        dtSec,
      );
    }

    if (p2Human) {
      const inputX = (controlRef.current.rightP2 ? 1 : 0) - (controlRef.current.leftP2 ? 1 : 0);
      const inputY = (controlRef.current.downP2 ? 1 : 0) - (controlRef.current.upP2 ? 1 : 0);

      state.p2.vx += inputX * GAMEPLAY_TUNING.manualAcceleration * dtSec;
      state.p2.vy += inputY * GAMEPLAY_TUNING.manualAcceleration * dtSec;

      const damping = Math.exp(-GAMEPLAY_TUNING.manualDrag * dtSec);
      state.p2.vx *= damping;
      state.p2.vy *= damping;

      const speed = Math.hypot(state.p2.vx, state.p2.vy);
      const p2ManualMax = movementSpeedForStamina(
        GAMEPLAY_TUNING.manualMaxSpeed,
        GAMEPLAY_TUNING.manualMinSpeed,
        state.p2.stamina,
      );
      const p2ExhaustedScale = state.p2.stamina <= GAMEPLAY_TUNING.lowStaminaSlowThreshold ? 0.45 : 1;
      const p2ManualCap = p2ManualMax * p2ExhaustedScale;
      const p2ManualBuffedCap = p2ManualCap
        * (p2SpeedBurst ? GAMEPLAY_TUNING.speedBurstMoveMultiplier : 1)
        * (p2TimeSlowed ? GAMEPLAY_TUNING.timeSlowMoveMultiplier : 1);
      if (speed > p2ManualBuffedCap) {
        const scale = p2ManualBuffedCap / Math.max(0.0001, speed);
        state.p2.vx *= scale;
        state.p2.vy *= scale;
      }

      state.p2.x = clamp(state.p2.x + state.p2.vx * dtSec, p2MinX, p2MaxX);
      state.p2.y = clamp(state.p2.y + state.p2.vy * dtSec, pMinY, pMaxY);

      if (state.p2.x <= p2MinX + 0.001 || state.p2.x >= p2MaxX - 0.001) state.p2.vx *= 0.25;
      if (state.p2.y <= pMinY + 0.001 || state.p2.y >= pMaxY - 0.001) state.p2.vy *= 0.25;
    } else {
      state.p2.vx = 0;
      state.p2.vy = 0;
      const p2AiSpeed = movementSpeedForStamina(
        GAMEPLAY_TUNING.aiMaxMoveSpeed,
        GAMEPLAY_TUNING.aiMinMoveSpeed,
        state.p2.stamina,
      );
      const p2AiCap = p2AiSpeed * (state.p2.stamina <= GAMEPLAY_TUNING.lowStaminaSlowThreshold ? 0.42 : 1);
      const p2AiCapWithEffects = p2AiCap
        * (p2SpeedBurst ? GAMEPLAY_TUNING.speedBurstMoveMultiplier : 1)
        * (p2TimeSlowed ? GAMEPLAY_TUNING.timeSlowMoveMultiplier : 1);
      const p2XResponse = GAMEPLAY_TUNING.xResponse * (p2TimeSlowed ? GAMEPLAY_TUNING.timeSlowResponseMultiplier : 1);
      const p2YResponse = GAMEPLAY_TUNING.yResponse * (p2TimeSlowed ? GAMEPLAY_TUNING.timeSlowResponseMultiplier : 1);
      state.p2.x = smoothApproachWithSpeedCap(
        state.p2.x,
        p2TargetX,
        p2XResponse,
        p2AiCapWithEffects,
        dtSec,
      );
      state.p2.y = smoothApproachWithSpeedCap(
        state.p2.y,
        p2TargetY,
        p2YResponse,
        p2AiCapWithEffects,
        dtSec,
      );
    }

    state.p1.hitTime = Math.max(0, state.p1.hitTime - dtSec);
    state.p2.hitTime = Math.max(0, state.p2.hitTime - dtSec);
    state.p1.jumpTime = Math.max(0, state.p1.jumpTime - dtSec);
    state.p2.jumpTime = Math.max(0, state.p2.jumpTime - dtSec);
    if (state.p1.jumpTime <= 0) state.p1.smashing = false;
    if (state.p2.jumpTime <= 0) state.p2.smashing = false;

    if (!inResetWindow) {
      const p1MoveDist = Math.hypot(state.p1.x - p1PrevX, state.p1.y - p1PrevY);
      const p2MoveDist = Math.hypot(state.p2.x - p2PrevX, state.p2.y - p2PrevY);
      const p1DrainMultiplier = p1Receiving ? GAMEPLAY_TUNING.receiveMovementDrainMultiplier : 1;
      const p2DrainMultiplier = p2Receiving ? GAMEPLAY_TUNING.receiveMovementDrainMultiplier : 1;
      const p1Drain = p1MoveDist * GAMEPLAY_TUNING.movementStaminaDrain * p1DrainMultiplier;
      const p2Drain = p2MoveDist * GAMEPLAY_TUNING.movementStaminaDrain * p2DrainMultiplier;
      const p1DrainWithEffects = p1Drain * (p1SpeedBurst ? GAMEPLAY_TUNING.speedBurstDrainMultiplier : 1);
      const p2DrainWithEffects = p2Drain * (p2SpeedBurst ? GAMEPLAY_TUNING.speedBurstDrainMultiplier : 1);
      state.p1.stamina = clamp(state.p1.stamina - p1DrainWithEffects, 0, 100);
      state.p2.stamina = clamp(state.p2.stamina - p2DrainWithEffects, 0, 100);
    }

  }, [resolveHumanPlayer, resolveManualControlEnabled]);

  const updateShuttle = useCallback((dtSec) => {
    const state = stateRef.current;
    const shuttle = state.shuttle;
    const manualEnabled = resolveManualControlEnabled();

    shuttle.prevX = shuttle.x;
    shuttle.prevY = shuttle.y;

    shuttle.elapsedSec += dtSec;
    shuttle.progress = Math.min(1, shuttle.elapsedSec / Math.max(0.12, shuttle.flightTimeSec));
    shuttle.x = lerp(shuttle.fromX, shuttle.targetX, shuttle.progress);
    shuttle.y = lerp(shuttle.fromY, shuttle.targetY, shuttle.progress);
    shuttle.z = shuttleHeightAtProgress(shuttle.progress, shuttle.arc);

    shuttle.trail.push({ x: shuttle.x, y: shuttle.y - shuttle.z, life: 1 });
    if (shuttle.trail.length > GAMEPLAY_TUNING.trailLength) shuttle.trail.shift();

    for (let i = 0; i < shuttle.trail.length; i++) {
      shuttle.trail[i].life -= GAMEPLAY_TUNING.trailFadeRate;
    }

    const shouldEvaluateContact = !shuttle.contactResolved && shuttle.progress >= GAMEPLAY_TUNING.strikeProgress;
    if (shouldEvaluateContact) {
      const receiver = shuttle.to;
      const sender = shuttle.from;
      const nextTarget = receiver === 'p1' ? 'p2' : 'p1';
      const receiverState = state[receiver];
      const receiverHuman = manualEnabled && resolveHumanPlayer(receiver);
      const manualShot = receiverHuman ? consumeRequestedShotForPlayer(receiver) : null;
      const nextType = receiverHuman ? manualShot : pickShotType(receiver);
      const profile = nextType ? SHOT_PROFILES[nextType] : null;

      if (receiverState.stamina <= GAMEPLAY_TUNING.criticalStaminaNoHitThreshold) {
        const forcedFail = Math.random() < GAMEPLAY_TUNING.exhaustedHitFailChance;
        if (forcedFail) {
          const winner = sender;
          shuttle.contactResolved = true;
          state[receiver].successShots = 0;
          pushFeedback('miss', shuttle.x, shuttle.y - 0.03, 'NO STAMINA', '#ef4444');
          addActionLogEntry({
            agent: 'System',
            action: `NO STAMINA by ${state[receiver].name} -> point for ${state[winner].name}`,
            color: '#ef4444',
          });
          registerPoint(winner);
          return;
        }
      }

      const landingOut = shuttle.outOfCourt || !isInBounds(shuttle.targetX, shuttle.targetY);
      if (landingOut) {
        const winner = sender;
        shuttle.contactResolved = true;
        pushFeedback('miss', shuttle.x, shuttle.y - Math.max(0.03, shuttle.z * 0.5), 'OUT', '#fb923c');
        addActionLogEntry({
          agent: 'System',
          action: `OUT by ${state[receiver].name} -> point for ${state[winner].name}`,
          color: '#f59e0b',
        });
        registerPoint(winner);
        return;
      }

      const deltaX = shuttle.targetX - shuttle.fromX;
      const netProgress = deltaX === 0 ? 0.5 : (GAMEPLAY_TUNING.netX - shuttle.fromX) / deltaX;
      const netHeight = netProgress > 0 && netProgress < 1
        ? shuttleHeightAtProgress(netProgress, shuttle.arc)
        : shuttle.z;

      if (netHeight < GAMEPLAY_TUNING.netFaultThreshold) {
        shuttle.contactResolved = true;
        pushFeedback('miss', GAMEPLAY_TUNING.netX, shuttle.y - 0.02, 'NET', '#fb7185');
        addActionLogEntry({
          agent: 'System',
          action: `NET fault by ${state[sender].name} -> point for ${state[receiver].name}`,
          color: '#fb7185',
        });
        registerPoint(receiver);
        return;
      }

      const distance = Math.hypot(receiverState.x - shuttle.x, receiverState.y - shuttle.y);
      const reachBase = receiverHuman ? GAMEPLAY_TUNING.humanReachDistance : GAMEPLAY_TUNING.aiReachDistance;
      const reachPenalty = (shuttle.shotType === 'smash' || shuttle.shotType === 'special')
        ? GAMEPLAY_TUNING.smashReachPenalty
        : 0;
      const receiverFatigue = 1 - staminaRatio(receiverState.stamina);
      const staminaReachPenalty = receiverFatigue * 0.05;
      const reach = reachBase - reachPenalty - staminaReachPenalty;

      if (!nextType || distance > reach) {
        const winner = sender;
        shuttle.contactResolved = true;
        state[receiver].successShots = 0;
        pushFeedback('miss', shuttle.x, shuttle.y - 0.03, 'MISS', '#f87171');
        addActionLogEntry({
          agent: 'System',
          action: `MISS by ${state[receiver].name} (distance ${distance.toFixed(2)}) -> point for ${state[winner].name}`,
          color: '#f87171',
        });
        registerPoint(winner);
        return;
      }

      const distancePressure = clamp((distance - reach * 0.5) / Math.max(0.01, reach), 0, 1);
      const shotPressure = shuttle.shotType === 'special'
        ? 0.09
        : shuttle.shotType === 'smash'
          ? 0.06
          : 0.03;
      const rallyPressure = clamp(state.shotCount / 18, 0, 1);
      const errorChance = clamp(
        GAMEPLAY_TUNING.baseMistakeChance
        + GAMEPLAY_TUNING.mistakeGrowthPerShot * rallyPressure * 7
        + GAMEPLAY_TUNING.fatigueMistakeFactor * receiverFatigue
        + GAMEPLAY_TUNING.distanceMistakeFactor * distancePressure
        + shotPressure,
        0,
        0.72,
      );
      if (Math.random() < errorChance) {
        const winner = sender;
        shuttle.contactResolved = true;
        state[receiver].successShots = 0;
        const label = receiverState.stamina < GAMEPLAY_TUNING.lowStaminaMoveThreshold ? 'LATE MISS' : 'ERROR';
        pushFeedback('miss', shuttle.x, shuttle.y - 0.03, label, '#fb7185');
        addActionLogEntry({
          agent: 'System',
          action: `${label} by ${state[receiver].name} (fatigue ${(receiverFatigue * 100).toFixed(0)}%) -> point for ${state[winner].name}`,
          color: '#fb7185',
        });
        registerPoint(winner);
        return;
      }

      state[receiver].hitTime = GAMEPLAY_TUNING.hitPoseDuration;
      state[receiver].jumpDuration = profile.jumpTime;
      state[receiver].jumpTime = profile.jumpTime;
      state[receiver].jumpPower = profile.jumpPower;
      state[receiver].smashing = Boolean(profile.isSmash);
      state[receiver].lastShotType = nextType;
      if (nextType === 'special') state[receiver].specialUsed = true;
      state[receiver].successShots += 1;
      const successfulRecovery = nextType === 'special'
        ? GAMEPLAY_TUNING.successfulHitStaminaRecovery * 0.45
        : GAMEPLAY_TUNING.successfulHitStaminaRecovery;
      state[receiver].stamina = clamp(state[receiver].stamina + successfulRecovery, 0, 100);
      shuttle.contactResolved = true;
      const hitColor = HIT_HIGHLIGHT_COLORS[nextType] || '#4ade80';
      pushFeedback('hit', shuttle.x, shuttle.y - Math.max(0.04, shuttle.z * 0.65), `${nextType.toUpperCase()} HIT`, hitColor);
      addActionLogEntry({
        agent: state[receiver].name,
        action: `${nextType.toUpperCase()} contact`,
        color: receiver === 'p1' ? '#4A9EFF' : '#FF6B6B',
      });
      state.shotCount += 1;

      buildNextShot(receiver, nextTarget, nextType);
    }
  }, [addActionLogEntry, buildNextShot, consumeRequestedShotForPlayer, pickShotType, pushFeedback, registerPoint, resolveHumanPlayer, resolveManualControlEnabled]);

  const updateParticles = useCallback((dtSec) => {
    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      const frameScale = dtSec * 60;
      particles[i].life -= 0.018 * frameScale;
      particles[i].x += particles[i].vx * frameScale;
      particles[i].y += particles[i].vy * frameScale;
      particles[i].vy += 0.00008 * frameScale;
      if (particles[i].life <= 0) particles.splice(i, 1);
    }
  }, []);

  const updateFeedback = useCallback((dtSec) => {
    const effects = feedbackRef.current;
    for (let i = effects.length - 1; i >= 0; i--) {
      effects[i].life -= dtSec;
      if (effects[i].life <= 0) {
        effects.splice(i, 1);
      }
    }
  }, []);

  const updateHud = useCallback(() => {
    const state = stateRef.current;
    state.p1.name = resolvePlayerName('p1', state.p1.name || 'Minimax');
    state.p2.name = resolvePlayerName('p2', state.p2.name || 'MCTS');
    const baseDecision = GAMEPLAY_TUNING.decisionBaseMs + Math.abs(Math.sin(timeRef.current * 1.35)) * GAMEPLAY_TUNING.decisionSwingMs;
    let adjustment = 0;
    if (state.currentTurn === 'p1' && isEffectActive(state.p1.timeSlowUntil, timeRef.current)) {
      adjustment += GAMEPLAY_TUNING.timeSlowDecisionPenaltyMs;
    }
    if (state.currentTurn === 'p2' && isEffectActive(state.p2.timeSlowUntil, timeRef.current)) {
      adjustment += GAMEPLAY_TUNING.timeSlowDecisionPenaltyMs;
    }

    const backendMs = backendDecisionTimeRef.current;
    state.decisionTime = backendMs > 0
      ? Math.round(backendMs)
      : Math.floor(baseDecision + adjustment);
    analyticsRef.current.totalDecisionMs += state.decisionTime;
    analyticsRef.current.decisionSamples += 1;
    analyticsRef.current.maxDecisionMs = Math.max(analyticsRef.current.maxDecisionMs, state.decisionTime);

    setHudState({
      p1Score: state.score.p1,
      p2Score: state.score.p2,
      rally: state.rally,
      p1Stamina: safeStamina(state.p1.stamina),
      p2Stamina: safeStamina(state.p2.stamina),
      decisionTime: state.decisionTime,
      p1Name: state.p1.name,
      p2Name: state.p2.name,
    });
  }, [resolvePlayerName]);

  const drawBackground = useCallback((ctx, displayW, displayH) => {
    const state = stateRef.current;
    const stadiumName = STADIUMS[state.stadiumIndex];
    const image = assetCacheRef.current.get(stadiumName);

    if (image) {
      ctx.drawImage(image, 0, 0, displayW, displayH);
      ctx.fillStyle = 'rgba(13, 13, 18, 0.34)';
      ctx.fillRect(0, 0, displayW, displayH);
      return;
    }

    const gradient = ctx.createLinearGradient(0, 0, 0, displayH);
    gradient.addColorStop(0, '#15151D');
    gradient.addColorStop(1, '#0D0D12');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, displayW, displayH);
  }, []);

  const drawCourt = useCallback((ctx, court) => {
    if (!court || !court.w || !court.h) return;

    const x0 = court.x + GAMEPLAY_TUNING.courtInBoundsX0 * court.w;
    const x1 = court.x + GAMEPLAY_TUNING.courtInBoundsX1 * court.w;
    const y0 = court.y + GAMEPLAY_TUNING.courtInBoundsY0 * court.h;
    const y1 = court.y + GAMEPLAY_TUNING.courtInBoundsY1 * court.h;
    const w = x1 - x0;
    const h = y1 - y0;
    const netX = court.x + GAMEPLAY_TUNING.netX * court.w;
    const netTopY = y0 - GAMEPLAY_TUNING.netHeight * court.h;
    const netBottomY = (y0 + y1) / 2;

    ctx.save();

    // Subtle court boundary glow.
    ctx.strokeStyle = 'rgba(250, 248, 245, 0.35)';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(x0, y0, w, h);

    // Service / mid line.
    ctx.beginPath();
    ctx.moveTo(x0, (y0 + y1) / 2);
    ctx.lineTo(x1, (y0 + y1) / 2);
    ctx.strokeStyle = 'rgba(250, 248, 245, 0.18)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Net post + tape.
    const gradient = ctx.createLinearGradient(netX, netTopY, netX, netBottomY);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.85)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.25)');
    ctx.strokeStyle = gradient;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(netX, netTopY);
    ctx.lineTo(netX, netBottomY);
    ctx.stroke();

    // Net mesh (thin diagonal hatch).
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 0.6;
    const meshTop = netTopY;
    const meshBottom = (y0 + y1) / 2;
    const meshHalfW = Math.min(60, w * 0.08);
    ctx.beginPath();
    for (let i = -meshHalfW; i <= meshHalfW; i += 6) {
      ctx.moveTo(netX + i, meshTop);
      ctx.lineTo(netX + i, meshBottom);
    }
    ctx.stroke();

    ctx.restore();
  }, []);

  const drawShuttleTrail = useCallback((ctx, court, trail) => {
    for (let i = 0; i < trail.length; i++) {
      const t = trail[i];
      if (t.life <= 0) continue;
      const tx = court.x + t.x * court.w;
      const ty = court.y + t.y * court.h;
      ctx.beginPath();
      ctx.arc(tx, ty, 5 * t.life, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(201, 168, 76, ${t.life * 0.35})`;
      ctx.fill();
    }
  }, []);

  const getJumpOffset = useCallback((player) => {
    if (player.jumpTime <= 0 || player.jumpDuration <= 0) return 0;
    const progress = 1 - (player.jumpTime / player.jumpDuration);
    // Smash jumps use a sharper rise + slower fall to look like a leap;
    // other shots keep the smooth sine for a soft hop.
    if (player.smashing) {
      // 0..0.4 quick rise, 0.4..1 longer hangtime/fall
      const lift = progress < 0.4
        ? Math.sin((progress / 0.4) * (Math.PI / 2))
        : Math.cos(((progress - 0.4) / 0.6) * (Math.PI / 2));
      return Math.max(0, lift) * (player.jumpPower + GAMEPLAY_TUNING.smashJumpLift);
    }
    return Math.sin(progress * Math.PI) * player.jumpPower;
  }, []);

  const resolvePose = useCallback((playerKey) => {
    const state = stateRef.current;
    const player = state[playerKey];
    const shuttle = state.shuttle;

    if (player.hitTime > GAMEPLAY_TUNING.hitPoseStrongWindow) return 'hit';
    if (player.hitTime > 0) return 'hitStance';

    if (shuttle.to === playerKey && shuttle.progress > GAMEPLAY_TUNING.prepPoseProgress) return 'hitStance';
    return 'stance';
  }, []);

  const drawFallbackPlayer = useCallback((ctx, px, py) => {
    ctx.fillStyle = 'rgba(250, 248, 245, 0.88)';
    ctx.beginPath();
    ctx.arc(px, py - 24, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(px - 16, py - 10, 32, 46);
  }, []);

  const drawPlayer = useCallback((ctx, court, playerKey) => {
    const state = stateRef.current;
    const player = state[playerKey];
    const jumpOffset = getJumpOffset(player);
    const side = playerKey === 'p1' ? 'right' : 'left';
    const pose = resolvePose(playerKey);
    const ability = resolvePlayerAbility(playerKey);
    const skinIndex = ABILITY_SKIN_INDEX[ability] ?? DEFAULT_SKIN_INDEX;
    const skin = PLAYER_SKINS[skinIndex];
    const imageName = skin[side][pose];
    const image = assetCacheRef.current.get(imageName);
    const arenaTuning = ARENA_TUNING[STADIUMS[state.stadiumIndex]] || ARENA_TUNING[STADIUMS[0]];

    const px = court.x + player.x * court.w;
    const py = court.y + (player.y + arenaTuning.playerGroundOffset - jumpOffset) * court.h;

    const shadowScale = 1 - Math.min(0.55, jumpOffset * 5.5);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(px, py + court.h * 0.08, court.w * 0.03 * shadowScale, court.h * 0.02 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (!image) {
      drawFallbackPlayer(ctx, px, py);
      return;
    }

    const depthScale = GAMEPLAY_TUNING.playerDepthBase + (player.y - 0.6) * GAMEPLAY_TUNING.playerDepthGain;
    const baseHeight = court.h * GAMEPLAY_TUNING.playerSpriteHeight * depthScale * arenaTuning.playerScale;
    const scale = pose === 'hit' ? 1.09 : pose === 'hitStance' ? 1.04 : 1;
    const drawHeight = baseHeight * scale;
    const drawWidth = drawHeight * (image.naturalWidth / image.naturalHeight);

    if (player.hitTime > 0) {
      const alpha = clamp(player.hitTime / GAMEPLAY_TUNING.hitPoseDuration, 0, 1);
      const hitColor = HIT_HIGHLIGHT_COLORS[player.lastShotType] || '#93c5fd';
      ctx.strokeStyle = `${hitColor}${Math.floor(alpha * 180).toString(16).padStart(2, '0')}`;
      ctx.lineWidth = 2 + alpha * 2;
      ctx.beginPath();
      ctx.ellipse(px, py - drawHeight * 0.3, drawWidth * 0.34, drawHeight * 0.2, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.drawImage(image, px - drawWidth / 2, py - drawHeight * GAMEPLAY_TUNING.playerAnchor, drawWidth, drawHeight);
  }, [drawFallbackPlayer, getJumpOffset, resolvePlayerAbility, resolvePose]);

  const drawShuttle = useCallback((ctx, court) => {
    const shuttle = stateRef.current.shuttle;
    const state = stateRef.current;
    const image = assetCacheRef.current.get(SHUTTLE_FILE);
    if (!shuttle.active) return;

    const arenaTuning = ARENA_TUNING[STADIUMS[state.stadiumIndex]] || ARENA_TUNING[STADIUMS[0]];

    const sx = court.x + shuttle.x * court.w;
    const sy = court.y + (shuttle.y - shuttle.z) * court.h;
    const dx = shuttle.x - shuttle.prevX;
    const dy = shuttle.y - shuttle.prevY;
    const rotation = Math.atan2(dy, dx);
    const size = court.h * GAMEPLAY_TUNING.shuttleSize * arenaTuning.shuttleScale;
    const illusionActive = shuttle.illusionSource
      && isEffectActive(shuttle.illusionEndsAt, timeRef.current)
      && shuttle.progress <= 0.72;
    const perpX = -Math.sin(rotation);
    const perpY = Math.cos(rotation);
    const ghostOffset = court.w * GAMEPLAY_TUNING.illusionSpread;

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rotation);

    ctx.fillStyle = 'rgba(201, 168, 76, 0.28)';
    ctx.beginPath();
    ctx.arc(0, 0, size * 0.6, 0, Math.PI * 2);
    ctx.fill();

    if (image) {
      ctx.drawImage(image, -size / 2, -size / 2, size, size);
    } else {
      ctx.fillStyle = '#C9A84C';
      ctx.beginPath();
      ctx.arc(0, 0, size * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();

    if (illusionActive) {
      const drawGhost = (offsetSign) => {
        const gx = sx + perpX * ghostOffset * offsetSign;
        const gy = sy + perpY * ghostOffset * offsetSign;
        ctx.save();
        ctx.translate(gx, gy);
        ctx.rotate(rotation);
        ctx.filter = 'blur(1px)';
        ctx.globalAlpha = 0.42;
        ctx.fillStyle = 'rgba(173, 216, 255, 0.55)';
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.52, 0, Math.PI * 2);
        ctx.fill();
        if (image) {
          ctx.drawImage(image, -size / 2, -size / 2, size, size);
        }
        ctx.restore();
      };
      drawGhost(-1);
      drawGhost(1);
    }
  }, []);

  const drawParticles = useCallback((ctx, court) => {
    for (const particle of particlesRef.current) {
      const px = court.x + particle.x * court.w;
      const py = court.y + particle.y * court.h;
      ctx.beginPath();
      ctx.arc(px, py, 2.3 * particle.life, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(201, 168, 76, ${particle.life})`;
      ctx.fill();
    }
  }, []);

  const drawFeedback = useCallback((ctx, court) => {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 12px "JetBrains Mono", monospace';
    for (const fx of feedbackRef.current) {
      const alpha = clamp(fx.life / Math.max(0.01, fx.ttl), 0, 1);
      const px = court.x + fx.x * court.w;
      const py = court.y + fx.y * court.h - (1 - alpha) * 18;
      ctx.fillStyle = `rgba(13, 13, 18, ${0.6 * alpha})`;
      ctx.fillRect(px - 38, py - 11, 76, 22);
      ctx.fillStyle = fx.color || '#f8fafc';
      ctx.fillText(fx.text, px, py + 1);
    }
  }, []);

  const drawLoading = useCallback((ctx, displayW, displayH) => {
    ctx.fillStyle = '#0D0D12';
    ctx.fillRect(0, 0, displayW, displayH);
    ctx.fillStyle = 'rgba(250, 248, 245, 0.92)';
    ctx.font = '13px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('Loading arena assets...', displayW / 2, displayH / 2);
  }, []);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const displayW = canvas.width / dpr;
    const displayH = canvas.height / dpr;
    const court = courtRef.current;

    if (!assetsReadyRef.current) {
      drawLoading(ctx, displayW, displayH);
      return;
    }

    drawBackground(ctx, displayW, displayH);
    drawCourt(ctx, court);
    drawShuttleTrail(ctx, court, stateRef.current.shuttle.trail);
    drawPlayer(ctx, court, 'p1');
    drawPlayer(ctx, court, 'p2');
    drawShuttle(ctx, court);
    drawParticles(ctx, court);
    drawFeedback(ctx, court);
  }, [canvasRef, drawBackground, drawCourt, drawFeedback, drawLoading, drawParticles, drawPlayer, drawShuttle, drawShuttleTrail]);

  const update = useCallback((dtSec) => {
    if (!assetsReadyRef.current) return;
    if (matchFinishedRef.current) return;

    tryStartWaitingServe();

    updatePlayers(dtSec);
    if (!stateRef.current.waitingServe.active && stateRef.current.shuttle.active) {
      updateShuttle(dtSec);
    }
    updateParticles(dtSec);
    updateFeedback(dtSec);
    updateHud();
  }, [tryStartWaitingServe, updateFeedback, updateHud, updateParticles, updatePlayers, updateShuttle]);

  useEffect(() => {
    loopRef.current = (timestamp) => {
      if (!isPlayingRef.current) return;
      if (!lastFrameTimeRef.current) {
        lastFrameTimeRef.current = timestamp;
      }

      const frameDeltaMs = Math.max(8, Math.min(40, timestamp - lastFrameTimeRef.current));
      const dtSec = frameDeltaMs / 1000;
      lastFrameTimeRef.current = timestamp;

      update(dtSec);
      render();
      timeRef.current += dtSec;
      animFrameRef.current = requestAnimationFrame(loopRef.current);
    };
  }, [render, update]);

  const play = useCallback(() => {
    if (!isPlayingRef.current) {
      isPlayingRef.current = true;
      animFrameRef.current = requestAnimationFrame(loopRef.current);
    }
  }, []);

  const pause = useCallback(() => {
    isPlayingRef.current = false;
    lastFrameTimeRef.current = 0;
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
  }, []);

  useEffect(() => {
    pauseRef.current = pause;
  }, [pause]);

  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) pause();
    else play();
    return isPlayingRef.current;
  }, [pause, play]);

  useEffect(() => {
    const getNormalizedKey = (event) => {
      if (!event || typeof event.key !== 'string') {
        return '';
      }
      return event.key.toLowerCase();
    };

    const onKeyDown = (event) => {
      if (!resolveManualControlEnabled()) return;
      const key = getNormalizedKey(event);
      if (!key) return;

      if (key === 'a') controlRef.current.leftP1 = true;
      if (key === 'd') controlRef.current.rightP1 = true;
      if (key === 'w') controlRef.current.upP1 = true;
      if (key === 's') controlRef.current.downP1 = true;

      if (key === 'arrowleft') controlRef.current.leftP2 = true;
      if (key === 'arrowright') controlRef.current.rightP2 = true;
      if (key === 'arrowup') controlRef.current.upP2 = true;
      if (key === 'arrowdown') controlRef.current.downP2 = true;

      if (key === 'a' || key === 'd' || key === 'w' || key === 's') {
        controlRef.current.movedAtP1 = timeRef.current;
      }
      if (key === 'arrowleft' || key === 'arrowright' || key === 'arrowup' || key === 'arrowdown') {
        controlRef.current.movedAtP2 = timeRef.current;
      }

      if (key === 'j') {
        controlRef.current.requestedShotP1 = { type: 'short', at: timeRef.current };
      }
      if (key === 'k') {
        controlRef.current.requestedShotP1 = { type: 'long', at: timeRef.current };
      }
      if (key === 'l' || key === ' ') {
        controlRef.current.requestedShotP1 = { type: 'smash', at: timeRef.current };
      }

      if (key === '1') {
        controlRef.current.requestedShotP2 = { type: 'short', at: timeRef.current };
      }
      if (key === '2') {
        controlRef.current.requestedShotP2 = { type: 'long', at: timeRef.current };
      }
      if (key === '3' || key === '0') {
        controlRef.current.requestedShotP2 = { type: 'smash', at: timeRef.current };
      }

      if (key === 'u') {
        controlRef.current.abilityTriggerP1 = true;
      }
      if (key === '9') {
        controlRef.current.abilityTriggerP2 = true;
      }

      if (
        key === 'a' || key === 'd' || key === 'w' || key === 's'
        || key === 'arrowleft' || key === 'arrowright' || key === 'arrowup' || key === 'arrowdown'
        || key === 'j' || key === 'k' || key === 'l' || key === ' '
        || key === '1' || key === '2' || key === '3' || key === '0'
        || key === 'u' || key === '9'
      ) {
        event.preventDefault();
      }
    };

    const onKeyUp = (event) => {
      const key = getNormalizedKey(event);
      if (!key) return;
      if (key === 'a') controlRef.current.leftP1 = false;
      if (key === 'd') controlRef.current.rightP1 = false;
      if (key === 'w') controlRef.current.upP1 = false;
      if (key === 's') controlRef.current.downP1 = false;

      if (key === 'arrowleft') controlRef.current.leftP2 = false;
      if (key === 'arrowright') controlRef.current.rightP2 = false;
      if (key === 'arrowup') controlRef.current.upP2 = false;
      if (key === 'arrowdown') controlRef.current.downP2 = false;
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [resolveManualControlEnabled]);

  const reset = useCallback(() => {
    const state = stateRef.current;
    const p1Name = resolvePlayerName('p1', 'Minimax');
    const p2Name = resolvePlayerName('p2', 'MCTS');

    state.score.p1 = 0;
    state.score.p2 = 0;
    state.rally = 0;
    state.shotCount = 0;
    state.playerSkinIndex = 0;
    const lockedArenaIndex = resolveArenaIndex();
    state.stadiumIndex = lockedArenaIndex ?? 0;

    state.p1 = {
      ...state.p1,
      x: GAMEPLAY_TUNING.leftHalfCenterX,
      y: GAMEPLAY_TUNING.baselineY,
      vx: 0,
      vy: 0,
      stamina: 100,
      hitTime: 0,
      jumpTime: 0,
      jumpDuration: 0,
      jumpPower: 0,
      successShots: 0,
      pointsWon: 0,
      lastAbilityAt: -999,
      specialUsed: false,
      lastShotType: 'long',
      speedBurstUntil: 0,
      timeSlowUntil: 0,
      illusionUntil: 0,
      name: p1Name,
    };
    state.p2 = {
      ...state.p2,
      x: GAMEPLAY_TUNING.rightHalfCenterX,
      y: GAMEPLAY_TUNING.baselineY,
      vx: 0,
      vy: 0,
      stamina: 100,
      hitTime: 0,
      jumpTime: 0,
      jumpDuration: 0,
      jumpPower: 0,
      successShots: 0,
      pointsWon: 0,
      lastAbilityAt: -999,
      specialUsed: false,
      lastShotType: 'long',
      speedBurstUntil: 0,
      timeSlowUntil: 0,
      illusionUntil: 0,
      name: p2Name,
    };

    state.shuttle = {
      ...state.shuttle,
      x: GAMEPLAY_TUNING.netX,
      y: GAMEPLAY_TUNING.baselineY,
      prevX: GAMEPLAY_TUNING.netX,
      prevY: GAMEPLAY_TUNING.baselineY,
      trail: [],
      from: 'p1',
      to: 'p2',
      fromX: GAMEPLAY_TUNING.leftHalfCenterX,
      fromY: GAMEPLAY_TUNING.baselineY,
      targetX: GAMEPLAY_TUNING.rightHalfCenterX,
      targetY: GAMEPLAY_TUNING.baselineY,
      z: 0,
      progress: 0,
      elapsedSec: 0,
      flightTimeSec: 0.9,
      arc: 0.18,
      outOfCourt: false,
      contactResolved: false,
      shotType: 'long',
      illusionSource: null,
      illusionEndsAt: 0,
    };

    state.waitingServe = {
      active: false,
      server: 'p1',
      receiver: 'p2',
      reason: '',
      startedAt: 0,
    };

    particlesRef.current = [];
    feedbackRef.current = [];
    timeRef.current = 0;
    lastFrameTimeRef.current = 0;
    controlRef.current.leftP1 = false;
    controlRef.current.rightP1 = false;
    controlRef.current.upP1 = false;
    controlRef.current.downP1 = false;
    controlRef.current.leftP2 = false;
    controlRef.current.rightP2 = false;
    controlRef.current.upP2 = false;
    controlRef.current.downP2 = false;
    controlRef.current.requestedShotP1 = null;
    controlRef.current.requestedShotP2 = null;
    controlRef.current.abilityTriggerP1 = false;
    controlRef.current.abilityTriggerP2 = false;
    controlRef.current.movedAtP1 = 0;
    controlRef.current.movedAtP2 = 0;
    logIdCounter.current = 1;
    matchFinishedRef.current = false;
    matchStartTimeRef.current = Date.now();
    analyticsRef.current = {
      totalDecisionMs: 0,
      decisionSamples: 0,
      maxDecisionMs: 0,
      abilityActivations: { p1: 0, p2: 0 },
      shotCounts: { smash: 0, long: 0, short: 0, special: 0 },
    };
    setMatchComplete(false);
    setMatchSummary(null);
    setAnalytics({
      averageDecisionMs: 0,
      maxDecisionMs: 0,
      abilityActivations: { p1: 0, p2: 0 },
      shotCounts: { smash: 0, long: 0, short: 0, special: 0 },
    });

    setHudState({
      ...HUD_DEFAULT,
      p1Name,
      p2Name,
    });
    setActionLog([{ id: 0, text: '> Match reset. Simulation resumed.', color: null, agent: null }]);

    pendingDecisionRef.current = { p1: null, p2: null };
    inFlightDecisionRef.current = { p1: false, p2: false };
    lastAgentDecisionRef.current = { p1: null, p2: null };
    backendDecisionTimeRef.current = 0;

    // Restart backend match so agents re-initialize with fresh state.
    (async () => {
      const p1Type = resolveAgentType('p1');
      const p2Type = resolveAgentType('p2');
      const p1IsAi = AI_AGENT_TYPES.has(p1Type);
      const p2IsAi = AI_AGENT_TYPES.has(p2Type);
      if (USE_API && (p1IsAi || p2IsAi)) {
        try {
          const data = await startMatch(p1IsAi ? p1Type : 'minimax', p2IsAi ? p2Type : 'minimax');
          matchIdRef.current = data?.match_id || null;
        } catch {
          matchIdRef.current = null;
        }
      } else {
        matchIdRef.current = null;
      }
    })();

    buildNextShot('p1', 'p2', 'long');
  }, [buildNextShot, resolveAgentType, resolveArenaIndex, resolvePlayerName]);

  useEffect(() => {
    let active = true;
    const viewport = window.visualViewport;
    const container = canvasRef.current?.parentElement || null;
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => resize())
      : null;

    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('fullscreenchange', resize);
    document.addEventListener('webkitfullscreenchange', resize);
    if (viewport) {
      viewport.addEventListener('resize', resize);
      viewport.addEventListener('scroll', resize);
    }
    if (observer && container) {
      observer.observe(container);
    }

    preloadAssets().finally(async () => {
      if (!active) return;
      const lockedArenaIndex = resolveArenaIndex();
      stateRef.current.stadiumIndex = lockedArenaIndex ?? 0;
      controlRef.current.enabled = resolveManualControlEnabled();
      matchStartTimeRef.current = Date.now();

      // Try to start a backend match for live agent decisions when both sides are AI.
      const p1Type = resolveAgentType('p1');
      const p2Type = resolveAgentType('p2');
      const p1IsAi = AI_AGENT_TYPES.has(p1Type);
      const p2IsAi = AI_AGENT_TYPES.has(p2Type);
      if (USE_API && (p1IsAi || p2IsAi)) {
        try {
          const data = await startMatch(p1IsAi ? p1Type : 'minimax', p2IsAi ? p2Type : 'minimax');
          if (data?.match_id) {
            matchIdRef.current = data.match_id;
            addActionLogEntry({
              agent: 'System',
              action: `Backend agents online (${p1IsAi ? p1Type : 'local'} vs ${p2IsAi ? p2Type : 'local'})`,
              color: '#34d399',
            });
          }
        } catch {
          matchIdRef.current = null;
          addActionLogEntry({
            agent: 'System',
            action: 'Backend agents offline — using local heuristic fallback',
            color: '#fbbf24',
          });
        }
      }

      buildNextShot('p1', 'p2', 'long');
      isPlayingRef.current = true;
      animFrameRef.current = requestAnimationFrame(loopRef.current);

      if (controlRef.current.enabled) {
        const p1Human = resolveHumanPlayer('p1');
        const p2Human = resolveHumanPlayer('p2');
        const modeText = p1Human && p2Human
          ? 'Human vs Human controls active'
          : p1Human
            ? 'Human(P1) vs AI controls active'
            : 'AI vs Human(P2) controls active';
        addActionLogEntry({
          agent: 'System',
          action: `${modeText}: P1 move WASD shots J/K/L; P2 move Arrows shots 1/2/3`,
          color: '#93c5fd',
        });
      }
    });

    return () => {
      active = false;
      window.removeEventListener('resize', resize);
      document.removeEventListener('fullscreenchange', resize);
      document.removeEventListener('webkitfullscreenchange', resize);
      if (viewport) {
        viewport.removeEventListener('resize', resize);
        viewport.removeEventListener('scroll', resize);
      }
      if (observer) observer.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [addActionLogEntry, buildNextShot, canvasRef, preloadAssets, resize, resolveAgentType, resolveArenaIndex, resolveHumanPlayer, resolveManualControlEnabled]);

  return {
    hudState,
    actionLog,
    togglePlay,
    play,
    pause,
    reset,
    isPlayingRef,
    matchComplete,
    matchSummary,
    analytics,
  };
}
