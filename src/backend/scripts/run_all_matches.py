"""Run 1v1 sample matches across all SmartSmash AI agents.

Outputs:
- Structured JSON log in logs/
- Markdown summary report in docs/
"""

from __future__ import annotations

import json
import random
import sys
import time
import uuid
from pathlib import Path
from typing import Any, Dict, List, Tuple


BACKEND_DIR = Path(__file__).resolve().parents[1]
PROJECT_ROOT = BACKEND_DIR.parents[1]
CONFIG_PATH = BACKEND_DIR / "config" / "experiment_config.yaml"

if str(BACKEND_DIR) not in sys.path:
	sys.path.insert(0, str(BACKEND_DIR))
if str(PROJECT_ROOT) not in sys.path:
	sys.path.insert(0, str(PROJECT_ROOT))

from agents import AGENT_TYPES, make_agent
from agents.mcts_agent.simulation import transition
from agents.mcts_agent.utils import DEFAULT_TARGET_SCORE
from core.game_state import GameState
from utils.serializer import load_yaml


def _coerce_int(value: Any, default: int) -> int:
	try:
		return int(value)
	except Exception:
		return int(default)


def _coerce_bool(value: Any, default: bool) -> bool:
	if isinstance(value, bool):
		return value
	if value is None:
		return default
	return str(value).strip().lower() in {"1", "true", "yes", "on"}


def _coerce_list(value: Any, default: List[float]) -> List[float]:
	if isinstance(value, list) and value:
		out: List[float] = []
		for item in value:
			try:
				out.append(float(item))
			except Exception:
				continue
		if out:
			return out
	return list(default)


def load_experiment_config() -> Dict[str, Any]:
	raw = load_yaml(str(CONFIG_PATH), default={})
	if not isinstance(raw, dict):
		return {}
	exp = raw.get("experiment", {})
	return exp if isinstance(exp, dict) else {}


def build_internal_state(
	*,
	target_score: int,
	p1_power: float,
	p2_power: float,
	starting_turn: str,
) -> Dict[str, Any]:
	return {
		"p1_pos": {"x": 0.25, "y": 0.5},
		"p2_pos": {"x": 0.75, "y": 0.5},
		"shuttle_zone": 1,
		"shuttle_height": 1.5,
		"p1_stamina": 100.0,
		"p2_stamina": 100.0,
		"p1_power": float(p1_power),
		"p2_power": float(p2_power),
		"active_power": None,
		"score": {"p1": 0, "p2": 0},
		"current_turn": starting_turn,
		"target_score": int(target_score),
		"rally": 0,
		"is_terminal": False,
	}


def build_agent_state(internal: Dict[str, Any], actor: str) -> GameState:
	state = GameState()
	if actor == "p1":
		player_pos = internal.get("p1_pos")
		opponent_pos = internal.get("p2_pos")
		stamina = internal.get("p1_stamina")
		power = internal.get("p1_power")
		opponent_stamina = internal.get("p2_stamina")
		opponent_power = internal.get("p2_power")
	else:
		player_pos = internal.get("p2_pos")
		opponent_pos = internal.get("p1_pos")
		stamina = internal.get("p2_stamina")
		power = internal.get("p2_power")
		opponent_stamina = internal.get("p1_stamina")
		opponent_power = internal.get("p1_power")

	state.player_pos = dict(player_pos or {"x": 0.5, "y": 0.5})
	state.opponent_pos = dict(opponent_pos or {"x": 0.5, "y": 0.5})
	state.shuttle_zone = int(internal.get("shuttle_zone", 4) or 4)
	state.shuttle_height = float(internal.get("shuttle_height", 1.5) or 1.5)
	state.stamina = float(stamina or 0.0)
	state.power = float(power or 0.0)
	setattr(state, "opponent_stamina", float(opponent_stamina or 0.0))
	setattr(state, "opponent_power", float(opponent_power or 0.0))
	state.score = dict(internal.get("score") or {"p1": 0, "p2": 0})
	setattr(state, "current_turn", actor)
	setattr(state, "target_score", internal.get("target_score"))
	return state


def decide_action(agent: Any, state: GameState) -> Tuple[str, Dict[str, Any], float]:
	t0 = time.perf_counter()
	decide_fn = getattr(agent, "decide", None)
	if callable(decide_fn):
		result = decide_fn(state)
	else:
		result = agent.select_action(state)
	elapsed_ms = (time.perf_counter() - t0) * 1000.0
	if isinstance(result, tuple) and len(result) == 2:
		action, explanation = result
	else:
		action, explanation = result, {}
	return str(action), explanation if isinstance(explanation, dict) else {}, float(elapsed_ms)


