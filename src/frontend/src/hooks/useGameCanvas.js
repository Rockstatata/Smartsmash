import { useState, useEffect, useRef, useCallback } from 'react';

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

// Manual tweak section: arena-specific visual calibration.
const ARENA_TUNING = {
  'Stadium-1.png': {
    courtTop: 0.3,
    courtHeight: 0.45,
    playerGroundOffset: 0.25,
    playerScale: 1.6,
    shuttleScale: 0.74,
  },
  'Stadium-2.png': {
    courtTop: 0.2,
    courtHeight: 0.9,
    playerGroundOffset: 0.1,
    playerScale: 0.9,
    shuttleScale: 0.42,
  },
  'Stadium-3.png': {
    courtTop: 0.1,
    courtHeight: 0.775,
    playerGroundOffset: 0.038,
    playerScale: 1.1,
    shuttleScale: 0.72,
  },
  'Stadium-4.png': {
    courtTop: 0.34,
    courtHeight: 0.6,
    playerGroundOffset: 0.3,
    playerScale: 1.4,
    shuttleScale: 0.71,
  },
};

// Manual tweak section: shared simulation and animation controls.
const GAMEPLAY_TUNING = {
  canvasAspect: 1.6,
  courtMarginX: 0.03,
  courtWidth: 0.94,
  leftHalfCenterX: 0.26,
  rightHalfCenterX: 0.74,
  baselineY: 0.705,
  receiveYOffset: -0.014,
  xTrackAmplitude: 0.028,
  yTrackAmplitude: 0.012,
  xResponse: 6.8,
  yResponse: 5.8,
  aiMaxMoveSpeed: 0.24,
  manualAcceleration: 1.15,
  manualMaxSpeed: 0.19,
  manualDrag: 8.4,
  strikeProgress: 0.76,
  aiReachDistance: 0.11,
  humanReachDistance: 0.13,
  smashReachPenalty: 0.015,
  missFeedbackLife: 0.9,
  hitFeedbackLife: 0.7,
  serveShortChance: 0.45,
  humanServeIdleWindowSec: 1.4,
  abilityMinStamina: 52,
  abilityMinSuccessfulShots: 2,
  abilityMinPoints: 1,
  abilityCooldownSec: 8,
  longOutChance: 0.19,
  longOutDistance: [0.018, 0.06],
  shortLandingDistance: [0.07, 0.14],
  longLandingDistance: [0.2, 0.34],
  netX: 0.5,
  minNetClearance: 0.17,
  netFaultThreshold: 0.11,
  maxShotsPerRally: 16,
  baseMistakeChance: 0.06,
  mistakeGrowthPerShot: 0.02,
  playerSpriteHeight: 0.49,
  playerDepthBase: 0.9,
  playerDepthGain: 0.4,
  playerAnchor: 0.94,
  shuttleSize: 0.058,
  trailLength: 28,
  trailFadeRate: 0.034,
  flightTimeScale: 1.2,
  hitPoseDuration: 0.34,
  hitPoseStrongWindow: 0.17,
  prepPoseProgress: 0.68,
  decisionBaseMs: 15,
  decisionSwingMs: 105,
};

const SHOT_PROFILES = {
  short: {
    flightTime: [1.16, 1.36],
    arc: [0.19, 0.25],
    jumpTime: 0.22,
    jumpPower: 0.03,
  },
  smash: {
    flightTime: [0.82, 1.02],
    arc: [0.18, 0.24],
    jumpTime: 0.31,
    jumpPower: 0.074,
  },
  long: {
    flightTime: [1.48, 1.82],
    arc: [0.32, 0.4],
    jumpTime: 0.27,
    jumpPower: 0.052,
  },
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
  return x >= 0.08 && x <= 0.92 && y >= 0.57 && y <= 0.82;
}

function shuttleHeightAtProgress(progress, arc) {
  return 4 * arc * progress * (1 - progress);
}

