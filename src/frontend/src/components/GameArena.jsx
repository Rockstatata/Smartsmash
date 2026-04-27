import { useRef, useEffect, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import useGameCanvas from '../hooks/useGameCanvas';

/**
 * GameArena section — Real-Time Canvas.
 * Contains the game canvas, HUD bar, stamina overlays,
 * decision timer, and action log panel.
 */
export default function GameArena({
  matchSetup = null,
  onPauseRequest = null,
  onResumeRequest = null,
  onMatchComplete = null,
  isPaused = false,
  immersive = false,
  matchInstanceKey = 0,
}) {
  const canvasRef = useRef(null);
  const logRef = useRef(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const p1Human = matchSetup?.players?.p1?.agentType === 'human';
  const p2Human = matchSetup?.players?.p2?.agentType === 'human';
  const hasManualControls = Boolean(matchSetup?.mode === 'competitor' && (p1Human || p2Human));

  const p1ControlRows = [
    { key: 'W / A / S / D', action: 'Move Player 1 (up / left / down / right)' },
    { key: 'J', action: 'Short shot' },
    { key: 'K', action: 'Long clear' },
    { key: 'L', action: 'Smash' },
    { key: 'U', action: 'Trigger ability (if available)' },
  ];

  const p2ControlRows = [
    { key: 'Arrow Keys', action: 'Move Player 2' },
    { key: '1', action: 'Short shot' },
    { key: '2', action: 'Long clear' },
    { key: '3', action: 'Smash' },
    { key: '9', action: 'Trigger ability (if available)' },
  ];

  const globalRows = [
    { key: 'PAUSE Button', action: 'Pause current rally' },
    { key: 'RESET Button', action: 'Restart the current match state' },
  ];

  const {
    hudState,
    actionLog,
    togglePlay,
    reset,
    play,
    pause,
    matchSummary,
    analytics,
  } = useGameCanvas(canvasRef, {
    matchSetup,
    onMatchComplete,
    matchInstanceKey,
    targetScore: 21,
  });

  // Auto-scroll action log
  useEffect(() => {
    if (logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight;
    }
  }, [actionLog]);

  const getStaminaColor = (stamina) => {
    if (stamina > 60) return '#4ade80';
    if (stamina > 30) return '#fbbf24';
    return '#f87171';
  };

  const handleToggle = () => {
    if (playState && onPauseRequest) {
      pause();
      setPlayState(false);
      onPauseRequest();
      return;
    }

    const playingNow = togglePlay();
    setPlayState(playingNow);

    if (!playingNow && onPauseRequest) onPauseRequest();
    if (playingNow && onResumeRequest) onResumeRequest();
  };

  // Local state for button display since isPlayingRef is a ref
  const [playState, setPlayState] = useState(true);

  useEffect(() => {
    if (isPaused) {
      pause();
      setPlayState(false);
      return;
    }
    if (tutorialOpen) {
      pause();
      setPlayState(false);
      return;
    }
    play();
    setPlayState(true);
  }, [isPaused, pause, play, tutorialOpen]);

  const closeTutorial = () => {
    setTutorialOpen(false);
    if (!isPaused) {
      play();
      setPlayState(true);
    }
  };

  const sectionClass = immersive
    ? 'relative'
    : 'relative py-20 sm:py-24 md:py-32 bg-obsidian-light/30';

  return (
    <section id="game-arena" className={sectionClass}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        {tutorialOpen ? (
          <div className="absolute inset-0 z-30 bg-obsidian/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6">
            <div className="w-full max-w-3xl rounded-2xl border border-white/15 bg-obsidian-light/90 shadow-[0_28px_90px_rgba(0,0,0,0.5)]">
              <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 border-b border-white/10">
                <p className="text-[11px] uppercase tracking-[0.22em] text-champagne font-data">Match Tutorial</p>
                <h3 className="mt-2 text-xl sm:text-2xl font-semibold">Control Map Before Rally Start</h3>
                <p className="mt-2 text-sm text-ivory-muted">
                  Review controls once, then start the match. Gameplay is now tuned for slower, weighted movement and smoother transitions.
                </p>
              </div>

              <div className="p-5 sm:p-6 space-y-5">
                {hasManualControls ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {p1Human ? (
                      <div className="rounded-xl border border-white/10 bg-obsidian/65 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-champagne font-data mb-3">Player 1 Controls</p>
                        <div className="space-y-2 text-sm">
                          {p1ControlRows.map((row) => (
                            <div key={row.key} className="flex items-center justify-between gap-3">
                              <span className="font-data text-ivory">{row.key}</span>
                              <span className="text-ivory-muted text-right">{row.action}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    {p2Human ? (
                      <div className="rounded-xl border border-white/10 bg-obsidian/65 p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-champagne font-data mb-3">Player 2 Controls</p>
                        <div className="space-y-2 text-sm">
                          {p2ControlRows.map((row) => (
                            <div key={row.key} className="flex items-center justify-between gap-3">
                              <span className="font-data text-ivory">{row.key}</span>
                              <span className="text-ivory-muted text-right">{row.action}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-obsidian/65 p-4 text-sm text-ivory-muted">
                    Spectator mode is active. Agents control both players automatically while you can pause or reset from the HUD.
                  </div>
                )}

                <div className="rounded-xl border border-white/10 bg-obsidian/65 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-champagne font-data mb-3">Global Match Controls</p>
                  <div className="space-y-2 text-sm">
                    {globalRows.map((row) => (
                      <div key={row.key} className="flex items-center justify-between gap-3">
                        <span className="font-data text-ivory">{row.key}</span>
                        <span className="text-ivory-muted text-right">{row.action}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    className="px-5 py-2.5 rounded-lg bg-champagne text-obsidian font-semibold text-sm hover:bg-champagne-dark transition-colors"
                    onClick={closeTutorial}
                  >
                    Start Match
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!immersive ? (
          <div className="text-center mb-10 sm:mb-12">
            <span className="text-xs tracking-[0.3em] uppercase text-champagne font-data">Live Arena</span>
            <h2 className="mt-4 text-2xl sm:text-3xl md:text-5xl font-bold">Real-Time Arena</h2>
          </div>
        ) : null}

        <div className="relative">
          <div className="relative bg-obsidian border border-white/5 rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(201,168,76,0.05)]">
            {/* Top HUD Bar */}
            <div className="flex flex-col gap-3 px-4 py-3 sm:px-6 border-b border-white/5 bg-obsidian-light/50 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex flex-wrap items-center gap-3 sm:gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse-slow" />
                  <span className="text-xs font-data text-ivory-muted">LIVE</span>
                </div>
                <span className="text-xs font-data text-ivory-muted">
                  Rally #<span>{hudState.rally}</span>
                </span>
                {matchSetup?.mode ? (
                  <span className="text-[10px] font-data px-2 py-0.5 rounded-full border border-white/15 text-champagne uppercase tracking-widest">
                    {matchSetup.mode}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center justify-center gap-4 sm:gap-6">
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-widest text-ivory-muted">
                    P1 — <span className="text-champagne">{hudState.p1Name}</span>
                  </div>
                  <div className="font-data text-lg font-bold">{hudState.p1Score}</div>
                </div>
                <div className="text-xs text-ivory-muted font-data">VS</div>
                <div className="text-center">
                  <div className="text-[10px] uppercase tracking-widest text-ivory-muted">
                    P2 — <span className="text-champagne">{hudState.p2Name}</span>
                  </div>
                  <div className="font-data text-lg font-bold">{hudState.p2Score}</div>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                <button
                  className="px-3 py-2 bg-champagne/10 text-champagne text-xs font-data rounded-lg hover:bg-champagne/20 transition-all flex items-center justify-center gap-1 flex-1 sm:flex-none"
                  onClick={handleToggle}
                >
                  {playState ? (
                    <><Pause className="w-3 h-3" /> PAUSE</>
                  ) : (
                    <><Play className="w-3 h-3" /> PLAY</>
                  )}
                </button>
                <button
                  className="px-3 py-2 bg-white/5 text-ivory-muted text-xs font-data rounded-lg hover:bg-white/10 transition-all flex-1 sm:flex-none"
                  onClick={reset}
                >
                  RESET
                </button>
              </div>
            </div>

            {matchSetup?.players ? (
              <div className="px-4 sm:px-6 py-2 border-b border-white/5 bg-obsidian-light/35 flex flex-wrap items-center gap-2 text-[9px] sm:text-[10px] uppercase tracking-widest font-data">
                {matchSetup?.arena?.name ? (
                  <span className="text-ivory-muted">
                    Arena: <span className="text-champagne">{matchSetup.arena.name}</span>
                  </span>
                ) : null}
                <span className="text-ivory-muted">
                  P1 Ability: <span className="text-champagne">{matchSetup.players.p1?.ability || 'none'}</span>
                </span>
                <span className="text-ivory-muted">
                  P2 Ability: <span className="text-champagne">{matchSetup.players.p2?.ability || 'none'}</span>
                </span>
                <span className="text-ivory-muted">
                  Aggression: <span className="text-champagne">{matchSetup.strategy?.aggression ?? 55}</span>
                </span>
                <span className="text-ivory-muted">
                  Depth: <span className="text-champagne">{matchSetup.strategy?.depth ?? 60}</span>
                </span>
              </div>
            ) : null}

            {/* Canvas + Side Panel */}
            <div className="flex flex-col lg:flex-row">
              {/* Game Canvas */}
              <div className="flex-1 relative bg-obsidian/20">
                <canvas ref={canvasRef} className="game-canvas-el w-full touch-none" style={{ aspectRatio: '16/10' }} />
                {/* Stamina Bars Overlay */}
                <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 flex flex-col gap-2 sm:flex-row sm:justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-data text-ivory-muted uppercase">Stamina</span>
                    <div className="w-20 sm:w-24 h-1.5 bg-slate rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${hudState.p1Stamina}%`,
                          backgroundColor: getStaminaColor(hudState.p1Stamina),
                        }}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-20 sm:w-24 h-1.5 bg-slate rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                          width: `${hudState.p2Stamina}%`,
                          backgroundColor: getStaminaColor(hudState.p2Stamina),
                        }}
                      />
                    </div>
                    <span className="text-[10px] font-data text-ivory-muted uppercase">Stamina</span>
                  </div>
                </div>
                {/* Decision Timer */}
                <div className="absolute top-3 sm:top-4 left-1/2 -translate-x-1/2">
                  <div className="px-3 py-1 bg-obsidian/80 backdrop-blur-sm rounded-full border border-white/10">
                    <span className="text-[10px] font-data text-champagne">
                      Decision: {hudState.decisionTime}ms
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Log Panel */}
              <div className="w-full lg:w-72 xl:w-80 border-t lg:border-t-0 lg:border-l border-white/5 bg-obsidian-light/30">
                <div className="px-4 py-3 border-b border-white/5">
                  <span className="text-[10px] font-data uppercase tracking-widest text-ivory-muted">Action Log</span>
                </div>
                <div
                  ref={logRef}
                  className="p-4 h-44 sm:h-56 lg:h-88 overflow-y-auto font-data text-xs space-y-1.5 action-log"
                >
                  {actionLog.map((entry) => (
                    <div key={entry.id} className={entry.agent ? 'action-log-entry text-ivory-muted/80' : 'text-ivory-muted/50'}>
                      {entry.agent ? (
                        <>
                          <span style={{ color: entry.color }}>[{entry.agent}]</span> {entry.text}
                        </>
                      ) : (
                        entry.text
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {(matchSummary || analytics) && immersive ? (
            <div className="mt-4 rounded-xl border border-white/10 bg-obsidian-light/40 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-ivory-muted font-data">Winner</p>
                <p className="text-sm font-semibold text-champagne">{matchSummary?.winnerName || '-'}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-ivory-muted font-data">Avg Decision</p>
                <p className="text-sm font-semibold text-champagne">{analytics?.averageDecisionMs ?? 0}ms</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-ivory-muted font-data">Ability Uses</p>
                <p className="text-sm font-semibold text-champagne">
                  {(analytics?.abilityActivations?.p1 ?? 0) + (analytics?.abilityActivations?.p2 ?? 0)}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-ivory-muted font-data">Rallies</p>
                <p className="text-sm font-semibold text-champagne">{matchSummary?.rallyCount ?? hudState.rally}</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}


