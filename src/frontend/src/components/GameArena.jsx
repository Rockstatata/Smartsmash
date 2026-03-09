import { useRef, useEffect, useState } from 'react';
import { Play, Pause } from 'lucide-react';
import useGameCanvas from '../hooks/useGameCanvas';

/**
 * GameArena section — Real-Time Canvas.
 * Contains the game canvas, HUD bar, stamina overlays,
 * decision timer, and action log panel.
 */
export default function GameArena() {
  const canvasRef = useRef(null);
  const logRef = useRef(null);
  const { hudState, actionLog, togglePlay, reset, isPlayingRef } = useGameCanvas(canvasRef);

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
    const playingNow = togglePlay();
    setPlayState(playingNow);
  };

  // Local state for button display since isPlayingRef is a ref
  const [playState, setPlayState] = useState(true);

  return (
    <section id="game-arena" className="relative py-24 md:py-32 bg-obsidian-light/30">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-12">
          <span className="text-xs tracking-[0.3em] uppercase text-champagne font-data">Live Arena</span>
          <h2 className="mt-4 text-3xl md:text-5xl font-bold">Real-Time Arena</h2>
        </div>

        <div className="relative">
          <div className="relative bg-obsidian border border-white/5 rounded-2xl overflow-hidden shadow-[0_0_80px_rgba(201,168,76,0.05)]">
            {/* Top HUD Bar */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-obsidian-light/50">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse-slow" />
                  <span className="text-xs font-data text-ivory-muted">LIVE</span>
                </div>
                <span className="text-xs font-data text-ivory-muted">
                  Rally #<span>{hudState.rally}</span>
                </span>
              </div>
              <div className="flex items-center gap-6">
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
              <div className="flex items-center gap-3">
                <button
                  className="px-3 py-1.5 bg-champagne/10 text-champagne text-xs font-data rounded-lg hover:bg-champagne/20 transition-all flex items-center gap-1"
                  onClick={handleToggle}
                >
                  {playState ? (
                    <><Pause className="w-3 h-3" /> PAUSE</>
                  ) : (
                    <><Play className="w-3 h-3" /> PLAY</>
                  )}
                </button>
                <button
                  className="px-3 py-1.5 bg-white/5 text-ivory-muted text-xs font-data rounded-lg hover:bg-white/10 transition-all"
                  onClick={reset}
                >
                  RESET
                </button>
              </div>
            </div>

            {/* Canvas + Side Panel */}
            <div className="flex flex-col lg:flex-row">
              {/* Game Canvas */}
              <div className="flex-1 relative">
                <canvas ref={canvasRef} className="game-canvas-el w-full" style={{ aspectRatio: '16/10' }} />
                {/* Stamina Bars Overlay */}
                <div className="absolute bottom-4 left-4 right-4 flex justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-data text-ivory-muted uppercase">Stamina</span>
                    <div className="w-24 h-1.5 bg-slate rounded-full overflow-hidden">
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
                    <div className="w-24 h-1.5 bg-slate rounded-full overflow-hidden">
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
                <div className="absolute top-4 left-1/2 -translate-x-1/2">
                  <div className="px-3 py-1 bg-obsidian/80 backdrop-blur-sm rounded-full border border-white/10">
                    <span className="text-[10px] font-data text-champagne">
                      Decision: {hudState.decisionTime}ms
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Log Panel */}
              <div className="w-full lg:w-72 border-t lg:border-t-0 lg:border-l border-white/5 bg-obsidian-light/30">
                <div className="px-4 py-3 border-b border-white/5">
                  <span className="text-[10px] font-data uppercase tracking-widest text-ivory-muted">Action Log</span>
                </div>
                <div
                  ref={logRef}
                  className="p-4 h-48 lg:h-80 overflow-y-auto font-data text-xs space-y-1.5 action-log"
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
        </div>
      </div>
    </section>
  );
}


