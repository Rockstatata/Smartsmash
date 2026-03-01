/* ═══════════════════════════════════════════════════════════
   SmartSmash — Game Canvas Engine
   Renders the real-time badminton court, players, shuttle,
   and visual effects on an HTML5 Canvas element.
   ═══════════════════════════════════════════════════════════ */

var GameCanvas = (function () {
  'use strict';

  /* ─── Constants ──────────────────────────────────────── */
  var COURT_COLOR = '#1A3A2A';
  var COURT_LINE_COLOR = 'rgba(255, 255, 255, 0.6)';
  var COURT_LINE_WIDTH = 2;
  var PLAYER_RADIUS = 16;
  var SHUTTLE_RADIUS = 6;
  var CHAMPAGNE = '#C9A84C';
  var CHAMPAGNE_DIM = 'rgba(201, 168, 76, 0.3)';
  var P1_COLOR = '#4A9EFF';
  var P2_COLOR = '#FF6B6B';

  /* ─── State ──────────────────────────────────────────── */
  var canvas = null;
  var ctx = null;
  var animFrameId = null;
  var isPlaying = false;
  var time = 0;

  // Court dimensions (in canvas coordinates)
  var court = {
    x: 0, y: 0, w: 0, h: 0,
    // Real badminton proportions: 13.4m x 6.1m
    aspectRatio: 13.4 / 6.1
  };

  // Game state (simulation or demo)
  var state = {
    p1: { x: 0.25, y: 0.5, stamina: 100, name: 'Minimax' },
    p2: { x: 0.75, y: 0.5, stamina: 100, name: 'MCTS' },
    shuttle: { x: 0.5, y: 0.5, active: true, trail: [] },
    score: { p1: 0, p2: 0 },
    rally: 0,
    decisionTime: 0,
    currentTurn: 'p1',
    isDemo: true
  };

  // Particle system for visual effects
  var particles = [];

  /* ─── Initialization ─────────────────────────────────── */

  /**
   * Initializes the game canvas, sets up sizing, and starts
   * the demo animation loop.
   */
  function init() {
    canvas = document.getElementById('game-canvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    resize();
    window.addEventListener('resize', resize);

    // Start in demo mode
    state.isDemo = true;
    isPlaying = true;
    loop();
  }

  /**
   * Handles canvas resize to maintain proper resolution.
   */
  function resize() {
    var container = canvas.parentElement;
    var rect = container.getBoundingClientRect();
    var dpr = window.devicePixelRatio || 1;

    canvas.width = rect.width * dpr;
    canvas.height = (rect.width / 1.6) * dpr;
    canvas.style.height = (rect.width / 1.6) + 'px';

    ctx.scale(dpr, dpr);

    // Recalculate court position
    var displayW = rect.width;
    var displayH = rect.width / 1.6;
    var courtPadding = 40;

    var availW = displayW - courtPadding * 2;
    var availH = displayH - courtPadding * 2;

    if (availW / court.aspectRatio <= availH) {
      court.w = availW;
      court.h = availW / court.aspectRatio;
    } else {
      court.h = availH;
      court.w = availH * court.aspectRatio;
    }

    court.x = (displayW - court.w) / 2;
    court.y = (displayH - court.h) / 2;
  }


  /* ─── Main Loop ──────────────────────────────────────── */

  function loop() {
    if (!isPlaying) return;

    update();
    render();

    time++;
    animFrameId = requestAnimationFrame(loop);
  }

  /**
   * Updates game state each frame. In demo mode, produces
   * autonomous movement patterns.
   */
  function update() {
    if (state.isDemo) {
      updateDemo();
    }

    // Update particles
    for (var i = particles.length - 1; i >= 0; i--) {
      particles[i].life -= 0.02;
      particles[i].x += particles[i].vx;
      particles[i].y += particles[i].vy;
      particles[i].vy += 0.0001; // gravity
      if (particles[i].life <= 0) {
        particles.splice(i, 1);
      }
    }

    // Update shuttle trail
    if (state.shuttle.active) {
      state.shuttle.trail.push({
        x: state.shuttle.x,
        y: state.shuttle.y,
        life: 1
      });
      if (state.shuttle.trail.length > 15) {
        state.shuttle.trail.shift();
      }
    }

    // Decay trail
    for (var t = 0; t < state.shuttle.trail.length; t++) {
      state.shuttle.trail[t].life -= 0.06;
    }
  }

  /**
   * Demo mode: autonomous rally simulation for visual showcase.
   */
  function updateDemo() {
    var speed = 0.004;
    var shuttleSpeed = 0.012;

    // Player 1 drifts toward shuttle vicinity
    var p1TargetX = 0.15 + Math.sin(time * 0.01) * 0.1;
    var p1TargetY = 0.3 + Math.sin(time * 0.015) * 0.3;
    state.p1.x += (p1TargetX - state.p1.x) * speed * 3;
    state.p1.y += (p1TargetY - state.p1.y) * speed * 3;

    // Player 2 drifts on opposite side
    var p2TargetX = 0.85 + Math.sin(time * 0.012 + 2) * 0.1;
    var p2TargetY = 0.5 + Math.cos(time * 0.018) * 0.3;
    state.p2.x += (p2TargetX - state.p2.x) * speed * 3;
    state.p2.y += (p2TargetY - state.p2.y) * speed * 3;

    // Shuttle rallies back and forth
    var rallyPhase = (time * 0.008) % (Math.PI * 2);
    var shuttleTargetX = 0.5 + Math.sin(rallyPhase) * 0.35;
    var shuttleTargetY = 0.5 + Math.sin(rallyPhase * 2.3) * 0.3;

    state.shuttle.x += (shuttleTargetX - state.shuttle.x) * shuttleSpeed;
    state.shuttle.y += (shuttleTargetY - state.shuttle.y) * shuttleSpeed;

    // Simulate stamina fluctuation
    state.p1.stamina = 60 + Math.sin(time * 0.005) * 30;
    state.p2.stamina = 55 + Math.cos(time * 0.006) * 35;

    // Update HUD elements
    updateHUD();

    // Simulate score changes
    if (time % 600 === 0 && time > 0) {
      if (Math.random() > 0.5) {
        state.score.p1++;
      } else {
        state.score.p2++;
      }
      state.rally++;
      spawnScoreParticles();
      addActionLogEntry();
    }

    // Simulate decision time
    state.decisionTime = Math.floor(Math.abs(Math.sin(time * 0.02)) * 120);
  }


  /* ─── Rendering ──────────────────────────────────────── */

  function render() {
    var displayW = canvas.width / (window.devicePixelRatio || 1);
    var displayH = canvas.height / (window.devicePixelRatio || 1);

    // Clear canvas
    ctx.fillStyle = '#0D0D12';
    ctx.fillRect(0, 0, displayW, displayH);

    drawCourtGlow();
    drawCourt();
    drawNet();
    drawShuttleTrail();
    drawShuttle();
    drawPlayer(state.p1, P1_COLOR, 'left');
    drawPlayer(state.p2, P2_COLOR, 'right');
    drawParticles();
  }

  /**
   * Renders the ambient glow beneath the court.
   */
  function drawCourtGlow() {
    var gradient = ctx.createRadialGradient(
      court.x + court.w / 2, court.y + court.h / 2, 10,
      court.x + court.w / 2, court.y + court.h / 2, court.w / 2
    );
    gradient.addColorStop(0, 'rgba(26, 58, 42, 0.15)');
    gradient.addColorStop(1, 'rgba(13, 13, 18, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(court.x - 40, court.y - 40, court.w + 80, court.h + 80);
  }

  /**
   * Draws the badminton court with proper lines and zones.
   */
  function drawCourt() {
    // Court surface
    ctx.fillStyle = COURT_COLOR;
    ctx.beginPath();
    ctx.roundRect(court.x, court.y, court.w, court.h, 4);
    ctx.fill();

    // Court outline
    ctx.strokeStyle = COURT_LINE_COLOR;
    ctx.lineWidth = COURT_LINE_WIDTH;
    ctx.beginPath();
    ctx.roundRect(court.x, court.y, court.w, court.h, 4);
    ctx.stroke();

    // Center line (horizontal)
    ctx.beginPath();
    ctx.moveTo(court.x + court.w / 2, court.y);
    ctx.lineTo(court.x + court.w / 2, court.y + court.h);
    ctx.strokeStyle = COURT_LINE_COLOR;
    ctx.lineWidth = COURT_LINE_WIDTH;
    ctx.stroke();

    // Service lines
    var serviceLineOffset = court.w * 0.147; // ~1.98m from net
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;

    // Left service line
    ctx.beginPath();
    ctx.moveTo(court.x + court.w / 2 - serviceLineOffset, court.y);
    ctx.lineTo(court.x + court.w / 2 - serviceLineOffset, court.y + court.h);
    ctx.stroke();

    // Right service line
    ctx.beginPath();
    ctx.moveTo(court.x + court.w / 2 + serviceLineOffset, court.y);
    ctx.lineTo(court.x + court.w / 2 + serviceLineOffset, court.y + court.h);
    ctx.stroke();

    // Long service lines (doubles)
    var longServiceOffset = court.w * 0.057;

    ctx.beginPath();
    ctx.moveTo(court.x + longServiceOffset, court.y);
    ctx.lineTo(court.x + longServiceOffset, court.y + court.h);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(court.x + court.w - longServiceOffset, court.y);
    ctx.lineTo(court.x + court.w - longServiceOffset, court.y + court.h);
    ctx.stroke();

    // Center marker line (horizontal midline)
    ctx.beginPath();
    ctx.moveTo(court.x, court.y + court.h / 2);
    ctx.lineTo(court.x + court.w, court.y + court.h / 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.stroke();
  }

  /**
   * Draws the net at the center of the court.
   */
  function drawNet() {
    var netX = court.x + court.w / 2;
    var netY1 = court.y - 4;
    var netY2 = court.y + court.h + 4;

    // Net line
    ctx.beginPath();
    ctx.moveTo(netX, netY1);
    ctx.lineTo(netX, netY2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Net posts
    ctx.beginPath();
    ctx.arc(netX, netY1, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();

    ctx.beginPath();
    ctx.arc(netX, netY2, 3, 0, Math.PI * 2);
    ctx.fill();

    // Net pattern (dashed vertical lines)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 0.5;
    for (var y = court.y; y < court.y + court.h; y += 8) {
      ctx.beginPath();
      ctx.moveTo(netX - 2, y);
      ctx.lineTo(netX + 2, y);
      ctx.stroke();
    }
  }

  /**
   * Draws a player circle with a glow and label.
   */
  function drawPlayer(player, color, side) {
    var px = court.x + player.x * court.w;
    var py = court.y + player.y * court.h;

    // Player glow
    var glow = ctx.createRadialGradient(px, py, 0, px, py, PLAYER_RADIUS * 2.5);
    glow.addColorStop(0, color.replace(')', ', 0.15)').replace('rgb', 'rgba'));
    glow.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(px, py, PLAYER_RADIUS * 2.5, 0, Math.PI * 2);
    ctx.fill();

    // Player body
    ctx.beginPath();
    ctx.arc(px, py, PLAYER_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Inner circle
    ctx.beginPath();
    ctx.arc(px, py, PLAYER_RADIUS * 0.6, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.fill();

    // Player label
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fillText(player.name, px, py - PLAYER_RADIUS - 8);
  }

  /**
   * Draws the shuttle trail (fading circles).
   */
  function drawShuttleTrail() {
    for (var i = 0; i < state.shuttle.trail.length; i++) {
      var t = state.shuttle.trail[i];
      if (t.life <= 0) continue;
      var tx = court.x + t.x * court.w;
      var ty = court.y + t.y * court.h;

      ctx.beginPath();
      ctx.arc(tx, ty, SHUTTLE_RADIUS * t.life * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(201, 168, 76, ' + (t.life * 0.3) + ')';
      ctx.fill();
    }
  }

  /**
   * Draws the shuttle with a pulsing glow.
   */
  function drawShuttle() {
    if (!state.shuttle.active) return;

    var sx = court.x + state.shuttle.x * court.w;
    var sy = court.y + state.shuttle.y * court.h;
    var pulse = 1 + Math.sin(time * 0.1) * 0.15;

    // Shuttle glow
    var glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, SHUTTLE_RADIUS * 3);
    glow.addColorStop(0, 'rgba(201, 168, 76, 0.25)');
    glow.addColorStop(1, 'rgba(201, 168, 76, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(sx, sy, SHUTTLE_RADIUS * 3 * pulse, 0, Math.PI * 2);
    ctx.fill();

    // Shuttle body
    ctx.beginPath();
    ctx.arc(sx, sy, SHUTTLE_RADIUS * pulse, 0, Math.PI * 2);
    ctx.fillStyle = CHAMPAGNE;
    ctx.fill();

    // Shuttle highlight
    ctx.beginPath();
    ctx.arc(sx - 1, sy - 1, SHUTTLE_RADIUS * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fill();
  }

  /**
   * Renders score particles.
   */
  function drawParticles() {
    for (var i = 0; i < particles.length; i++) {
      var p = particles[i];
      var px = court.x + p.x * court.w;
      var py = court.y + p.y * court.h;

      ctx.beginPath();
      ctx.arc(px, py, 2 * p.life, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(201, 168, 76, ' + p.life + ')';
      ctx.fill();
    }
  }


  /* ─── Effects ────────────────────────────────────────── */

  function spawnScoreParticles() {
    var cx = state.shuttle.x;
    var cy = state.shuttle.y;

    for (var i = 0; i < 12; i++) {
      var angle = (Math.PI * 2 / 12) * i;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(angle) * 0.003,
        vy: Math.sin(angle) * 0.003,
        life: 1
      });
    }
  }


  /* ─── HUD Updates ────────────────────────────────────── */

  function updateHUD() {
    var el;

    el = document.getElementById('hud-p1-score');
    if (el) el.textContent = state.score.p1;

    el = document.getElementById('hud-p2-score');
    if (el) el.textContent = state.score.p2;

    el = document.getElementById('hud-rally');
    if (el) el.textContent = state.rally;

    el = document.getElementById('p1-stamina-bar');
    if (el) el.style.width = Math.max(0, state.p1.stamina) + '%';

    el = document.getElementById('p2-stamina-bar');
    if (el) el.style.width = Math.max(0, state.p2.stamina) + '%';

    el = document.getElementById('decision-timer');
    if (el) el.textContent = 'Decision: ' + state.decisionTime + 'ms';

    // Update stamina bar colors based on level
    updateStaminaColor('p1-stamina-bar', state.p1.stamina);
    updateStaminaColor('p2-stamina-bar', state.p2.stamina);
  }

  function updateStaminaColor(elementId, stamina) {
    var el = document.getElementById(elementId);
    if (!el) return;
    if (stamina > 60) {
      el.style.backgroundColor = '#4ade80'; // green
    } else if (stamina > 30) {
      el.style.backgroundColor = '#fbbf24'; // yellow
    } else {
      el.style.backgroundColor = '#f87171'; // red
    }
  }


  /* ─── Action Log ─────────────────────────────────────── */

  var demoActions = [
    { agent: 'Minimax', action: 'SMASH to zone 3', color: '#4A9EFF' },
    { agent: 'MCTS', action: 'CLEAR to zone 1', color: '#FF6B6B' },
    { agent: 'Minimax', action: 'DROP_SHOT zone 5', color: '#4A9EFF' },
    { agent: 'MCTS', action: 'LOB to zone 2', color: '#FF6B6B' },
    { agent: 'System', action: 'Rally point awarded to P1', color: '#C9A84C' },
    { agent: 'Minimax', action: 'DRIVE to zone 4', color: '#4A9EFF' },
    { agent: 'MCTS', action: 'NET_SHOT zone 6', color: '#FF6B6B' },
    { agent: 'System', action: 'Stamina penalty: -5', color: '#C9A84C' },
    { agent: 'Fuzzy', action: 'CLEAR (low stamina rule)', color: '#4ade80' },
  ];

  function addActionLogEntry() {
    var log = document.getElementById('action-log');
    if (!log) return;

    var action = demoActions[Math.floor(Math.random() * demoActions.length)];

    var entry = document.createElement('div');
    entry.className = 'action-log-entry text-ivory-muted/80';
    entry.innerHTML =
      '<span style="color:' + action.color + '">[' + action.agent + ']</span> ' +
      action.action;

    log.appendChild(entry);

    // Keep log manageable
    var entries = log.querySelectorAll('.action-log-entry');
    if (entries.length > 30) {
      entries[0].remove();
    }

    log.scrollTop = log.scrollHeight;
  }


  /* ─── Public Controls ────────────────────────────────── */

  function play() {
    if (!isPlaying) {
      isPlaying = true;
      loop();
    }
  }

  function pause() {
    isPlaying = false;
    if (animFrameId) {
      cancelAnimationFrame(animFrameId);
      animFrameId = null;
    }
  }

  function togglePlay() {
    if (isPlaying) {
      pause();
    } else {
      play();
    }
    return isPlaying;
  }

  function reset() {
    state.score.p1 = 0;
    state.score.p2 = 0;
    state.rally = 0;
    state.p1.stamina = 100;
    state.p2.stamina = 100;
    state.p1.x = 0.25;
    state.p1.y = 0.5;
    state.p2.x = 0.75;
    state.p2.y = 0.5;
    state.shuttle.x = 0.5;
    state.shuttle.y = 0.5;
    state.shuttle.trail = [];
    particles = [];
    time = 0;
    updateHUD();

    // Clear action log
    var log = document.getElementById('action-log');
    if (log) {
      log.innerHTML = '<div class="text-ivory-muted/50">&gt; Match reset. Awaiting start...</div>';
    }
  }

  /**
   * Updates the game state from API data.
   * @param {object} apiState - Game state from FastAPI
   */
  function updateFromAPI(apiState) {
    if (!apiState) return;
    state.isDemo = false;

    if (apiState.player_pos) {
      state.p1.x = apiState.player_pos.x || state.p1.x;
      state.p1.y = apiState.player_pos.y || state.p1.y;
    }
    if (apiState.opponent_pos) {
      state.p2.x = apiState.opponent_pos.x || state.p2.x;
      state.p2.y = apiState.opponent_pos.y || state.p2.y;
    }
    if (apiState.shuttle_zone !== undefined) {
      // Map zone to x/y position on court
      state.shuttle.x = zoneToX(apiState.shuttle_zone);
      state.shuttle.y = zoneToY(apiState.shuttle_zone);
    }
    if (apiState.stamina !== undefined) {
      state.p1.stamina = apiState.stamina;
    }
    if (apiState.score) {
      state.score = apiState.score;
    }
  }

  /**
   * Maps a court zone number to an x coordinate (0-1 range).
   */
  function zoneToX(zone) {
    var zones = {
      1: 0.17, 2: 0.17, 3: 0.33, 4: 0.33,
      5: 0.67, 6: 0.67, 7: 0.83, 8: 0.83
    };
    return zones[zone] || 0.5;
  }

  /**
   * Maps a court zone number to a y coordinate (0-1 range).
   */
  function zoneToY(zone) {
    var zones = {
      1: 0.25, 2: 0.75, 3: 0.25, 4: 0.75,
      5: 0.25, 6: 0.75, 7: 0.25, 8: 0.75
    };
    return zones[zone] || 0.5;
  }


  /* ─── Public Interface ───────────────────────────────── */
  return {
    init: init,
    play: play,
    pause: pause,
    togglePlay: togglePlay,
    reset: reset,
    updateFromAPI: updateFromAPI,
    getState: function () { return state; }
  };

})();


/* ─── Global Game Controls (bound to HTML onclick) ───────── */

function toggleGamePlay() {
  var playing = GameCanvas.togglePlay();
  var btn = document.getElementById('btn-play-pause');
  if (btn) {
    btn.innerHTML = playing
      ? '<i data-lucide="pause" class="w-3 h-3 inline-block"></i> PAUSE'
      : '<i data-lucide="play" class="w-3 h-3 inline-block"></i> PLAY';
    // Re-render lucide icons
    if (window.lucide) lucide.createIcons();
  }
}

function resetGame() {
  GameCanvas.reset();
}
