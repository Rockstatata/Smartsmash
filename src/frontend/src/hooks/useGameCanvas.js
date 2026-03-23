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

const SHOT_PROFILES = {
  short: {
    speed: [0.013, 0.017],
    arc: [0.12, 0.16],
    jumpFrames: 8,
    jumpPower: 0.028,
    nearNetOffset: 0.06,
    farOffset: 0.12,
  },
  smash: {
    speed: [0.022, 0.028],
    arc: [0.16, 0.2],
    jumpFrames: 12,
    jumpPower: 0.06,
    nearNetOffset: 0.12,
    farOffset: 0.2,
  },
  long: {
    speed: [0.010, 0.014],
    arc: [0.22, 0.3],
    jumpFrames: 10,
    jumpPower: 0.04,
    nearNetOffset: 0.18,
    farOffset: 0.34,
  },
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
  const timeRef = useRef(0);
  const loopRef = useRef(null);
  const particlesRef = useRef([]);
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

  const stateRef = useRef({
    p1: { x: 0.26, y: 0.64, stamina: 100, name: 'Minimax', hitFrames: 0, jumpFrames: 0, jumpPower: 0 },
    p2: { x: 0.74, y: 0.64, stamina: 100, name: 'MCTS', hitFrames: 0, jumpFrames: 0, jumpPower: 0 },
    shuttle: {
      x: 0.5,
      y: 0.5,
      prevX: 0.5,
      prevY: 0.5,
      active: true,
      trail: [],
      from: 'p1',
      to: 'p2',
      fromX: 0.26,
      fromY: 0.64,
      targetX: 0.74,
      targetY: 0.64,
      z: 0,
      progress: 0,
      speed: 0.015,
      arc: 0.1,
      shotType: 'long',
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

  const resize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const container = canvas.parentElement;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = (rect.width / 1.6) * dpr;
    canvas.style.height = `${rect.width / 1.6}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const displayW = rect.width;
    const displayH = rect.width / 1.6;
    const court = courtRef.current;

    court.x = displayW * 0.03;
    court.w = displayW * 0.94;
    court.y = displayH * 0.36;
    court.h = displayH * 0.56;
  }, [canvasRef]);

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

  const getTargetX = useCallback((receiver, shotType) => {
    const profile = SHOT_PROFILES[shotType];
    const nearNet = receiver === 'p1' ? 0.5 - profile.nearNetOffset : 0.5 + profile.nearNetOffset;
    const farSide = receiver === 'p1' ? 0.5 - profile.farOffset : 0.5 + profile.farOffset;

    if (shotType === 'short') return nearNet;
    if (shotType === 'long') return farSide;
    return lerp(nearNet, farSide, 0.65);
  }, []);

  const buildNextShot = useCallback((from, to, shotType) => {
    const state = stateRef.current;
    const shuttle = state.shuttle;
    const profile = SHOT_PROFILES[shotType];
    const playerAbility = resolvePlayerAbility(from);

    const fromPlayer = state[from];
    const targetX = getTargetX(to, shotType);
    const targetY = clamp(0.62 + Math.random() * 0.12, 0.58, 0.78);

    shuttle.from = from;
    shuttle.to = to;
    shuttle.fromX = clamp(fromPlayer.x, 0.08, 0.92);
    shuttle.fromY = clamp(fromPlayer.y - 0.01, 0.52, 0.86);
    shuttle.targetX = clamp(targetX, 0.08, 0.92);
    shuttle.targetY = targetY;
    shuttle.z = 0;
    shuttle.progress = 0;
    shuttle.speed = sampleRange(profile.speed[0], profile.speed[1]);
    shuttle.arc = sampleRange(profile.arc[0], profile.arc[1]);
    shuttle.shotType = shotType;

    analyticsRef.current.shotCounts[shotType] += 1;

    if (playerAbility === 'speed_burst' && Math.random() < 0.28) {
      shuttle.speed *= 1.16;
      analyticsRef.current.abilityActivations[from] += 1;
      addActionLogEntry({
        agent: state[from].name,
        action: 'SPEED BURST activated',
        color: '#facc15',
      });
    }

    if (playerAbility === 'super_smash' && shotType === 'smash' && Math.random() < 0.35) {
      shuttle.speed *= 1.08;
      shuttle.arc *= 1.18;
      analyticsRef.current.abilityActivations[from] += 1;
      addActionLogEntry({
        agent: state[from].name,
        action: 'SUPER SMASH amplified',
        color: '#f59e0b',
      });
    }

    if (playerAbility === 'illusion' && Math.random() < 0.2) {
      shuttle.targetX = clamp(shuttle.targetX + sampleRange(-0.04, 0.04), 0.1, 0.9);
      analyticsRef.current.abilityActivations[from] += 1;
      addActionLogEntry({
        agent: state[from].name,
        action: 'ILLUSION feint deployed',
        color: '#60a5fa',
      });
    }

    if (playerAbility === 'time_slow' && Math.random() < 0.24) {
      shuttle.speed *= 0.92;
      analyticsRef.current.abilityActivations[from] += 1;
      addActionLogEntry({
        agent: state[from].name,
        action: 'TIME SLOW pulse',
        color: '#a78bfa',
      });
    }

    state.currentTurn = to;

    addActionLogEntry({
      agent: from === 'p1' ? state.p1.name : state.p2.name,
      action: `${shotType.toUpperCase()} shot`,
      color: from === 'p1' ? '#4A9EFF' : '#FF6B6B',
    });
  }, [addActionLogEntry, getTargetX, resolvePlayerAbility]);

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
    state.rally += 1;
    state.shotCount = 0;
    state.playerSkinIndex = state.rally % PLAYER_SKINS.length;
    const lockedArenaIndex = resolveArenaIndex();
    state.stadiumIndex = lockedArenaIndex ?? (state.rally % STADIUMS.length);

    spawnScoreParticles(state.shuttle.x, state.shuttle.y);
    addActionLogEntry({
      agent: 'System',
      action: `Rally ${state.rally}: point for ${winnerName}`,
      color: '#C9A84C',
    });

    if (state.score[winner] >= configuredTarget && !matchFinishedRef.current) {
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

    state.p1.hitFrames = 0;
    state.p1.jumpFrames = 0;
    state.p2.hitFrames = 0;
    state.p2.jumpFrames = 0;

    state.shuttle.x = state[server].x;
    state.shuttle.y = state[server].y;
    state.shuttle.prevX = state.shuttle.x;
    state.shuttle.prevY = state.shuttle.y;
    state.shuttle.trail = [];

    buildNextShot(server, receiver, 'long');
  }, [addActionLogEntry, buildMatchSummary, buildNextShot, resolveArenaIndex, spawnScoreParticles]);

  const updatePlayers = useCallback(() => {
    const state = stateRef.current;
    const shuttle = state.shuttle;

    const p1Receiving = shuttle.to === 'p1';
    const p2Receiving = shuttle.to === 'p2';

    const p1TargetX = p1Receiving
      ? clamp(shuttle.targetX + Math.sin(timeRef.current * 0.014) * 0.01, 0.13, 0.47)
      : clamp(0.26 + Math.sin(timeRef.current * 0.013) * 0.04, 0.16, 0.42);

    const p2TargetX = p2Receiving
      ? clamp(shuttle.targetX + Math.cos(timeRef.current * 0.014) * 0.01, 0.53, 0.87)
      : clamp(0.74 + Math.cos(timeRef.current * 0.013) * 0.04, 0.58, 0.84);

    const p1TargetY = clamp(0.64 + Math.sin(timeRef.current * 0.009) * 0.02, 0.58, 0.76);
    const p2TargetY = clamp(0.64 + Math.cos(timeRef.current * 0.009) * 0.02, 0.58, 0.76);

    state.p1.x += (p1TargetX - state.p1.x) * 0.12;
    state.p1.y += (p1TargetY - state.p1.y) * 0.08;
    state.p2.x += (p2TargetX - state.p2.x) * 0.12;
    state.p2.y += (p2TargetY - state.p2.y) * 0.08;

    state.p1.hitFrames = Math.max(0, state.p1.hitFrames - 1);
    state.p2.hitFrames = Math.max(0, state.p2.hitFrames - 1);
    state.p1.jumpFrames = Math.max(0, state.p1.jumpFrames - 1);
    state.p2.jumpFrames = Math.max(0, state.p2.jumpFrames - 1);

    state.p1.stamina = clamp(60 + Math.sin(timeRef.current * 0.007 + 0.6) * 32, 7, 100);
    state.p2.stamina = clamp(58 + Math.cos(timeRef.current * 0.007 + 1.2) * 34, 7, 100);
  }, []);

  const updateShuttle = useCallback(() => {
    const state = stateRef.current;
    const shuttle = state.shuttle;

    shuttle.prevX = shuttle.x;
    shuttle.prevY = shuttle.y;

    shuttle.progress = Math.min(1, shuttle.progress + shuttle.speed);
    shuttle.x = lerp(shuttle.fromX, shuttle.targetX, shuttle.progress);
    shuttle.y = lerp(shuttle.fromY, shuttle.targetY, shuttle.progress);
    shuttle.z = Math.sin(Math.PI * shuttle.progress) * shuttle.arc;

    shuttle.trail.push({ x: shuttle.x, y: shuttle.y - shuttle.z, life: 1 });
    if (shuttle.trail.length > 22) shuttle.trail.shift();

    for (let i = 0; i < shuttle.trail.length; i++) {
      shuttle.trail[i].life -= 0.052;
    }

    if (shuttle.progress >= 1) {
      const receiver = shuttle.to;
      const sender = shuttle.from;
      const nextTarget = receiver === 'p1' ? 'p2' : 'p1';
      const nextType = pickShotType(receiver);
      const profile = SHOT_PROFILES[nextType];

      state[receiver].hitFrames = 12;
      state[receiver].jumpFrames = profile.jumpFrames;
      state[receiver].jumpPower = profile.jumpPower;
      state.shotCount += 1;

      const winnerProbability = shuttle.shotType === 'smash' ? 0.16 : 0.1;
      const rallyShouldEnd = state.shotCount >= 10 && Math.random() < winnerProbability;

      if (rallyShouldEnd) {
        const winner = Math.random() > (sender === 'p1' ? 0.45 : 0.55) ? receiver : sender;
        registerPoint(winner);
      } else {
        buildNextShot(receiver, nextTarget, nextType);
      }
    }
  }, [buildNextShot, pickShotType, registerPoint]);

  const updateParticles = useCallback(() => {
    const particles = particlesRef.current;
    for (let i = particles.length - 1; i >= 0; i--) {
      particles[i].life -= 0.018;
      particles[i].x += particles[i].vx;
      particles[i].y += particles[i].vy;
      particles[i].vy += 0.00008;
      if (particles[i].life <= 0) particles.splice(i, 1);
    }
  }, []);

  const updateHud = useCallback(() => {
    const state = stateRef.current;
    state.p1.name = resolvePlayerName('p1', state.p1.name || 'Minimax');
    state.p2.name = resolvePlayerName('p2', state.p2.name || 'MCTS');
    const baseDecision = 15 + Math.abs(Math.sin(timeRef.current * 0.022)) * 105;
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
    if (player.jumpFrames <= 0) return 0;
    const peak = 12;
    const phase = (peak - Math.min(player.jumpFrames, peak)) / peak;
    return Math.sin(phase * Math.PI) * player.jumpPower;
  }, []);

  const resolvePose = useCallback((playerKey) => {
    const state = stateRef.current;
    const player = state[playerKey];
    const shuttle = state.shuttle;

    if (player.hitFrames > 7) return 'hit';
    if (player.hitFrames > 0) return 'hitStance';

    if (shuttle.to === playerKey && shuttle.progress > 0.75) return 'hitStance';
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
    const skin = PLAYER_SKINS[state.playerSkinIndex];
    const imageName = skin[side][pose];
    const image = assetCacheRef.current.get(imageName);

    const px = court.x + player.x * court.w;
    const py = court.y + (player.y - jumpOffset) * court.h;

    const shadowScale = 1 - Math.min(0.55, jumpOffset * 5.5);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.beginPath();
    ctx.ellipse(px, py + court.h * 0.08, court.w * 0.03 * shadowScale, court.h * 0.02 * shadowScale, 0, 0, Math.PI * 2);
    ctx.fill();

    if (!image) {
      drawFallbackPlayer(ctx, px, py);
      return;
    }

    const depthScale = 0.95 + (player.y - 0.58) * 0.5;
    const baseHeight = court.h * 0.58 * depthScale;
    const scale = pose === 'hit' ? 1.09 : pose === 'hitStance' ? 1.04 : 1;
    const drawHeight = baseHeight * scale;
    const drawWidth = drawHeight * (image.naturalWidth / image.naturalHeight);

    ctx.drawImage(image, px - drawWidth / 2, py - drawHeight * 0.86, drawWidth, drawHeight);
  }, [drawFallbackPlayer, getJumpOffset, resolvePose]);

  const drawShuttle = useCallback((ctx, court) => {
    const shuttle = stateRef.current.shuttle;
    const image = assetCacheRef.current.get(SHUTTLE_FILE);
    if (!shuttle.active) return;

    const sx = court.x + shuttle.x * court.w;
    const sy = court.y + (shuttle.y - shuttle.z) * court.h;
    const dx = shuttle.x - shuttle.prevX;
    const dy = shuttle.y - shuttle.prevY;
    const rotation = Math.atan2(dy, dx);
    const size = court.h * 0.078;

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
  }, [canvasRef, drawBackground, drawCourt, drawLoading, drawParticles, drawPlayer, drawShuttle, drawShuttleTrail]);

  const update = useCallback(() => {
    if (!assetsReadyRef.current) return;
    if (matchFinishedRef.current) return;
    updatePlayers();
    updateShuttle();
    updateParticles();
    updateHud();
  }, [updateHud, updateParticles, updatePlayers, updateShuttle]);

  useEffect(() => {
    loopRef.current = () => {
      if (!isPlayingRef.current) return;
      update();
      render();
      timeRef.current += 1;
      animFrameRef.current = requestAnimationFrame(loopRef.current);
    };
  }, [render, update]);

  const play = useCallback(() => {
    if (!isPlayingRef.current) {
      isPlayingRef.current = true;
      loopRef.current();
    }
  }, []);

  const pause = useCallback(() => {
    isPlayingRef.current = false;
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

    state.p1 = { ...state.p1, x: 0.26, y: 0.64, stamina: 100, hitFrames: 0, jumpFrames: 0, jumpPower: 0, name: p1Name };
    state.p2 = { ...state.p2, x: 0.74, y: 0.64, stamina: 100, hitFrames: 0, jumpFrames: 0, jumpPower: 0, name: p2Name };

    state.shuttle = {
      ...state.shuttle,
      x: 0.5,
      y: 0.5,
      prevX: 0.5,
      prevY: 0.5,
      trail: [],
      from: 'p1',
      to: 'p2',
      fromX: 0.26,
      fromY: 0.64,
      targetX: 0.74,
      targetY: 0.64,
      z: 0,
      progress: 0,
      speed: 0.015,
      arc: 0.1,
      shotType: 'long',
    };

    particlesRef.current = [];
    timeRef.current = 0;
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

    resize();
    window.addEventListener('resize', resize);

    preloadAssets().finally(() => {
      if (!active) return;
      const lockedArenaIndex = resolveArenaIndex();
      stateRef.current.stadiumIndex = lockedArenaIndex ?? 0;
      matchStartTimeRef.current = Date.now();
      buildNextShot('p1', 'p2', 'long');
      isPlayingRef.current = true;
      loopRef.current();
    });

    return () => {
      active = false;
      window.removeEventListener('resize', resize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [buildNextShot, preloadAssets, resize, resolveArenaIndex]);

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
