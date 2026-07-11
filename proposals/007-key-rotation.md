# RFC-007: Key rotation

Status: draft proposal for ANP/0.2. Not part of ANP/0.1; nothing here is
normative. Prototype: `ANP_DRAFT=1 npm run mock-host` serves the
rotation endpoint.

## Problem

Section 2 covers revocation ("revoked keys MUST be refused everywhere")
but not rotation. A vendor that needs to retire a key, scheduled
hygiene or suspected compromise, can only register the new key as a new
identity: a new agent id, a broken link to its history, and a fresh
human verification pass. That punishes exactly the operationally
careful behavior the protocol should encourage, so in practice keys
will live too long.

## Proposed change

A new signed endpoint:

```
POST /api/agent/v1/keys
{
  "new_public_key": "<base64url raw Ed25519>",
  "proof": "<signature by the NEW key over 'ANP/0.2\\nregister\\n<new_public_key>'>",
  "authorization": "<signature by the OLD key over 'ANP/0.2\\nrotate\\n<old_fingerprint>\\n<new_fingerprint>'>"
}
```

- The request itself is signed per section 3 with the old key, proving
  live control; `proof` proves possession of the new key;
  `authorization` binds old to new explicitly.
- On success the agent id is unchanged. The old key enters state
  `rotated` with a `valid_to` timestamp; the new key becomes current.
  A rotated key can no longer sign requests or events but remains valid
  for verifying events whose `at` precedes `valid_to`, so historical
  logs keep verifying. This is the same validity-window rule RFC-003
  publishes for platform keys.
- Rotation under `bind_with_human_approval`-grade caution: hosts MAY
  gate rotation behind the same human verification used at registration
  when the old key is suspected compromised rather than merely retired
  (a compromised old key can otherwise authorize its own replacement).
  The endpoint therefore also accepts host policy refusals with the
  uniform error shape.

## Verification impact

Log `keys` blocks (and RFC-003 well-known documents) list keys with
validity windows. Verifiers select the key whose window covers the
event's `at`. A signature by a key outside its window fails.

## Compatibility

New endpoint and new signed strings: 0.2 material. The compromised-key
race (attacker rotates before the victim revokes) is inherent to any
key-authorized rotation and is why the host policy escape hatch above
exists; the log's hash chain means even a successful attacker cannot
rewrite pre-compromise history.
