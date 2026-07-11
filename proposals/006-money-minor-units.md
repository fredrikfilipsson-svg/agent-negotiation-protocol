# RFC-006: Money as integer minor units

Status: draft proposal for ANP/0.2. Not part of ANP/0.1; nothing here is
normative.

## Problem

Offer amounts are JSON numbers (`"unit_price": 1140.55`). Canonical JSON
serializes whatever number arrives deterministically, so hashing is
safe, but any implementation that does arithmetic on prices (totals,
deltas, threshold checks, the "sum of quantity × unit_price" rule for a
missing `total_annual`) is doing IEEE 754 floating point on money.
`0.1 + 0.2 !== 0.3` is enough for two conforming implementations to
disagree about whether a stated `total_annual` matches its line items,
and a disputed total in an agreed contract is the worst place to
discover it. Several JSON parsers also silently lose precision above
2^53, and the schema permits `unit_price` up to 10^9 with arbitrary
decimal places.

## Proposed change

0.2 offer schema replaces decimal number fields with integer minor
units, using the ISO 4217 exponent of the declared currency:

```json
{
  "currency": "USD",
  "line_items": [
    { "description": "CRM Enterprise seats", "quantity": 500,
      "unit": "seat/year", "unit_price_minor": 114055, "currency": "USD" }
  ],
  "total_annual_minor": 57027500
}
```

- `unit_price_minor` and `total_annual_minor` are JSON integers
  (safe-integer range MUST be enforced: absolute values <= 2^53 - 1).
- `quantity` stays a number (quantities are counts and measures, not
  money) but gains an explicit precision bound: at most 3 fractional
  digits.
- When `total_annual_minor` is absent, the total is the exact integer
  sum of `quantity × unit_price_minor`, computed with the quantity
  scaled to an integer per its declared precision, so every conforming
  implementation computes the identical value.
- Currencies without minor units (JPY, exponent 0) work unchanged: the
  minor unit is the unit.

## Compatibility

A field rename plus type change: clean 0.2 material, and mechanical to
migrate (`unit_price_minor = round(unit_price * 10^exponent)`). Keeping
the old and new fields side by side in one version invites the exact
disagreements this RFC removes, so the change is a hard cut at 0.2.
