# SmartSmash — GitHub AI Coding & Contribution Instructions

## 1. Project Context

SmartSmash is an **academic Artificial Intelligence project** developed for **CSE 3209 – Artificial Intelligence**.

The project simulates a badminton game to **compare classical AI agent behaviors** under identical constraints. Implemented agents include:

* Minimax with heuristic evaluation
* Monte Carlo Tree Search (MCTS)
* Fuzzy Logic–based agent

### Primary Goal

**Algorithmic correctness, explainability, and fair comparison of agents.**

Visual fidelity, graphical realism, and UI frameworks are explicitly secondary and must never compromise AI clarity or correctness.

This repository must be treated as an **AI systems project**, not a commercial game or machine-learning experiment.

---

## 2. Core Design Principles (Non-Negotiable)

All generated code, refactors, or suggestions must adhere to the following principles:

1. Prioritize AI reasoning clarity over performance tricks
2. Maintain strict fairness between agents
3. Use only **classical AI techniques**
4. Preserve separation of concerns across layers
5. Favor explicit, explainable logic over abstraction-heavy patterns

---

## 3. Forbidden Technologies and Approaches

The following must **never** be introduced into this repository:

* Neural networks
* Deep learning
* Reinforcement learning
* Q-learning or policy gradients
* OpenAI Gym
* TensorFlow
* PyTorch
* Scikit-learn
* Any black-box or learning-based decision system

If a task resembles reinforcement learning, it must instead be implemented using:

* search
* heuristics
* simulation
* rule-based logic

---

## 4. Allowed Technologies

### Backend / AI & Simulation

* Python 3.x
* Python standard library
* numpy (numerical computation)
* pyyaml (configuration loading)
* matplotlib (evaluation and analysis plots)

### Frontend / Visualization

* HTML
* CSS
* Vanilla JavaScript
* Canvas API
* Three.js via CDN only

No npm, no Node.js toolchain, no frontend frameworks.

---

## 5. Architecture and Responsibilities

### 5.1 Core Abstractions

#### `src/core/`

* Contains **pure logic only**
* `GameState` is the **Data Transfer Object (DTO)** exchanged between components
* No rendering, no AI logic, no side effects

#### `src/agents/`

* Contains **isolated AI agent implementations**
* Each agent must:

  * Inherit from `BaseAgent`
  * Reside in its own package (e.g., `src/agents/minimax/`)
  * Be stateless between `select_action` calls
  * NEVER modify the `GameState` object directly
  * NEVER access visualization or UI logic

#### `src/environment/`

* Acts as the **authoritative referee**
* `Simulator`:

  * Applies actions
  * Enforces rules and physical constraints
  * Updates stamina, power, score, and rally outcome
* Generates reward or outcome signals (for evaluation only, not learning)

---

## 6. Data Flow Contract (Must Be Preserved)

1. `MatchRunner` initializes a `GameState`
2. Loop until terminal condition:

   * `Simulator` passes a **copy** of `GameState` to the active agent
   * Agent returns an `Action`
   * `Simulator` validates the action using `Rules`
   * `Simulator` updates the authoritative `GameState`
3. Results are logged to structured JSON

Agents must never:

* mutate shared state
* bypass the simulator
* infer hidden information

---

## 7. Game Modeling Rules

* The game is **turn-based from the AI perspective**
* A decision point occurs only when the shuttle reaches a player
* Each agent selects exactly **one action per turn**
* State transitions must be explicit and traceable
* Any randomness must be:

  * controlled
  * configurable
  * explainable

---

## 8. State Representation Rules

All agents must consume the **same structured GameState**, including:

* Player position
* Opponent position
* Shuttle height
* Shuttle court zone
* Player stamina
* Opponent stamina
* Player power level
* Opponent power level
* Active power
* Score difference
* Current player turn

No agent-specific hidden state is allowed.

---

## 9. AI Agent Implementation Rules

### 9.1 Minimax Agent

* Must use depth-limited minimax
* Must use a handcrafted heuristic
* Heuristic factors must be explicit and documented
* Alpha-beta pruning is allowed but optional

### 9.2 Monte Carlo Tree Search Agent

* Must implement:

  * Selection
  * Expansion
  * Simulation
  * Backpropagation
* Must use UCT or a clearly defined selection policy
* Simulation budget must be configurable via YAML

### 9.3 Fuzzy Logic Agent

* Must use:

  * Membership functions
  * Rule base
  * Inference mechanism
* Must remain deterministic and interpretable
* Must not adapt or learn over time

---

## 10. Configuration Rules

* **NO hardcoded values**
* All tunable parameters must live in `config/*.yaml`, including:

  * Minimax depth
  * MCTS simulation count
  * Movement costs
  * Stamina costs
  * Power thresholds

Configurations must be loaded at runtime using:

* `pyyaml`
* `src/utils/serializer.py`

---

## 11. Coding Style Guidelines

Generated code must be:

* Readable and modular
* Explicit rather than implicit
* Heavily commented where logic is non-trivial
* Easy to explain in viva examinations

Avoid:

* Over-optimization
* Dense one-liners
* Metaprogramming
* Magic numbers

Prefer:

* Clear variable names
* Small, focused functions
* Explicit control flow

---

## 12. Evaluation and Logging

### Metrics to Track

* `decision_time`
* `stamina_remaining`
* `power_used`
* `rally_length`
* match outcome

### Logging Rules

* Output must be written to `logs/`
* Format must be structured JSON
* Logs must be parseable by `scripts/generate_plots.py`
* Evaluation logic must be separated from gameplay logic

---

## 13. UI and Visualization Guidelines

Visualization exists to **explain AI behavior**, not to drive gameplay.

UI code must:

* Be state-driven
* Reflect AI decisions explicitly
* Display decision panels and HUD elements
* Avoid excessive animation or visual noise

Visualization must never:

* influence AI decisions
* modify game state
* embed game logic

---

## 14. Developer Workflow

### Dependencies

Restricted to:

* numpy
* pyyaml
* matplotlib
* Python standard library

### Execution

* Run single match: `python src/main.py`
* Run tournament: `python scripts/run_all_matches.py`
* Visualization: open `src/visualization/web/index.html` (consumes JSON logs)

### Testing

* Use `pytest`
* Mock the `Simulator` when testing agent logic
* Focus tests on:

  * state transitions
  * action validity
  * agent interfaces

---

## 15. Academic Framing

All generated code comments, documentation, and explanations must:

* Use formal, academic language
* Be suitable for AI course evaluation
* Emphasize reasoning, comparison, and design choices
* Avoid casual or marketing-oriented tone

---

## 16. Final Instruction

SmartSmash is a **comparative AI systems project**.

Every contribution must be defensible from:

* classical AI theory
* system design principles
* the CSE 3209 syllabus

When in doubt, **favor explainability, correctness, and fairness over sophistication**.

---

