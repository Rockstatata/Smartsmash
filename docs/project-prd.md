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

### 5.1 Match Rules

* Two AI players compete
* 5 points required to win a game
* Best of 3 games wins the match

### 5.2 Turn-Based Abstraction

* A turn occurs when the shuttle reaches a player
* AI selects one action per turn
* Environment simulates the outcome

---

## 6. Functional Requirements

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

### 6.2 Gameplay Functional Requirements

#### FR-1: Player Actions

The system shall support the following actions:

* Move Left
* Move Right
* Short Hit
* Long Hit
* Jump Smash
* Special Power Shot (conditional)

#### FR-2: Resources

The system shall manage:

* **Stamina**

  * Decreases with movement and aggressive actions
  * Restricts jump smash usage
* **Power Bar**

  * Fills during rallies
  * Enables special powers when full

#### FR-3: Special Powers

The system shall support:

* Speed Burst
* Super Smash
* Illusion
* Time Slow

Power activation must be explicitly decided by AI agents.

---

### 6.3 AI Agent Functional Requirements

#### FR-4: Common AI Interface

All AI agents shall:

* Observe the same game state
* Choose one action per turn
* Operate independently of visualization

#### FR-5: Minimax Agent

* Uses depth-limited minimax search
* Uses heuristic evaluation
* Assumes optimal opponent behavior

#### FR-6: Monte Carlo Tree Search Agent

* Uses simulation-based search
* Employs UCT for node selection
* Uses probabilistic rollouts

#### FR-7: Fuzzy Logic Agent

* Uses fuzzy membership functions
* Uses rule-based inference
* Makes reactive decisions

---

### 6.4 Evaluation and Logging Requirements

#### FR-8: Match Evaluation

The system shall log:

* Chosen actions
* Decision time
* Stamina usage
* Power usage
* Match outcomes

#### FR-9: Metrics Generation

The system shall compute:

* Win rates
* Average decision time
* Resource efficiency

---

## 7. State Representation Requirements

### 7.1 Game State Definition

Each AI agent shall receive a `GameState` object containing:

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

This representation must be **identical for all agents**.

---

## 8. Non-Functional Requirements

### 8.1 Performance

* AI decision time should be measurable
* MCTS simulations should be configurable
* UI rendering must not block AI computation

### 8.2 Modularity

* AI agents must be interchangeable
* Visualization must be decoupled from AI logic
* Game rules must be centralized

### 8.3 Explainability

* AI decisions should be visible to users
* Decision panels must display reasoning metadata

### 8.4 Academic Compliance

* Only classical AI algorithms allowed
* No neural networks
* No reinforcement learning frameworks

---

## 9. System Architecture

### 9.1 Layered Architecture

1. **AI Decision Layer**

   * Implements all AI agents
   * Consumes abstract game states

2. **Game Simulation Layer**

   * Applies rules
   * Updates state
   * Acts as authoritative referee

3. **Visualization Layer**

   * Renders game state
   * Displays AI decisions
   * No influence on logic

AI agents must never directly interact with rendering components.

---

## 10. Implementation Requirements

### 10.1 Backend (AI & Simulation)

**Language:** Python

Modules:

* Game state management
* Rule enforcement
* AI algorithms
* Logging and evaluation

### 10.2 Frontend (Visualization)

**Technologies:**

* HTML
* CSS
* Vanilla JavaScript
* Canvas or CDN-based Three.js

No frontend framework or build system is required.

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

Game parameters shall be configurable via external files:

* Points to win
* Stamina costs
* Power thresholds
* MCTS simulation count
* Minimax depth

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
| Visualization bugs | AI runs independently    |
| Over-engineering   | Strict scope control     |

---

## 15. Success Criteria

The project will be considered successful if:

* All three AI agents can play complete matches
* AI behaviors are observably different
* UI clearly communicates decisions
* Evaluation metrics can be generated
* Project aligns with syllabus expectations

---

## 16. Future Enhancements (Out of Scope)

* Human vs AI mode
* Online multiplayer
* Reinforcement learning agents
* Advanced physics simulation

---

## 17. Conclusion

SmartSmash is a structured, academically rigorous AI project that combines classical AI algorithms, controlled simulation, and meaningful visualization. The project prioritizes explainability, fairness, and comparative analysis over graphical complexity, ensuring both technical correctness and strong academic presentation.
