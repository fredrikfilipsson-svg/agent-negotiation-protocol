"""Canonical JSON per ANP/0.1 section 4.

Object keys sorted lexicographically at every depth, no insignificant
whitespace, UTF-8. Both sides of a session must produce identical bytes
for identical payloads, and the reference implementation is ECMAScript,
so number formatting follows ECMA-262 Number::toString exactly (the
shortest round-trip decimal, switching to exponent form only outside
[1e-6, 1e21)). Key order uses UTF-16 code unit comparison, matching
JavaScript string ordering, not Python's code point ordering.
"""

from __future__ import annotations

import json
import math
import re

_REPR = re.compile(r"(\d+)(?:\.(\d+))?(?:e([+-]?\d+))?")


def _ecma_number_to_string(x: float) -> str:
    """Format a float exactly as ECMAScript Number::toString would."""
    if not math.isfinite(x):
        raise TypeError("canonical JSON cannot represent a non finite number")
    if x == 0:
        return "0"  # covers -0.0, which JSON.stringify emits as 0
    sign = "-" if x < 0 else ""
    r = repr(abs(x))  # CPython repr is the shortest round-trip decimal
    m = _REPR.fullmatch(r)
    if m is None:  # pragma: no cover - repr of a finite float always matches
        raise TypeError(f"unexpected float repr: {r}")
    int_part, frac_part, exp = m.group(1), m.group(2) or "", m.group(3)

    # Express the value as 0.s * 10^n with s free of edge zeros.
    if exp is not None:
        n = int(exp) + len(int_part)
    elif int_part != "0":
        n = len(int_part)
    else:
        n = -(len(frac_part) - len(frac_part.lstrip("0")))
    s = (int_part + frac_part).strip("0")
    k = len(s)

    if k <= n <= 21:
        out = s + "0" * (n - k)
    elif 0 < n <= 21:
        out = s[:n] + "." + s[n:]
    elif -6 < n <= 0:
        out = "0." + "0" * (-n) + s
    else:
        mantissa = s[0] + ("." + s[1:] if k > 1 else "")
        e = n - 1
        out = f"{mantissa}e{'+' if e >= 0 else '-'}{abs(e)}"
    return sign + out


def _sort_key(key: str) -> bytes:
    # UTF-16 big-endian byte order equals UTF-16 code unit order, which is
    # how JavaScript compares strings. surrogatepass tolerates lone
    # surrogates that arrived through decoded JSON.
    return key.encode("utf-16-be", "surrogatepass")


def canonical_json(value: object) -> str:
    """Serialize a JSON-compatible value to its canonical JSON string.

    Raises TypeError for values with no canonical form (non finite
    numbers, unsupported types). Python has no ``undefined``; omit a key
    entirely to drop it.
    """
    if value is None:
        return "null"
    if value is True:
        return "true"
    if value is False:
        return "false"
    if isinstance(value, str):
        return json.dumps(value, ensure_ascii=False)
    if isinstance(value, int):  # bool is handled above
        return str(value)
    if isinstance(value, float):
        return _ecma_number_to_string(value)
    if isinstance(value, (list, tuple)):
        return "[" + ",".join(canonical_json(item) for item in value) + "]"
    if isinstance(value, dict):
        pairs = sorted(value.items(), key=lambda kv: _sort_key(kv[0]))
        return (
            "{"
            + ",".join(
                f"{json.dumps(k, ensure_ascii=False)}:{canonical_json(v)}"
                for k, v in pairs
            )
            + "}"
        )
    raise TypeError(f"canonical JSON cannot represent a {type(value).__name__}")


def canonical_json_bytes(value: object) -> bytes:
    """Canonical JSON as UTF-8 bytes, the exact bytes that get hashed."""
    return canonical_json(value).encode("utf-8")