def simulate_match(
	*,
	match_id: str,
	agent_a: str,
	agent_b: str,
	rng: random.Random,
	target_score: int,
	max_rallies: int,
	include_movement_actions: bool,
	initial_power_levels: List[float],
	randomize_roles: bool,
	randomize_starting_turn: bool,
) -> Dict[str, Any]:
	if randomize_roles and rng.random() < 0.5:
		p1_type, p2_type = agent_b, agent_a
	else:
		p1_type, p2_type = agent_a, agent_b

	starting_turn = rng.choice(["p1", "p2"]) if randomize_starting_turn else "p1"
	p1_power = rng.choice(initial_power_levels)
	p2_power = rng.choice(initial_power_levels)

	options = {"include_movement_actions": include_movement_actions}
	agents = {
		"p1": make_agent(p1_type, player_key="p1", options={**options, "seed": rng.randint(1, 10**9)}),
		"p2": make_agent(p2_type, player_key="p2", options={**options, "seed": rng.randint(1, 10**9)}),
	}

	internal = build_internal_state(
		target_score=target_score,
		p1_power=p1_power,
		p2_power=p2_power,
		starting_turn=starting_turn,
	)

	metrics = {
		"p1": {"decision_times": [], "specials": 0, "power_used": 0.0, "actions": []},
		"p2": {"decision_times": [], "specials": 0, "power_used": 0.0, "actions": []},
	}

	while not internal.get("is_terminal"):
		if internal.get("rally", 0) >= max_rallies:
			break

		actor = str(internal.get("current_turn", "p1"))
		agent = agents.get(actor)
		if agent is None:
			break

		state = build_agent_state(internal, actor)
		action, explanation, decision_time_ms = decide_action(agent, state)
		metrics[actor]["decision_times"].append(decision_time_ms)
		metrics[actor]["actions"].append(action)

		if action == "SPECIAL":
			metrics[actor]["specials"] += 1
			metrics[actor]["power_used"] += float(internal.get(f"{actor}_power", 0.0))

		internal, _ = transition(internal, action=action, rng=rng, config={})
		if explanation:
			internal["last_explanation"] = explanation

	score = internal.get("score") or {"p1": 0, "p2": 0}
	if score.get("p1", 0) == score.get("p2", 0):
		winner_side = "draw"
		winner_agent = "draw"
	else:
		winner_side = "p1" if score.get("p1", 0) > score.get("p2", 0) else "p2"
		winner_agent = p1_type if winner_side == "p1" else p2_type

	def _avg(values: List[float]) -> float:
		return round(sum(values) / max(1, len(values)), 3)

	record = {
		"id": match_id,
		"agents": {"p1": p1_type, "p2": p2_type},
		"starting_turn": starting_turn,
		"initial_power": {"p1": p1_power, "p2": p2_power},
		"score": score,
		"winner_side": winner_side,
		"winner": winner_agent,
		"rally_count": int(internal.get("rally", 0)),
		"final_stamina": {
			"p1": round(float(internal.get("p1_stamina", 0.0)), 3),
			"p2": round(float(internal.get("p2_stamina", 0.0)), 3),
		},
		"final_power": {
			"p1": round(float(internal.get("p1_power", 0.0)), 3),
			"p2": round(float(internal.get("p2_power", 0.0)), 3),
		},
		"decision_time_ms": {
			"p1_avg": _avg(metrics["p1"]["decision_times"]),
			"p2_avg": _avg(metrics["p2"]["decision_times"]),
		},
		"specials_used": {
			"p1": metrics["p1"]["specials"],
			"p2": metrics["p2"]["specials"],
		},
		"power_used": {
			"p1": round(metrics["p1"]["power_used"], 3),
			"p2": round(metrics["p2"]["power_used"], 3),
		},
		"actions": {
			"p1": metrics["p1"]["actions"],
			"p2": metrics["p2"]["actions"],
		},
		"timestamp": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
	}
	return record