export default function useGameCanvas(canvasRef, options = {}) {
  const {
    matchSetup = null,
    onMatchComplete = null,
    targetScore = 21,
  } = options;

  const [hudState, setHudState] = useState(HUD_DEFAULT);
  const [actionLog, setActionLog] = useState([{ id: 0, text: '> Loading visual assets...', color: null, agent: null }]);
  const [matchComplete, setMatchComplete] = useState(false);
  const [matchSummary, setMatchSummary] = useState(null);
  const [analytics, setAnalytics] = useState({
    averageDecisionMs: 0,
    maxDecisionMs: 0,
    abilityActivations: { p1: 0, p2: 0 },
    shotCounts: { smash: 0, long: 0, short: 0 },
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
  const analyticsRef = useRef({
    totalDecisionMs: 0,
    decisionSamples: 0,
    maxDecisionMs: 0,
    abilityActivations: { p1: 0, p2: 0 },
    shotCounts: { smash: 0, long: 0, short: 0 },
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

    const naturalW = Math.max(1, rect.width);
    const naturalH = naturalW / GAMEPLAY_TUNING.canvasAspect;
    const viewportMaxH = viewportHeight > 0
      ? Math.max(220, Math.min(viewportHeight * 0.74, 760))
      : naturalH;
    const constrainedH = Math.min(naturalH, viewportMaxH);
    const constrainedW = Math.min(naturalW, constrainedH * GAMEPLAY_TUNING.canvasAspect);

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

  const pickShotType = useCallback((playerKey) => {
    const state = stateRef.current;
    const stamina = state[playerKey].stamina;
    const aggression = resolveStrategyValue('aggression', 55);
    const risk = resolveStrategyValue('risk', 45);
    const ability = resolvePlayerAbility(playerKey);
    const roll = Math.random();

    let smashChance = stamina > 65 ? 0.34 : stamina > 35 ? 0.2 : 0.08;
    let longChance = stamina > 65 ? 0.33 : stamina > 35 ? 0.4 : 0.22;

    smashChance += (aggression - 50) / 240;
    smashChance += (risk - 50) / 300;
    if (ability === 'super_smash') smashChance += 0.12;
    if (ability === 'speed_burst') longChance += 0.06;
    if (ability === 'illusion') smashChance += 0.04;

    smashChance = clamp(smashChance, 0.05, 0.78);
    longChance = clamp(longChance, 0.1, 0.75);

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
  }, [resolvePlayerAbility, resolveStrategyValue]);

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

    const smashNear = sampleRange(0.11, 0.16);
    const smashFar = sampleRange(0.2, 0.29);
    return GAMEPLAY_TUNING.netX + direction * lerp(smashNear, smashFar, 0.62);
  }, []);

  const buildNextShot = useCallback((from, to, shotType) => {
    const state = stateRef.current;
    const shuttle = state.shuttle;
    const profile = SHOT_PROFILES[shotType];
    const playerAbility = resolvePlayerAbility(from);
    const playerIsHuman = resolveHumanPlayer(from);

    const fromPlayer = state[from];
    const targetX = getTargetX(to, shotType);
    const targetY = clamp(0.67 + Math.random() * 0.12, 0.6, 0.82);

    shuttle.from = from;
    shuttle.to = to;
    shuttle.fromX = clamp(fromPlayer.x, 0.08, 0.92);
    shuttle.fromY = clamp(fromPlayer.y - GAMEPLAY_TUNING.receiveYOffset, 0.54, 0.84);
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

    if (shotType === 'long' && Math.random() < GAMEPLAY_TUNING.longOutChance) {
      const overshoot = sampleRange(GAMEPLAY_TUNING.longOutDistance[0], GAMEPLAY_TUNING.longOutDistance[1]);
      shuttle.targetX += to === 'p1' ? -overshoot : overshoot;
      shuttle.outOfCourt = true;
    }

    const deltaX = shuttle.targetX - shuttle.fromX;
    const netProgress = deltaX === 0 ? 0.5 : (GAMEPLAY_TUNING.netX - shuttle.fromX) / deltaX;
    if (netProgress > 0 && netProgress < 1) {
      const netArcFactor = Math.max(0.12, 4 * netProgress * (1 - netProgress));
      const minimumArc = GAMEPLAY_TUNING.minNetClearance / netArcFactor;
      shuttle.arc = Math.max(shuttle.arc, minimumArc);
    }

    analyticsRef.current.shotCounts[shotType] += 1;

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
      const chance = playerAbility === 'super_smash' ? 0.35 : playerAbility === 'speed_burst' ? 0.28 : 0.24;
      abilityTriggered = Math.random() < chance;
    }

    if (abilityTriggered) {
      if (playerAbility === 'speed_burst') {
        shuttle.flightTimeSec *= 0.9;
        addActionLogEntry({
          agent: state[from].name,
          action: 'SPEED BURST activated',
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
        addActionLogEntry({
          agent: state[from].name,
          action: 'ILLUSION feint deployed',
          color: '#60a5fa',
        });
      }

      if (playerAbility === 'time_slow') {
        shuttle.flightTimeSec *= 1.08;
        addActionLogEntry({
          agent: state[from].name,
          action: 'TIME SLOW pulse',
          color: '#a78bfa',
        });
      }

      state[from].lastAbilityAt = timeRef.current;
      analyticsRef.current.abilityActivations[from] += 1;
      state[from].stamina = clamp(state[from].stamina - 8, 0, 100);
    }

    controlRef.current[triggerSlot] = false;

    state.currentTurn = to;

    addActionLogEntry({
      agent: from === 'p1' ? state.p1.name : state.p2.name,
      action: `${shotType.toUpperCase()} shot`,
      color: from === 'p1' ? '#4A9EFF' : '#FF6B6B',
    });
  }, [addActionLogEntry, canActivateAbility, getTargetX, resolveHumanPlayer, resolvePlayerAbility]);

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
    const configuredTarget = Number(matchOptionsRef.current?.targetScore || 21);

    state.score[winner] += 1;
    state[winner].pointsWon += 1;
    const loser = winner === 'p1' ? 'p2' : 'p1';
    state[loser].successShots = 0;
    state.rally += 1;
    state.shotCount = 0;
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
    const scoreGap = Math.abs(p1Score - p2Score);
    const hasWinner = leadingScore >= configuredTarget && (scoreGap >= 2 || leadingScore >= 30);

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
    const manualEnabled = resolveManualControlEnabled();

    const p1Receiving = shuttle.to === 'p1';
    const p2Receiving = shuttle.to === 'p2';

    const p1TargetX = p1Receiving
      ? clamp(shuttle.targetX + Math.sin(timeRef.current * 1.2) * 0.006, 0.13, 0.47)
      : clamp(
        GAMEPLAY_TUNING.leftHalfCenterX + Math.sin(timeRef.current * 0.95) * GAMEPLAY_TUNING.xTrackAmplitude,
        0.14,
        0.44,
      );

    const p2TargetX = p2Receiving
      ? clamp(shuttle.targetX + Math.cos(timeRef.current * 1.2) * 0.006, 0.53, 0.87)
      : clamp(
        GAMEPLAY_TUNING.rightHalfCenterX + Math.cos(timeRef.current * 0.95) * GAMEPLAY_TUNING.xTrackAmplitude,
        0.56,
        0.86,
      );

    const p1TargetY = clamp(
      GAMEPLAY_TUNING.baselineY + (p1Receiving ? GAMEPLAY_TUNING.receiveYOffset : 0) + Math.sin(timeRef.current * 0.75) * GAMEPLAY_TUNING.yTrackAmplitude,
      0.63,
      0.79,
    );
    const p2TargetY = clamp(
      GAMEPLAY_TUNING.baselineY + (p2Receiving ? GAMEPLAY_TUNING.receiveYOffset : 0) + Math.cos(timeRef.current * 0.75) * GAMEPLAY_TUNING.yTrackAmplitude,
      0.63,
      0.79,
    );

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
      if (speed > GAMEPLAY_TUNING.manualMaxSpeed) {
        const scale = GAMEPLAY_TUNING.manualMaxSpeed / Math.max(0.0001, speed);
        state.p1.vx *= scale;
        state.p1.vy *= scale;
      }

      state.p1.x = clamp(state.p1.x + state.p1.vx * dtSec, 0.12, 0.47);
      state.p1.y = clamp(state.p1.y + state.p1.vy * dtSec, 0.63, 0.79);

      if (state.p1.x <= 0.1201 || state.p1.x >= 0.4699) state.p1.vx *= 0.25;
      if (state.p1.y <= 0.6301 || state.p1.y >= 0.7899) state.p1.vy *= 0.25;
    } else {
      state.p1.vx = 0;
      state.p1.vy = 0;
      state.p1.x = smoothApproachWithSpeedCap(
        state.p1.x,
        p1TargetX,
        GAMEPLAY_TUNING.xResponse,
        GAMEPLAY_TUNING.aiMaxMoveSpeed,
        dtSec,
      );
      state.p1.y = smoothApproachWithSpeedCap(
        state.p1.y,
        p1TargetY,
        GAMEPLAY_TUNING.yResponse,
        GAMEPLAY_TUNING.aiMaxMoveSpeed,
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
      if (speed > GAMEPLAY_TUNING.manualMaxSpeed) {
        const scale = GAMEPLAY_TUNING.manualMaxSpeed / Math.max(0.0001, speed);
        state.p2.vx *= scale;
        state.p2.vy *= scale;
      }

      state.p2.x = clamp(state.p2.x + state.p2.vx * dtSec, 0.53, 0.88);
      state.p2.y = clamp(state.p2.y + state.p2.vy * dtSec, 0.63, 0.79);

      if (state.p2.x <= 0.5301 || state.p2.x >= 0.8799) state.p2.vx *= 0.25;
      if (state.p2.y <= 0.6301 || state.p2.y >= 0.7899) state.p2.vy *= 0.25;
    } else {
      state.p2.vx = 0;
      state.p2.vy = 0;
      state.p2.x = smoothApproachWithSpeedCap(
        state.p2.x,
        p2TargetX,
        GAMEPLAY_TUNING.xResponse,
        GAMEPLAY_TUNING.aiMaxMoveSpeed,
        dtSec,
      );
      state.p2.y = smoothApproachWithSpeedCap(
        state.p2.y,
        p2TargetY,
        GAMEPLAY_TUNING.yResponse,
        GAMEPLAY_TUNING.aiMaxMoveSpeed,
        dtSec,
      );
    }

    state.p1.hitTime = Math.max(0, state.p1.hitTime - dtSec);
    state.p2.hitTime = Math.max(0, state.p2.hitTime - dtSec);
    state.p1.jumpTime = Math.max(0, state.p1.jumpTime - dtSec);
    state.p2.jumpTime = Math.max(0, state.p2.jumpTime - dtSec);

    state.p1.stamina = clamp(60 + Math.sin(timeRef.current * 0.58 + 0.6) * 32, 7, 100);
    state.p2.stamina = clamp(58 + Math.cos(timeRef.current * 0.58 + 1.2) * 34, 7, 100);
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
      const reachPenalty = shuttle.shotType === 'smash' ? GAMEPLAY_TUNING.smashReachPenalty : 0;
      const reach = reachBase - reachPenalty;

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

      state[receiver].hitTime = GAMEPLAY_TUNING.hitPoseDuration;
      state[receiver].jumpDuration = profile.jumpTime;
      state[receiver].jumpTime = profile.jumpTime;
      state[receiver].jumpPower = profile.jumpPower;
      state[receiver].successShots += 1;
      shuttle.contactResolved = true;
      pushFeedback('hit', shuttle.x, shuttle.y - Math.max(0.04, shuttle.z * 0.65), `${nextType.toUpperCase()} HIT`, '#4ade80');
      state.shotCount += 1;

      if (state.shotCount >= GAMEPLAY_TUNING.maxShotsPerRally) {
        const forcedWinner = receiver;
        pushFeedback('miss', shuttle.x, shuttle.y - 0.03, 'FORCED ERROR', '#facc15');
        addActionLogEntry({
          agent: 'System',
          action: `Rally cap reached -> point for ${state[forcedWinner].name}`,
          color: '#facc15',
        });
        registerPoint(forcedWinner);
        return;
      }

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
    const p1Ability = resolvePlayerAbility('p1');
    const p2Ability = resolvePlayerAbility('p2');

    let adjustment = 0;
    if (state.currentTurn === 'p2' && p1Ability === 'time_slow') adjustment += 12;
    if (state.currentTurn === 'p1' && p2Ability === 'time_slow') adjustment += 12;

    state.decisionTime = Math.floor(baseDecision + adjustment);
    analyticsRef.current.totalDecisionMs += state.decisionTime;
    analyticsRef.current.decisionSamples += 1;
    analyticsRef.current.maxDecisionMs = Math.max(analyticsRef.current.maxDecisionMs, state.decisionTime);

    setHudState({
      p1Score: state.score.p1,
      p2Score: state.score.p2,
      rally: state.rally,
      p1Stamina: state.p1.stamina,
      p2Stamina: state.p2.stamina,
      decisionTime: state.decisionTime,
      p1Name: state.p1.name,
      p2Name: state.p2.name,
    });
  }, [resolvePlayerAbility, resolvePlayerName]);

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

  const drawCourt = useCallback(() => {}, []);

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
      shotCounts: { smash: 0, long: 0, short: 0 },
    };
    setMatchComplete(false);
    setMatchSummary(null);
    setAnalytics({
      averageDecisionMs: 0,
      maxDecisionMs: 0,
      abilityActivations: { p1: 0, p2: 0 },
      shotCounts: { smash: 0, long: 0, short: 0 },
    });

    setHudState({
      ...HUD_DEFAULT,
      p1Name,
      p2Name,
    });
    setActionLog([{ id: 0, text: '> Match reset. Simulation resumed.', color: null, agent: null }]);

    buildNextShot('p1', 'p2', 'long');
  }, [buildNextShot, resolveArenaIndex, resolvePlayerName]);

  useEffect(() => {
    let active = true;
    const viewport = window.visualViewport;
    const container = canvasRef.current?.parentElement || null;
    const observer = typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => resize())
      : null;

    resize();
    window.addEventListener('resize', resize);
    if (viewport) {
      viewport.addEventListener('resize', resize);
      viewport.addEventListener('scroll', resize);
    }
    if (observer && container) {
      observer.observe(container);
    }

    preloadAssets().finally(() => {
      if (!active) return;
      const lockedArenaIndex = resolveArenaIndex();
      stateRef.current.stadiumIndex = lockedArenaIndex ?? 0;
      controlRef.current.enabled = resolveManualControlEnabled();
      matchStartTimeRef.current = Date.now();
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
      if (viewport) {
        viewport.removeEventListener('resize', resize);
        viewport.removeEventListener('scroll', resize);
      }
      if (observer) observer.disconnect();
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [addActionLogEntry, buildNextShot, canvasRef, preloadAssets, resize, resolveArenaIndex, resolveHumanPlayer, resolveManualControlEnabled]);

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
