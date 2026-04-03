import { useRef } from 'react';
import useProtocolCanvases from '../hooks/useProtocolCanvases';

/**
 * Protocol section — The Match Lifecycle.
 * Three protocol steps with canvas micro-animations:
 * shuttlecock rotation, scanning grid, pulsing waveform.
 */
export default function Protocol() {
  const canvas1Ref = useRef(null);
  const canvas2Ref = useRef(null);
  const canvas3Ref = useRef(null);

  useProtocolCanvases(canvas1Ref, canvas2Ref, canvas3Ref);

  const steps = [
    {
      step: 'STEP 01',
      title: 'Initialize State',
      description:
        'Game state is instantiated with initial positions, stamina levels, and shuttle parameters. All agents receive identical state representations.',
      canvasRef: canvas1Ref,
    },
    {
      step: 'STEP 02',
      title: 'Agent Decision',
      description:
        'The active agent evaluates the game state through its decision algorithm — Minimax search, MCTS rollouts, or Fuzzy rule inference.',
      canvasRef: canvas2Ref,
    },
    {
      step: 'STEP 03',
      title: 'Simulation & Outcome',
      description:
        'The simulator validates and applies the action, updates physics, stamina, and determines the rally outcome with full state trace logging.',
      canvasRef: canvas3Ref,
    },
  ];

  return (
    <section id="protocol" className="relative py-20 sm:py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="text-center mb-14 sm:mb-16 md:mb-20">
          <span className="text-xs tracking-[0.3em] uppercase text-champagne font-data">Protocol</span>
          <h2 className="mt-4 text-2xl sm:text-3xl md:text-5xl font-bold">The Match Lifecycle</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 md:gap-8">
          {steps.map((item, i) => (
            <div
              key={i}
              className="protocol-card relative bg-obsidian-light border border-white/5 rounded-2xl p-5 sm:p-6 md:p-8 group hover:border-champagne/20 transition-all duration-500"
            >
              <span className="text-xs font-data text-champagne tracking-widest">{item.step}</span>
              <h3 className="mt-4 text-xl sm:text-2xl font-bold">{item.title}</h3>
              <p className="mt-3 text-sm text-ivory-muted leading-relaxed">{item.description}</p>
              <div className="mt-6 flex justify-center">
                <div className="protocol-canvas-shell">
                  <canvas ref={item.canvasRef} className="protocol-canvas rounded-xl" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