def build_markdown_report(
	*,
	matches: List[Dict[str, Any]],
	summary: Dict[str, Any],
	config: Dict[str, Any],
	json_path: Path,
	generated_at: str,
) -> str:
	lines: List[str] = []
	lines.append("# SmartSmash 1v1 AI Sample Runs")
	lines.append("")
	lines.append(f"Generated: {generated_at}")
	lines.append(f"JSON log: {json_path.as_posix()}")
	lines.append("")
	lines.append("## Experiment Settings")
	lines.append("")
	lines.append(f"- Samples per pairing: {config['samples_per_pair']}")
	lines.append(f"- Target score: {config['target_score']}")
	lines.append(f"- Max rallies per match: {config['max_rallies']}")
	lines.append(f"- Initial power levels: {', '.join(str(x) for x in config['initial_power_levels'])}")
	lines.append(f"- Randomize roles: {str(config['randomize_roles']).lower()}")
	lines.append(f"- Randomize starting turn: {str(config['randomize_starting_turn']).lower()}")
	lines.append("")
	lines.append("## Summary")
	lines.append("")
	lines.append("| Pairing | Matches | Wins | Winrate | Avg rallies | Avg decision ms | Specials used |")
	lines.append("| --- | --- | --- | --- | --- | --- | --- |")

	for pair_key in summary["pair_order"]:
		row = summary["pairs"][pair_key]
		wins = row["wins"]
		winrate = row["winrate"]
		avg_rallies = row["avg_rallies"]
		avg_decision = row["avg_decision_ms"]
		specials = row["specials_used"]

		win_text = f"{row['agents'][0]}: {wins[row['agents'][0]]}, {row['agents'][1]}: {wins[row['agents'][1]]}"
		winrate_text = f"{row['agents'][0]}: {winrate[row['agents'][0]]}%, {row['agents'][1]}: {winrate[row['agents'][1]]}%"
		decision_text = f"{row['agents'][0]}: {avg_decision[row['agents'][0]]}, {row['agents'][1]}: {avg_decision[row['agents'][1]]}"
		specials_text = f"{row['agents'][0]}: {specials[row['agents'][0]]}, {row['agents'][1]}: {specials[row['agents'][1]]}"

		lines.append(
			f"| {pair_key} | {row['matches']} | {win_text} | {winrate_text} | {avg_rallies} | {decision_text} | {specials_text} |"
		)

	lines.append("")
	lines.append("## Notes")
	lines.append("")
	lines.append("- Special powers are represented by the SPECIAL action when power is available.")
	lines.append("- Stochastic rally outcomes use the shared referee model from agents.mcts_agent.simulation.transition.")
	lines.append("")

	for pair_key in summary["pair_order"]:
		row = summary["pairs"][pair_key]
		lines.append(f"## {pair_key}")
		lines.append("")
		lines.append(
			f"Matches: {row['matches']} | Wins: {row['agents'][0]} {row['wins'][row['agents'][0]]}, {row['agents'][1]} {row['wins'][row['agents'][1]]}"
		)
		lines.append("")
		lines.append("<details>")
		lines.append("<summary>Match results</summary>")
		lines.append("")
		lines.append(
			"| Match ID | P1 | P2 | Winner | Score | Rallies | P1 specials | P2 specials | P1 avg ms | P2 avg ms |"
		)
		lines.append("| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |")
		for match in row["match_rows"]:
			lines.append(match)
		lines.append("")
		lines.append("</details>")
		lines.append("")

	return "\n".join(lines)


def summarize_matches(matches: List[Dict[str, Any]]) -> Dict[str, Any]:
	summary: Dict[str, Any] = {"pairs": {}, "pair_order": []}

	for match in matches:
		agents = match.get("agents") or {}
		p1 = str(agents.get("p1"))
		p2 = str(agents.get("p2"))
		pair = " vs ".join(sorted([p1, p2]))

		if pair not in summary["pairs"]:
			summary["pairs"][pair] = {
				"agents": tuple(sorted([p1, p2])),
				"matches": 0,
				"wins": {p1: 0, p2: 0},
				"rallies": [],
				"decision_ms": {p1: [], p2: []},
				"specials": {p1: 0, p2: 0},
				"match_rows": [],
			}
			summary["pair_order"].append(pair)

		row = summary["pairs"][pair]
		row["matches"] += 1
		row["rallies"].append(match.get("rally_count", 0))

		winner = match.get("winner")
		if winner in row["wins"]:
			row["wins"][winner] += 1

		decision = match.get("decision_time_ms") or {}
		for side, agent in ("p1", p1), ("p2", p2):
			key = f"{side}_avg"
			if key in decision:
				row["decision_ms"][agent].append(float(decision.get(key) or 0.0))

		specials = match.get("specials_used") or {}
		row["specials"][p1] += int(specials.get("p1", 0))
		row["specials"][p2] += int(specials.get("p2", 0))

		score = match.get("score") or {"p1": 0, "p2": 0}
		row["match_rows"].append(
			"| {id} | {p1} | {p2} | {winner} | {score} | {rallies} | {p1s} | {p2s} | {p1m} | {p2m} |".format(
				id=match.get("id"),
				p1=p1,
				p2=p2,
				winner=match.get("winner"),
				score=f"{score.get('p1', 0)}-{score.get('p2', 0)}",
				rallies=match.get("rally_count", 0),
				p1s=specials.get("p1", 0),
				p2s=specials.get("p2", 0),
				p1m=decision.get("p1_avg", 0.0),
				p2m=decision.get("p2_avg", 0.0),
			)
		)

	for pair, row in summary["pairs"].items():
		agents = row["agents"]
		matches = max(1, row["matches"])
		row["avg_rallies"] = round(sum(row["rallies"]) / matches, 2)
		row["winrate"] = {
			agents[0]: round(row["wins"].get(agents[0], 0) * 100.0 / matches, 1),
			agents[1]: round(row["wins"].get(agents[1], 0) * 100.0 / matches, 1),
		}
		row["avg_decision_ms"] = {
			agents[0]: round(sum(row["decision_ms"][agents[0]]) / max(1, len(row["decision_ms"][agents[0]])), 3),
			agents[1]: round(sum(row["decision_ms"][agents[1]]) / max(1, len(row["decision_ms"][agents[1]])), 3),
		}
		row["specials_used"] = {
			agents[0]: row["specials"].get(agents[0], 0),
			agents[1]: row["specials"].get(agents[1], 0),
		}

	return summary


