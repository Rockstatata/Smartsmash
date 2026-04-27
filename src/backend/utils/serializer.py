"""Lightweight serialization helpers for configuration files."""

from __future__ import annotations

from typing import Any, Dict, Optional

try:
	import yaml
except Exception:  # pragma: no cover
	yaml = None


def load_yaml(path: str, default: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
	"""Load a YAML file into a dictionary.

	Returns ``default`` (or an empty dict) if the file is missing, invalid, or
	PyYAML is unavailable.
	"""
	if yaml is None:
		return default or {}

	try:
		with open(path, "r", encoding="utf-8") as handle:
			data = yaml.safe_load(handle)
		if isinstance(data, dict):
			return data
	except Exception:
		return default or {}

	return default or {}


def load_config_section(
	path: str,
	section: str,
	default: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
	"""Load a named configuration section from a YAML file."""
	data = load_yaml(path, default={})
	if not isinstance(data, dict):
		return default or {}
	value = data.get(section)
	if isinstance(value, dict):
		return value
	return default or {}
