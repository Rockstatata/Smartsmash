import { useState, useEffect, useRef, useCallback } from 'react';
import { Cpu, Activity, SlidersHorizontal } from 'lucide-react';

/**
 * Features section — AI System Artifacts.
 * Three feature cards: Simulation Engine (diagnostic shuffler),
 * Agent Telemetry (typewriter feed), Coach Mode (strategy grid + cursor).
 */
export default function Features() {
  return (
    <section id="agents" className="relative py-24 md:py-32">
      <div className="max-w-7xl mx-auto px-6">
        {/* Section Header */}
        <div className="text-center mb-16 feature-header">
          <span className="text-xs tracking-[0.3em] uppercase text-champagne font-data">System Artifacts</span>
          <h2 className="mt-4 text-3xl md:text-5xl font-bold">Core Intelligence</h2>
        </div>

        {/* Feature Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SimulationEngineCard />
          <AgentTelemetryCard />
          <CoachModeCard />
        </div>
      </div>
    </section>
  );
}


/* ─── Card 1: Simulation Engine — Diagnostic Shuffler ─── */

const DIAGNOSTIC_LABELS = ['Deterministic Turn System', 'Configurable Parameters', 'State Trace Logging'];

function SimulationEngineCard() {
  const labels = DIAGNOSTIC_LABELS;
  const [currentLabel, setCurrentLabel] = useState(labels[0]);
  const [shuffleClass, setShuffleClass] = useState('');

  useEffect(() => {
    let index = 0;
    const interval = setInterval(() => {
      setShuffleClass('shuffle-out');
      setTimeout(() => {
        index = (index + 1) % labels.length;
        setCurrentLabel(labels[index]);
        setShuffleClass('shuffle-in');
        setTimeout(() => setShuffleClass(''), 50);
      }, 300);
    }, 2500);
    return () => clearInterval(interval);
  }, [labels]);

  return (
    <div className="feature-card group relative bg-obsidian-light border border-white/5 rounded-2xl p-8 hover:border-champagne/20 transition-all duration-500 overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-champagne/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-champagne/10 transition-all duration-700" />
      <div className="relative z-10">
        <div className="w-10 h-10 rounded-lg bg-champagne/10 flex items-center justify-center mb-6">
          <Cpu className="w-5 h-5 text-champagne" />
        </div>
        <h3 className="text-xl font-bold mb-2">Simulation Engine</h3>
        <div className="h-6 mb-4">
          <p className={`text-sm text-champagne font-data diagnostic-label ${shuffleClass}`}>
            {currentLabel}
          </p>
        </div>
        <p className="text-sm text-ivory-muted leading-relaxed">
          Fully deterministic classical AI simulation environment with configurable parameters,
          complete state tracing, and reproducible match outcomes.
        </p>
      </div>
    </div>
  );
}


/* ─── Card 2: Agent Telemetry — Typewriter Feed ───────── */

const TELEMETRY_MESSAGES = [
    { prefix: '[Minimax]', text: 'evaluating depth=3', color: 'text-blue-400/80' },
    { prefix: '[Minimax]', text: 'alpha=-Infinity beta=Infinity', color: 'text-blue-400/80' },
    { prefix: '[Minimax]', text: 'pruning branch at node 47', color: 'text-blue-400/80' },
    { prefix: '[Minimax]', text: 'best action: SMASH zone=3', color: 'text-blue-400/80' },
    { prefix: '[MCTS]', text: 'rollout simulation #128', color: 'text-purple-400/80' },
    { prefix: '[MCTS]', text: 'UCT selection: node.visits=34', color: 'text-purple-400/80' },
    { prefix: '[MCTS]', text: 'expansion: new child DROP_SHOT', color: 'text-purple-400/80' },
    { prefix: '[MCTS]', text: 'backpropagation: reward=0.72', color: 'text-purple-400/80' },
    { prefix: '[Fuzzy]', text: 'rule triggered: stamina_low', color: 'text-green-400/80' },
    { prefix: '[Fuzzy]', text: 'membership(stamina)=0.3 LOW', color: 'text-green-400/80' },
    { prefix: '[Fuzzy]', text: 'defuzzified output: CLEAR', color: 'text-green-400/80' },
    { prefix: '[System]', text: 'reward updated', color: 'text-yellow-400/80' },
    { prefix: '[System]', text: 'state transition complete', color: 'text-yellow-400/80' },
    { prefix: '[System]', text: 'rally #14 concluded', color: 'text-yellow-400/80' },
    { prefix: '[Simulator]', text: 'validating action: SMASH', color: 'text-cyan-400/80' },
    { prefix: '[Simulator]', text: 'stamina cost: -8', color: 'text-cyan-400/80' },
    { prefix: '[Simulator]', text: 'shuttle_zone updated: 5→2', color: 'text-cyan-400/80' },
];

function AgentTelemetryCard() {
  const feedRef = useRef(null);
  const [lines, setLines] = useState([
    { id: 0, prefix: '[Minimax]', text: 'evaluating depth=3', color: 'text-green-400/80' },
  ]);

  const messages = TELEMETRY_MESSAGES;
  const lineIdRef = useRef(1);
  const maxLines = 8;

  useEffect(() => {
    let timeoutId;

    function addLine() {
      const msg = messages[Math.floor(Math.random() * messages.length)];
      const id = lineIdRef.current++;

      setLines((prev) => {
        const next = [...prev, { id, ...msg }];
        return next.length > maxLines ? next.slice(-maxLines) : next;
      });

      const delay = 800 + Math.random() * 1500;
      timeoutId = setTimeout(addLine, delay);
    }

    timeoutId = setTimeout(addLine, 1500);
    return () => clearTimeout(timeoutId);
  }, [messages]);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
    }
  }, [lines]);

  return (
    <div className="feature-card group relative bg-obsidian-light border border-white/5 rounded-2xl p-8 hover:border-champagne/20 transition-all duration-500 overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-champagne/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-champagne/10 transition-all duration-700" />
      <div className="relative z-10">
        <div className="w-10 h-10 rounded-lg bg-champagne/10 flex items-center justify-center mb-6">
          <Activity className="w-5 h-5 text-champagne" />
        </div>
        <h3 className="text-xl font-bold mb-2">Agent Telemetry</h3>
        <div
          ref={feedRef}
          className="mt-4 bg-obsidian rounded-lg p-4 font-data text-xs leading-relaxed border border-white/5 h-36 overflow-hidden telemetry-feed"
        >
          {lines.map((line) => (
            <div key={line.id} className={`telemetry-line ${line.color}`}>
              &gt; <span className="text-ivory-muted">{line.prefix}</span> {line.text}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}


/* ─── Card 3: Coach Mode — Strategy Grid + Cursor ─────── */

function CoachModeCard() {
  const [bars, setBars] = useState({ aggression: 70, defense: 45, risk: 55, depth: 80 });
  const [cursorText, setCursorText] = useState('Adjust aggression');

  // Typewriter cursor cycling
  useEffect(() => {
    const actions = [
      'Adjust aggression',
      'Modify depth',
      'Toggle power usage',
      'Save configuration',
      'Optimize defense',
      'Set risk threshold',
    ];
    let currentAction = 0;
    let charIndex = actions[0].length;
    let isDeleting = true;
    const typeSpeed = 60;
    let timeoutId;

    function type() {
      const currentText = actions[currentAction];

      if (!isDeleting) {
        setCursorText(currentText.substring(0, charIndex + 1));
        charIndex++;
        if (charIndex === currentText.length) {
          isDeleting = true;
          timeoutId = setTimeout(type, 2000);
          return;
        }
      } else {
        setCursorText(currentText.substring(0, charIndex - 1));
        charIndex--;
        if (charIndex === 0) {
          isDeleting = false;
          currentAction = (currentAction + 1) % actions.length;
          timeoutId = setTimeout(type, 500);
          return;
        }
      }

      const speed = isDeleting ? typeSpeed / 2 : typeSpeed;
      timeoutId = setTimeout(type, speed);
    }

    timeoutId = setTimeout(type, 3000);
    return () => clearTimeout(timeoutId);
  }, []);

  const handleCellClick = useCallback((key) => {
    const newWidth = 20 + Math.floor(Math.random() * 70);
    setBars((prev) => ({ ...prev, [key]: newWidth }));
  }, []);

  const strategyItems = [
    { key: 'aggression', label: 'Aggression' },
    { key: 'defense', label: 'Defense' },
    { key: 'risk', label: 'Risk' },
    { key: 'depth', label: 'Depth' },
  ];

  return (
    <div className="feature-card group relative bg-obsidian-light border border-white/5 rounded-2xl p-8 hover:border-champagne/20 transition-all duration-500 overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-champagne/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 group-hover:bg-champagne/10 transition-all duration-700" />
      <div className="relative z-10">
        <div className="w-10 h-10 rounded-lg bg-champagne/10 flex items-center justify-center mb-6">
          <SlidersHorizontal className="w-5 h-5 text-champagne" />
        </div>
        <h3 className="text-xl font-bold mb-2">Coach Mode</h3>
        {/* Strategy Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {strategyItems.map((item) => (
            <div
              key={item.key}
              className="strategy-cell bg-obsidian rounded-lg p-3 border border-white/5 hover:border-champagne/30 transition-all cursor-pointer"
              onClick={() => handleCellClick(item.key)}
            >
              <span className="text-[10px] uppercase tracking-widest text-ivory-muted">{item.label}</span>
              <div className="mt-1 h-1.5 bg-slate rounded-full overflow-hidden">
                <div
                  className="h-full bg-champagne rounded-full strategy-bar"
                  style={{ width: `${bars[item.key]}%` }}
                />
              </div>
            </div>
          ))}
        </div>
        {/* Animated cursor text */}
        <div className="mt-4 font-data text-xs text-ivory-muted">
          <span className="text-champagne">&gt;</span> {cursorText}
          <span className="animate-blink text-champagne">▌</span>
        </div>
      </div>
    </div>
  );
}
