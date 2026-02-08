

# SmartSmash — Multi-Agent AI Badminton Game

## Course Information

**Course:** CSE 3209 – Artificial Intelligence
**Project Type:** Multi-Agent AI Game (Semester Final + AI Laboratory Project)
**Project Name:** SmartSmash
**Team Size:** 3

---

## 1. Project Overview

SmartSmash is a multi-agent badminton game developed to **design, implement, and compare classical Artificial Intelligence algorithms** within a controlled competitive environment.

The project simulates a two-player badminton match where **AI agents compete against each other**, making decisions at discrete rally points. Although the visual presentation of the game is continuous, all AI reasoning is performed in a **turn-based, abstract decision model**. This abstraction enables clear state representation, algorithmic reasoning, fair comparison between agents, and strict alignment with the Artificial Intelligence syllabus.

The primary objective of SmartSmash is **comparative AI behavior analysis**, not entertainment-focused gameplay.

---

## 2. Project Objectives

The key objectives of this project are:

* Design a badminton game environment suitable for classical AI reasoning
* Model the game as a discrete decision-making problem
* Implement multiple classical AI agents using different paradigms
* Compare agent behavior under identical game constraints
* Analyze decision quality, computational cost, and play styles
* Provide a clean separation between AI logic, game simulation, and visualization

---

## 3. Game Concept and Rules

* Two-player badminton game inspired by Power Badminton
* Primary mode: AI vs AI
* Each rally represents a discrete AI decision point
* First player to score 5 points wins a game
* First player to win 2 games wins the match

The game rules are deterministic and centrally enforced by the simulation layer.

---

## 4. Game Mechanics

### 4.1 Player Actions

Each AI agent may choose one action per decision turn from the following set:

* Move Left
* Move Right
* Short Hit
* Long Hit
* Jump Smash
* Special Power Shot (conditional)

---

### 4.2 Resource Management

#### Stamina

* Decreases with movement and aggressive actions
* Jump smash consumes significant stamina
* Low stamina restricts available actions

#### Power Bar

* Gradually fills during rallies
* Enables special abilities when full
* Power usage is explicitly decided by AI agents

---

### 4.3 Special Powers

The following special powers are supported:

* Speed Burst
* Super Smash
* Illusion
* Time Slow

Special powers influence rally outcomes and must be used strategically by AI agents.

---

## 5. AI Abstraction Model

Although the game is visually continuous, AI decision-making occurs at **discrete rally points**.

### 5.1 Decision Cycle

1. Shuttle reaches a player
2. Current game state is constructed
3. AI agent selects one action
4. Game simulation applies rules and computes outcome
5. Stamina, power, and score are updated
6. Turn switches to the opponent

This abstraction ensures that all AI agents operate on identical information and timing.

---

## 6. State Representation

Each AI agent reasons over a structured `GameState` representation containing:

* Player position
* Opponent position
* Shuttle height
* Shuttle court zone
* Player stamina
* Opponent stamina
* Player power level
* Opponent power level
* Active power (if any)
* Score difference
* Current player turn

The state representation is **identical for all agents**, ensuring fair and unbiased comparison.

---

## 7. AI Agents Implemented

### 7.1 Minimax Agent with Heuristic Evaluation

* Algorithm: Depth-limited Minimax
* Assumes an optimal opponent
* Uses a handcrafted heuristic function
* Emphasizes long-term planning and stamina conservation
* Computationally expensive but strategically stable

---

### 7.2 Monte Carlo Tree Search (MCTS) Agent

* Simulation-based search algorithm
* Uses probabilistic rollouts and UCT for node selection
* Does not assume optimal opponent behavior
* Adaptive and opportunistic play style
* Computational cost depends on simulation budget

---

### 7.3 Fuzzy Logic Agent

* Rule-based reasoning system
* Uses fuzzy membership functions and inference rules
* Fast, reactive, and human-like behavior
* No long-term planning capability
* Highly interpretable decision-making

---

## 8. System Architecture

SmartSmash follows a **layered architecture** with strict separation of responsibilities:

### 8.1 AI Decision Layer

* Implements Minimax, MCTS, and Fuzzy Logic agents
* Consumes abstract game states
* Produces action decisions only

### 8.2 Game Simulation Layer

* Applies game rules
* Updates stamina, power, and score
* Simulates rally outcomes
* Acts as the authoritative referee

### 8.3 Visualization Layer

* Renders the game state visually
* Displays AI decisions and metrics
* Does not influence AI logic

AI agents never directly interact with rendering components.

---

## 9. User Interface and Game Flow

The system supports a complete game UI/UX flow, including:

* Splash / Intro Screen
* Main Menu
* Game Mode Selection
* AI Agent Selection
* Match Setup Summary
* Gameplay Screen
* Pause Menu
* Settings Screen
* Result Screen

The gameplay screen includes:

* Court visualization
* Player and shuttle animations
* Stamina and power bars
* Scoreboard
* AI decision panel showing algorithm-specific reasoning metadata

---

## 10. Project Structure

```
SmartSmash/
├── README.md
├── requirements.txt
├── docs/
├── config/
├── src/
│   ├── core/
│   ├── environment/
│   ├── agents/
│   ├── evaluation/
│   ├── visualization/
│   └── utils/
├── logs/
├── tests/
└── scripts/
```

Each AI agent is modular and interchangeable, enabling controlled experiments and fair evaluation.

---

## 11. Evaluation and Analysis

Agents are evaluated and compared using the following metrics:

* Win rate
* Average decision time
* Stamina usage efficiency
* Power usage effectiveness
* Play style characteristics (defensive, aggressive, reactive)

There is no single “best” agent; comparative behavior analysis is the primary goal.

---

## 12. Technologies Used

* Python for AI logic and game simulation
* HTML, CSS, and vanilla JavaScript for visualization
* Canvas or CDN-based Three.js for rendering
* No machine learning or reinforcement learning libraries

The project is fully aligned with classical AI syllabus topics.

---

## 13. How to Run the Project

1. Clone the repository
2. Install Python dependencies
3. Run AI vs AI matches using provided scripts
4. Optionally launch the visualization layer in a browser

Detailed execution instructions are provided in the `scripts/` directory.

---

## 14. Academic Compliance

* Uses only classical Artificial Intelligence algorithms
* No deep learning or neural networks
* No reinforcement learning frameworks
* Fully compliant with the CSE 3209 syllabus
* Designed primarily for AI vs AI gameplay

---

## 15. License

This project is developed strictly for academic and educational purposes.

---

## Dependencies and Libraries

### Required Python Dependencies (`requirements.txt`)

```
numpy
pyyaml
matplotlib
```

#### Dependency Rationale

**numpy**

* Numerical computations
* Probability calculations for MCTS
* Heuristic evaluation support

**pyyaml**

* External configuration of game and agent parameters

**matplotlib**

* Visualization of evaluation metrics
* Comparative analysis plots for reports

---

## Optional Visualization Dependencies

These are not required for AI logic.

### Web Visualization

* HTML
* CSS
* JavaScript
* Canvas or Three.js loaded via CDN

### Godot Visualization (Optional)

* Godot Engine (external, not included in requirements.txt)

---

## Explicitly Not Used

* TensorFlow
* PyTorch
* Scikit-learn
* OpenAI Gym
* Any reinforcement learning framework

This ensures strict adherence to classical AI constraints.

---

## Final Remarks

SmartSmash is designed to emphasize **AI reasoning, explainability, and comparative evaluation** rather than graphical complexity. The project architecture prioritizes modularity, clarity, and academic rigor, making it suitable for both implementation and evaluation in an Artificial Intelligence course setting.

