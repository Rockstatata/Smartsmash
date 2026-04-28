# PRODUCT REQUIREMENTS DOCUMENT (PRD)

## Project Name

**SmartSmash – Multi-Agent AI Badminton Game**

## Course

CSE 3209 – Artificial Intelligence

## Project Type

Semester Final Project + AI Laboratory Project

## Team Size

3 Members

---

## 1. Purpose of the Document

This Product Requirements Document (PRD) defines the **functional**, **non-functional**, and **technical implementation requirements** for the SmartSmash project.

The document serves as:

* A complete specification for development
* A justification of design decisions
* A reference for academic evaluation and viva examination

---

## 2. Project Overview

SmartSmash is a two-player badminton game designed to **compare classical Artificial Intelligence algorithms** in a controlled, competitive environment.

The project emphasizes:

* AI decision-making
* State-space modeling
* Algorithmic behavior comparison

The game is **AI vs AI**, and although visually continuous, it is modeled internally as a **turn-based decision system** to ensure algorithmic clarity and fairness.

---

## 3. Goals and Objectives

### 3.1 Primary Goals

* Implement multiple classical AI agents
* Compare their behavior under identical constraints
* Visualize AI decisions clearly and intuitively
* Maintain strict alignment with the AI syllabus

### 3.2 Secondary Goals

* Provide a polished, game-like UI/UX experience
* Enable step-by-step visualization of AI reasoning
* Generate evaluative metrics for analysis

---

## 4. Target Users

| User Type   | Description                              |
| ----------- | ---------------------------------------- |
| Students    | Developers and presenters of the project |
| Instructors | Evaluators of AI correctness and design  |
| Examiners   | Viva and lab exam assessors              |

The system is **not** intended for general gaming audiences.

---

## 5. Game Concept and Rules

### 5.1 Match Rules (Implemented)

* Two AI players compete
* One game to 21 points (`target_score` = 21 in agents and API)
* Point winner acts next (`current_turn` becomes `point_winner`)
* Best-of-3 is planned but not yet implemented in the backend

### 5.2 Turn-Based Abstraction (Implemented)

* A decision point occurs at every shuttle handoff
* Each agent returns exactly one action per rally exchange
* The backend applies a stochastic rally outcome model and updates score, stamina, power, and shuttle context

---

## 6. Functional Requirements (Implemented Behavior)

### 6.1 Game Flow Requirements

The system shall support the following screens:

1. Splash / Intro Screen
2. Main Menu
3. Game Mode Selection
4. Agent Selection
5. Match Setup Summary
6. Gameplay Screen
7. Pause Menu
8. Settings Screen
9. Result Screen

Each screen shall be navigable through a centralized UI state controller.

---

### 6.2 Gameplay Functional Requirements (Implemented)

#### FR-1: Player Actions

The system supports the following discrete action vocabulary:

* Shot actions: `SMASH`, `CLEAR`, `DROP_SHOT`, `DRIVE`, `LOB`, `NET_SHOT`, `SPECIAL`
* Movement actions (optional by agent config): `MOVE_LEFT`, `MOVE_RIGHT`, `STAY`

#### FR-2: Resources

The system manages:

* **Stamina (0-100)**
  * Decreases by action-specific costs
  * Restricts `SMASH` and `SPECIAL` via minimum thresholds
* **Power (0-100)**
  * Gains per action, enables `SPECIAL` when full

#### FR-3: Special Power Action

`SPECIAL` is implemented as a high-impact shot with power reset. Activation is explicitly chosen by the active AI agent when thresholds permit.

---

### 6.3 AI Agent Implementation (Actual)

#### FR-4: Common AI Interface

All AI agents:

* Inherit from `BaseAgent`
* Accept a `GameState`-like snapshot (dict or object)
* Return one action per call via `select_action` (or `(action, explanation)` via `decide`)
* Never mutate the authoritative game state

#### FR-5: Minimax Agent (Depth-Limited with Alpha-Beta)

Implementation highlights:

* Depth-limited minimax with alpha-beta pruning (default depth = 3)
* Action ordering and max branching (default = 8) configured in `config/agent_config.yaml`
* Transposition caching with rounded state keys
* Transition model uses `action_effects` to update `stamina`, `power`, `shuttle_height`, `shuttle_zone`, and lateral position
* Action constraints enforce minimum stamina for `SMASH` and minimum power for `SPECIAL`
* Heuristic features (weighted, normalized):
  * `positional_advantage`, `stamina_advantage`, `power_advantage`
  * `offensive_opportunity`, `defensive_risk`, `score_pressure`
  * `rally_state_bias` (attack/defense/neutral)
