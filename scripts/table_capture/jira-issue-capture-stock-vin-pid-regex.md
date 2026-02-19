# Identifier Extraction Spec: Stock, VIN, PID

This document defines the canonical parsing behavior for Stock/VIN/PID extraction used by Jira table capture and TR upload formulas.

## Goal

Extract the best available values using this precedence:
1. Direct structured fields/columns.
2. Label-aware free-text parsing (`stock`, `vin`, `pid`).
3. Descriptor parsing (`stock[-modifier]-vin[-pid][-suffix...]`).

## Normalization Rules

Apply these before and after matching:
- Trim leading/trailing whitespace.
- Collapse internal whitespace to a single space when reading free text.
- Normalize hyphen separators by replacing `\s*-\s*` with `-`.
- Use case-insensitive matching for label detection.
- Preserve source casing unless downstream consumer requires uppercase.

## Core Value Patterns

### VIN value pattern

```regex
([A-HJ-NPR-Z0-9]{11,17})\b
```

Meaning:
- 11 to 17 characters.
- Allowed letters/digits except `I`, `O`, `Q`.

### PID value pattern

```regex
(\d{3,})\b
```

Meaning:
- 3+ digits.
- Numeric-only for unlabeled descriptor parsing.

### Stock value pattern

```regex
((?:[A-Z0-9&]{2,8}-)?\d{7,12}(?:-(?:[A-Z]{2,8}|\d{1,4}))?)\b
```

Meaning:
- Base stock is 7-12 digits.
- Optional short prefix token (2-8 chars) allows letters/digits and `&`.
- Optional stock modifier segment is `2-8` letters or `1-4` digits.

### Base stock-only pattern (project number)

```regex
((?:[A-Z0-9&]{2,8}-)?\d{7,12})\b
```

Meaning:
- Captures base stock component before optional modifier/VIN/PID suffixes.

## Descriptor Parsing Pattern

Use descriptor parsing as a fallback for unstructured strings such as issue-key text:

```regex
(?:^|[^A-Z0-9&])((?:[A-Z0-9&]{2,8}-)?\d{7,12})(?:-([A-Z]{2,8}|\d{1,4}))?-([A-HJ-NPR-Z0-9]{11,17})(?:-(\d{3,}))?(?:-[A-Z0-9&]{2,30})*(?:$|[^A-Z0-9&])
```

Groups:
- Group 1: stock base (with optional prefix).
- Group 2: optional stock modifier.
- Group 3: VIN.
- Group 4: optional numeric PID.

Suffix behavior:
- Any additional `-TOKEN` segments after VIN/PID are ignored for Stock/VIN/PID extraction.
- This supports status-like tails such as `-CORRECTED-TITLE` and `-DUPLICATE-TITLE`.

## Label Detection Pattern

```regex
\b<field>(?:\s*number(?:s)?)?\b
```

Replace `<field>` with:
- `stock`
- `vin`
- `pid`

## Value-After-Label Parsing

After finding a label occurrence, inspect trailing text.

Primary parser:

```regex
^\s*(?:[#:\(\)\[\]\-]\s*)*(<PATTERN>)
```

Fallback parser:

```regex
^\s*(<PATTERN>)
```

Pattern mapping:
- Stock: `((?:[A-Z0-9&]{2,8}-)?\d{7,12}(?:-(?:[A-Z]{2,8}|\d{1,4}))?)\b`
- VIN: `([A-HJ-NPR-Z0-9]{11,17})\b`
- PID: `(\d{3,})\b`

## Stock-vs-VIN Safety Check

Reject stock candidates that are VIN-shaped:

```regex
^[A-HJ-NPR-Z0-9]{11,17}$
```

## Extraction Procedure

1. Read direct Stock/VIN/PID fields first.
2. For missing values, run label-aware extraction.
3. For still-missing values, run descriptor parsing:
   - Fill Stock from Group 1 (+ Group 2 when present).
   - Fill VIN from Group 3.
   - Fill PID only when Group 4 exists.
4. Apply stock-vs-VIN safety check.
5. Apply consumer-specific missing-value policy.

## Downstream Notes

- Jira capture output can apply placeholders when any identifier exists (`STOCK`, `VIN`, `PID`).
- Invoice stock value uses numeric base stock, appending modifier only when an explicit stock modifier segment exists.
- Date-mode invoice fallback behavior is independent of parsing grammar.

## Example Inputs

- `H&D-2123456789-1HGCM82633A004352-CORRECTED-TITLE`
  - Stock: `H&D-2123456789` (numeric base `2123456789`)
  - VIN: `1HGCM82633A004352`
  - PID: empty
- `R1-2345678901-ADJ-5YJ3E1EA7KF317000-98765`
  - Stock: `R1-2345678901-ADJ`
  - VIN: `5YJ3E1EA7KF317000`
  - PID: `98765`
- `Stock Number: 3456789012`
  - Stock from label path.

## Implementation Note (Excel Formula Fallback)

In Excel formulas, `REGEXEXTRACT` behavior can vary by environment: some return the first capture group, while others may return the full descriptor match. To keep PID extraction stable without changing the canonical grammar, formula implementations should:
- Prefer direct numeric capture when the descriptor result is already `^\d{3,}$`.
- Otherwise, derive PID from the segment immediately after `-VIN-` and take the leading numeric token.
- Continue fail-closed behavior (empty output) when no valid PID is found.