def main() -> int:
	config = load_experiment_config()
	samples_per_pair = _coerce_int(config.get("samples_per_pair"), 100)
	seed = _coerce_int(config.get("seed"), 20260428)
	target_score = _coerce_int(config.get("target_score"), DEFAULT_TARGET_SCORE)
	max_rallies = _coerce_int(config.get("max_rallies"), 50)
	randomize_roles = _coerce_bool(config.get("randomize_roles"), True)
	randomize_starting_turn = _coerce_bool(config.get("randomize_starting_turn"), True)
	include_movement_actions = _coerce_bool(config.get("include_movement_actions"), False)
	initial_power_levels = _coerce_list(config.get("initial_power_levels"), [0, 25, 50, 75, 100])

	output = config.get("output", {}) if isinstance(config.get("output"), dict) else {}
	docs_dir = PROJECT_ROOT / str(output.get("docs_dir", "docs"))
	logs_dir = PROJECT_ROOT / str(output.get("logs_dir", "logs"))
	report_basename = str(output.get("report_basename", "ai_samples")).strip() or "ai_samples"

	docs_dir.mkdir(parents=True, exist_ok=True)
	logs_dir.mkdir(parents=True, exist_ok=True)

	rng = random.Random(seed)
	pairings: List[Tuple[str, str]] = []
	agent_list = list(AGENT_TYPES)
	for i, a in enumerate(agent_list):
		for b in agent_list[i + 1 :]:
			pairings.append((a, b))

	matches: List[Dict[str, Any]] = []
	for agent_a, agent_b in pairings:
		for _ in range(samples_per_pair):
			match_id = uuid.uuid4().hex[:8]
			record = simulate_match(
				match_id=match_id,
				agent_a=agent_a,
				agent_b=agent_b,
				rng=rng,
				target_score=target_score,
				max_rallies=max_rallies,
				include_movement_actions=include_movement_actions,
				initial_power_levels=initial_power_levels,
				randomize_roles=randomize_roles,
				randomize_starting_turn=randomize_starting_turn,
			)
			matches.append(record)

	generated_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
	timestamp_tag = time.strftime("%Y%m%d_%H%M%S", time.gmtime())
	json_path = logs_dir / f"{report_basename}_{timestamp_tag}.json"
	md_path = docs_dir / f"{report_basename}_{timestamp_tag}.md"

	payload = {
		"generated_at": generated_at,
		"config": {
			"samples_per_pair": samples_per_pair,
			"seed": seed,
			"target_score": target_score,
			"max_rallies": max_rallies,
			"randomize_roles": randomize_roles,
			"randomize_starting_turn": randomize_starting_turn,
			"initial_power_levels": initial_power_levels,
			"include_movement_actions": include_movement_actions,
		},
		"matches": matches,
	}

	with open(json_path, "w", encoding="utf-8") as handle:
		json.dump(payload, handle, indent=2)

	summary = summarize_matches(matches)
	report_config = payload["config"]
	report_config["samples_per_pair"] = samples_per_pair
	report = build_markdown_report(
		matches=matches,
		summary=summary,
		config=report_config,
		json_path=json_path,
		generated_at=generated_at,
	)

	with open(md_path, "w", encoding="utf-8") as handle:
		handle.write(report)

	print(f"Wrote JSON log to {json_path}")
	print(f"Wrote Markdown report to {md_path}")
	return 0


if __name__ == "__main__":
	raise SystemExit(main())