* Rally state classification:
  * attack: `shuttle_height` >= `attack_height` and opponent distance >= `opponent_near`
  * defense: `shuttle_height` <= `defense_height` or `stamina` <= `low_stamina`
  * neutral otherwise

Decision tree shape: a depth-limited search tree with ordered actions at each node, pruned by alpha-beta and bounded by max branching.

#### FR-6: Monte Carlo Tree Search Agent (UCT)

Implementation highlights:

* Four phases: selection (UCT), expansion (one untried action), simulation (rollout), backpropagation
* Default parameters: 1000 simulations, rollout depth 8, exploration constant 1.414
* Action validity gated by stamina/power thresholds (`min_smash_stamina`, `min_special_stamina`, `min_special_power`)
* Internal stochastic rollout model:
  * Stamina cost and power gain per action
  * Defender stamina cost and small between-rally recovery
  * Win probability estimated from shuttle height, zone, stamina, power, and score
* Action selection: highest visit count at the root (ties broken by win rate)
* Stochastic by default; reproducible with an explicit RNG seed

Decision tree shape: a growing UCT tree where nodes track visits and value for `player_just_moved`, with selection guided by UCT scores.

#### FR-7: Fuzzy Logic Agent (Mamdani)

Implementation highlights:

* Fuzzifies: `shuttle_height`, `shuttle_lateral`, `shuttle_depth`, `player_stamina`, `opponent_stamina`, `player_power`, `opponent_distance`, `score_diff`
* Membership functions: triangular/trapezoidal, hand-written for academic transparency
* Rule base: 22 weighted rules producing intents for aggression, defense, movement, and shot type
* Inference: AND = min, aggregation = max (Mamdani)
* Defuzzification: weighted scoring over concrete actions
* Default fallback action: `DRIVE` when no rule fires strongly

Decision logic shape: a rule firing graph with intent aggregation and weighted action scoring.

---

### 6.4 Explainability Payloads (Actual)

* **Minimax** returns: `action`, `score`, `depth`, `nodes_explored`, `cutoffs`, `cache_hits`, `top_actions`, `features`, `contributions`, `reasoning`, `decision_time_ms`
* **MCTS** returns: `action`, `confidence`, `simulations`, `win_rate`, `tree_depth`, `root_visits`, `action_stats` (`visits`, `win_rate`, `depth`), `reasoning`, `decision_time_ms`
* **Fuzzy** returns: `action`, `confidence`, `triggered_rules`, `fuzzy_values` (dominant labels), `raw_memberships`, `action_scores`, `decision_time_ms`

### 6.5 Match Execution and Persistence (Actual)

* `/api/match/start` registers agents and creates the initial `GameState`
* `/api/match/{id}/decide` returns an action and explanation without mutating the match
* `/api/match/{id}/step` executes one rally:
  * Builds a per-side snapshot
  * Applies action costs/gains and a stochastic rally winner model
  * Updates `score`, `stamina`, `power`, `shuttle_zone`, `shuttle_height`
  * Terminates at 21 points
* Match history and leaderboard are persisted to Supabase when configured; otherwise stored in memory
* `/api/match/run` is a lightweight fallback that simulates a match via random scoring (not agent-driven)

### 6.6 Current Results Snapshot (Reference Data)

The API exposes a reference leaderboard when Supabase is not configured. These values are seed data used for UI display, not automated evaluation outputs:

| Agent   | ELO  | Win rate (%) | Matches | Source |
| ------- | ---- | ------------ | ------- | ------ |
| Minimax | 1847 | 72.5         | 48      | API fallback leaderboard |
| MCTS    | 1792 | 65.8         | 48      | API fallback leaderboard |
| Fuzzy   | 1685 | 52.1         | 48      | API fallback leaderboard |

Automated metrics in `src/backend/evaluation` are placeholders, and JSON log generation to `logs/` is not yet implemented.

---

## 7. State Representation Requirements (Implemented)

### 7.1 Game State Definition

Each AI agent receives a `GameState` snapshot with the following fields (directly or as attributes):

