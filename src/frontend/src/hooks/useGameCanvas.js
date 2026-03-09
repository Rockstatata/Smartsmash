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

function roundedRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  ctx.beginPath();
  ctx.rect(x, y, w, h);
}

export default function useGameCanvas(canvasRef) {
  const [hudState, setHudState] = useState(HUD_DEFAULT);
  const [actionLog, setActionLog] = useState([{ id: 0, text: '> Loading visual assets...', color: null, agent: null }]);

  const isPlayingRef = useRef(true);
  const animFrameRef = useRef(null);
  const timeRef = useRef(0);
  const loopRef = useRef(null);
  const particlesRef = useRef([]);
  const assetCacheRef = useRef(new Map());
  const assetsReadyRef = useRef(false);
  const logIdCounter = useRef(1);

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
    const roll = Math.random();

    if (stamina > 65) {
      if (roll < 0.34) return 'smash';
      if (roll < 0.67) return 'long';
      return 'short';
    }

    if (stamina > 35) {
      if (roll < 0.2) return 'smash';
      if (roll < 0.6) return 'long';
      return 'short';
    }

    return roll < 0.7 ? 'short' : 'long';
  }, []);

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

    state.currentTurn = to;

    addActionLogEntry({
      agent: from === 'p1' ? state.p1.name : state.p2.name,
      action: `${shotType.toUpperCase()} shot`,
      color: from === 'p1' ? '#4A9EFF' : '#FF6B6B',
    });
  }, [addActionLogEntry, getTargetX]);

  const registerPoint = useCallback((winner) => {
    const state = stateRef.current;

    state.score[winner] += 1;
    state.rally += 1;
    state.shotCount = 0;
    state.playerSkinIndex = state.rally % PLAYER_SKINS.length;
    state.stadiumIndex = state.rally % STADIUMS.length;

    spawnScoreParticles(state.shuttle.x, state.shuttle.y);
    addActionLogEntry({
      agent: 'System',
      action: `Rally ${state.rally}: point for ${winner === 'p1' ? state.p1.name : state.p2.name}`,
      color: '#C9A84C',
    });

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
  }, [addActionLogEntry, buildNextShot, spawnScoreParticles]);

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
    state.decisionTime = Math.floor(15 + Math.abs(Math.sin(timeRef.current * 0.022)) * 105);

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
  }, []);

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

  const togglePlay = useCallback(() => {
    if (isPlayingRef.current) pause();
    else play();
    return isPlayingRef.current;
  }, [pause, play]);

  const reset = useCallback(() => {
    const state = stateRef.current;

    state.score.p1 = 0;
    state.score.p2 = 0;
    state.rally = 0;
    state.shotCount = 0;
    state.playerSkinIndex = 0;
    state.stadiumIndex = 0;

    state.p1 = { ...state.p1, x: 0.26, y: 0.64, stamina: 100, hitFrames: 0, jumpFrames: 0, jumpPower: 0 };
    state.p2 = { ...state.p2, x: 0.74, y: 0.64, stamina: 100, hitFrames: 0, jumpFrames: 0, jumpPower: 0 };

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

    setHudState(HUD_DEFAULT);
    setActionLog([{ id: 0, text: '> Match reset. Simulation resumed.', color: null, agent: null }]);

    buildNextShot('p1', 'p2', 'long');
  }, [buildNextShot]);

  useEffect(() => {
    let active = true;

    resize();
    window.addEventListener('resize', resize);

    preloadAssets().finally(() => {
      if (!active) return;
      buildNextShot('p1', 'p2', 'long');
      isPlayingRef.current = true;
      loopRef.current();
    });

    return () => {
      active = false;
      window.removeEventListener('resize', resize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [buildNextShot, preloadAssets, resize]);

  return {
    hudState,
    actionLog,
    togglePlay,
    reset,
    isPlayingRef,
  };
}
