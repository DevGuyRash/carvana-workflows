# Identifier Extraction Spec: Stock, VIN, PID

This document defines how to capture three identifiers from structured or unstructured text:
- `Stock`
- `VIN`
- `PID`

## Goal

Extract the best available value for each identifier using field-first lookup, then label-aware text parsing, then validation.

## Normalization Rules

Apply these before and after matching:
- Trim leading/trailing whitespace.
- Collapse internal whitespace to a single space when reading free text.
- Use case-insensitive matching for label detection.
- Preserve original case/value in output unless your downstream system requires uppercasing.

## Core Value Patterns

### VIN value pattern

```regex
([A-HJ-NPR-Z0-9]{11,17})\b
```

Meaning:
- 11 to 17 characters
- Allowed: letters/digits except `I`, `O`, `Q`
- Ends at a word boundary

### Stock value pattern

```regex
([A-Z0-9-]{3,})\b
```

Meaning:
- 3 or more characters
- Allowed: uppercase letters, digits, hyphen

### PID value pattern

```regex
(\d{3,})\b
```

Meaning:
- 3 or more digits

## Label Detection Pattern

Use label-aware extraction when values are embedded in multiline text.

```regex
\b<field>(?:\s*number(?:s)?)?\b
```

Replace `<field>` with:
- `stock`
- `vin`
- `pid`

Examples matched:
- `stock`
- `stock number`
- `vin numbers`
- `pid number`

## Value-After-Label Parsing

After finding a label occurrence, inspect the text after the label.

Primary parser (allows punctuation separators):

```regex
^\s*(?:[#:\(\)\[\]\-]\s*)*(<PATTERN>)
```

Fallback parser:

```regex
^\s*(<PATTERN>)
```

Replace `<PATTERN>` with the field's core value pattern:
- Stock -> `([A-Z0-9-]{3,})\b`
- VIN -> `([A-HJ-NPR-Z0-9]{11,17})\b`
- PID -> `(\d{3,})\b`

## Stock-vs-VIN Safety Check

A stock value can be incorrectly captured as a VIN. Validate stock candidates with:

```regex
^[A-HJ-NPR-Z0-9]{11,17}$
```

If stock matches this VIN-like full-string pattern, reject it as stock.

## Extraction Procedure

1. Read direct fields first (if present in structured data):
   - Stock field(s)
   - VIN field(s)
   - PID field(s)
2. For each missing identifier, run label-aware extraction on combined text.
3. For each label match:
   - Try primary parser on immediate trailing text.
   - If not found, scan subsequent non-empty line and apply fallback parser.
4. Apply stock-vs-VIN safety check.
5. Return final `Stock`, `VIN`, `PID` values.

## Missing-Value Policy

Keep this configurable by consumer system. Common choices:
- Leave missing values empty.
- Fill missing values with placeholders only when at least one identifier exists.

## Minimal Pseudocode

```text
stock = direct_stock
vin   = direct_vin
pid   = direct_pid

if stock missing: stock = find_labeled_value(text, "stock", STOCK_PATTERN)
if vin missing:   vin   = find_labeled_value(text, "vin", VIN_PATTERN)
if pid missing:   pid   = find_labeled_value(text, "pid", PID_PATTERN)

if stock is not empty and matches VIN_FULL_PATTERN:
  stock = empty

return { stock, vin, pid }
```