* `player_pos` and `opponent_pos` (normalized x/y positions)
* `shuttle_zone` (1-8) and `shuttle_height` (meters)
* `stamina` and `power` for the active player
* `opponent_stamina` and `opponent_power`
* `score` (`p1`, `p2`)
* `current_turn` (`p1` or `p2`)
* `last_action` (optional, populated by `/api/match/{id}/step`)

The MCTS agent maps this snapshot into an internal `p1_*`/`p2_*` representation for rollouts while preserving identical observable information.

---

## 8. Non-Functional Requirements (Actual)

### 8.1 Performance

* Decision time is measured and returned per decision (`decision_time_ms`)
* MCTS simulations and rollout depth are configurable
* UI rendering is decoupled from backend decision making

### 8.2 Modularity

* AI agents are interchangeable via `make_agent` and the API registry
* Visualization is decoupled from AI logic (FastAPI provides decisions)
* Action effects are centralized per agent module (minimax action model, MCTS rollout model)

### 8.3 Explainability

* Each agent returns a structured explanation payload
* UI can display reasoning, top actions, and rule activations

### 8.4 Academic Compliance

* Only classical AI techniques are implemented
* No neural networks or reinforcement learning frameworks are used

---

## 9. System Architecture (Actual)

### 9.1 Layered Architecture

1. **AI Decision Layer**
  * Implemented in `src/backend/agents/`
  * Agents consume `GameState` snapshots and produce actions with explanations

2. **Match Execution Layer**
  * Implemented in `src/backend/api/server.py`
  * Applies rally outcomes, updates resources, and stores match history
  * The `environment/Simulator` class is currently a stub and not wired into live matches

3. **Visualization Layer**
  * Implemented in `src/frontend` (Vite + React)
  * Requests decisions from the API and renders state updates

AI agents do not interact with rendering components and operate only on state snapshots.

---

## 10. Implementation Requirements (Actual)

### 10.1 Backend (AI & Simulation)

**Language:** Python

Core modules:

* AI agents (minimax, MCTS, fuzzy)
* FastAPI backend bridge with Supabase integration
* Config loading via YAML

### 10.2 Frontend (Visualization)

**Technologies:**

* React + Vite
* HTML/CSS
* Canvas-based visualization

---

## 11. UI / UX Requirements

### 11.1 Gameplay UI Elements

* Court visualization
* Player animations
* Shuttle trajectory
* Stamina bars
* Power bars
* Scoreboard

### 11.2 AI Decision Panel

The UI shall display:

* Active agent name
* Chosen action
* Algorithm-specific metadata

  * Minimax depth / heuristic score
  * MCTS simulations / win probability

### 11.3 Controls

* Pause
* Resume
* Step-by-step mode
* Fast forward

---

## 12. Configuration Requirements

Game parameters are configurable via external files:

* `config/agent_config.yaml` (minimax weights, action effects, MCTS simulations)
* `config/game_config.yaml` (court dimensions)
* MCTS can also override simulations, rollout_depth, and exploration_constant at runtime

---

## 13. Constraints and Assumptions

### 13.1 Constraints

* Fixed 2-player gameplay
* AI vs AI only (primary mode)
* Classical AI only

### 13.2 Assumptions

* Users understand AI basics
* Visualization is illustrative, not physically accurate

---

## 14. Risks and Mitigation

| Risk               | Mitigation               |
| ------------------ | ------------------------ |
| Complex UI delays  | Modular, screen-based UI |
| AI too slow        | Depth/simulation limits  |
| Stochastic variance | Seeded runs for repeatability |
| Visualization bugs | AI runs independently    |
| Over-engineering   | Strict scope control     |

---

## 15. Success Criteria

The project will be considered successful if:

* All three AI agents can play complete games to 21 points via the API
* AI behaviors are observably different and explainable
* The UI communicates decisions using the explanation payloads
* Match history and leaderboard data are available (Supabase or in-memory)
* The project aligns with syllabus expectations

---

## 16. Future Enhancements (Out of Scope)

* Human vs AI mode
* Online multiplayer
* Reinforcement learning agents
* Advanced physics simulation
* Best-of-3 match format and full evaluation/logging pipeline

---

## 17. Conclusion

SmartSmash is a structured, academically rigorous AI project that combines classical AI algorithms, controlled simulation, and meaningful visualization. The project prioritizes explainability, fairness, and comparative analysis over graphical complexity, ensuring both technical correctness and strong academic presentation.
