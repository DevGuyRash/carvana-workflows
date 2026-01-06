// ============================================================================
//                         📚 UNDERSTANDING THE BASICS
// ============================================================================
//
// WHAT PROBLEM ARE WE SOLVING?
// ----------------------------
// You have a spreadsheet. You want to find rows where certain values repeat.
// 
// Example: A list of orders where you want to find duplicate customer + product
// combinations. Or employee records where Name + Department appears twice.
//
//
// THE KEY TOOL: COUNTIFS
// ----------------------
// COUNTIFS counts how many rows match ALL your conditions.
//
//    COUNTIFS(where_to_look, what_to_find)
//
// With multiple conditions:
//
//    COUNTIFS(column1, value1, column2, value2, column3, value3, ...)
//
// If the count > 1, you have duplicates!
//
//
// THE THREE QUESTIONS YOU CAN ASK:
// --------------------------------
//    1. "Does this combination appear MORE THAN ONCE anywhere?"
//       → Marks ALL duplicate rows (including the first one)
//
//    2. "Have I seen this combination BEFORE in my list?"
//       → Marks only the 2nd, 3rd, 4th... occurrences (skips the first)
//
//    3. "Is this the FIRST occurrence of something that repeats later?"
//       → Marks only the first one (useful for "keep first, delete rest")
//
// ============================================================================



// ============================================================================
//                      🎯 SIGNATURE FORMULAS (COPY THESE)
// ============================================================================
//
// INSTRUCTIONS:
// 1. Pick the formula that matches what you want to find
// 2. Replace the column letters (A, C, E...) with YOUR columns
// 3. Replace "2" with your first data row (usually 2 if row 1 is headers)
// 4. Paste into a new column and drag down
//
// ============================================================================


// ────────────────────────────────────────────────────────────────────────────
// FORMULA 1: Mark ALL duplicates (including the first occurrence)
// ────────────────────────────────────────────────────────────────────────────
//
// USE WHEN: You want to highlight or review ALL rows that are part of a 
//           duplicate group. Every copy gets marked TRUE.
//
// RETURNS:  TRUE  = this combination exists more than once
//           FALSE = this combination is unique (or has blanks)
//
// ─── Two columns (A and C): ───

=IF(OR($A2="", $C2=""), FALSE, COUNTIFS($A:$A, $A2, $C:$C, $C2) > 1)

//
// HOW IT WORKS:
//   Step 1: IF(OR($A2="", $C2=""), FALSE, ...)
//           → If either cell is blank, return FALSE immediately
//           → Why? Blank + anything shouldn't count as a valid "pair"
//
//   Step 2: COUNTIFS($A:$A, $A2, $C:$C, $C2)
//           → Count rows where column A = this row's A AND column C = this row's C
//           → $A:$A means "search the ENTIRE column" (all rows, top to bottom)
//
//   Step 3: > 1
//           → If count is 2 or more, this combination is duplicated → TRUE
//           → If count is exactly 1, this is the only one           → FALSE
//


// ────────────────────────────────────────────────────────────────────────────
// FORMULA 2: Mark only 2nd, 3rd, 4th... occurrences (skip the first)
// ────────────────────────────────────────────────────────────────────────────
//
// USE WHEN: You want to keep the first occurrence but flag all the repeats.
//           Perfect for "delete duplicates but keep one copy."
//
// RETURNS:  TRUE  = this is a repeat (not the first time I've seen this)
//           FALSE = this is the first occurrence (or has blanks)
//
// ─── Two columns (A and C): ───

=IF(OR($A2="", $C2=""), FALSE, COUNTIFS($A$2:$A2, $A2, $C$2:$C2, $C2) > 1)

//
// HOW IT WORKS:
//   The magic is in the range: $A$2:$A2 (not $A:$A)
//   
//   This is a "growing" or "running" range:
//   - In row 2: checks $A$2:$A2 (just row 2)         → count = 1 → FALSE
//   - In row 3: checks $A$2:$A3 (rows 2-3)           → count = 1 or 2
//   - In row 4: checks $A$2:$A4 (rows 2-4)           → count = 1, 2, or 3
//   - ...and so on
//
//   It only counts rows FROM THE START UP TO the current row.
//   So the FIRST occurrence always has count = 1 → FALSE
//   The SECOND occurrence has count = 2          → TRUE
//
//   Think of it as asking: "Have I seen this before?"
//


// ────────────────────────────────────────────────────────────────────────────
// FORMULA 3: Mark ONLY the first occurrence (when duplicates exist)
// ────────────────────────────────────────────────────────────────────────────
//
// USE WHEN: You want to identify the "original" row in each duplicate group.
//           Useful for reviewing which one to keep.
//
// RETURNS:  TRUE  = this is the first, and there ARE duplicates of it later
//           FALSE = this is unique, or it's a repeat, or has blanks
//
// ─── Two columns (A and C): ───

=IF(OR($A2="", $C2=""), FALSE,
  AND(
    COUNTIFS($A:$A, $A2, $C:$C, $C2) > 1,
    COUNTIFS($A$2:$A2, $A2, $C$2:$C2, $C2) = 1
  )
)

//
// HOW IT WORKS:
//   Two conditions must BOTH be true:
//
//   Condition 1: COUNTIFS($A:$A, $A2, $C:$C, $C2) > 1
//                → "This combination exists more than once in the dataset"
//                → (Uses full column = looks everywhere)
//
//   Condition 2: COUNTIFS($A$2:$A2, $A2, $C$2:$C2, $C2) = 1
//                → "This is the FIRST time I'm seeing this"
//                → (Uses running range = only looks at rows so far)
//
//   Together: "There ARE duplicates" AND "This is the first one"
//


// ────────────────────────────────────────────────────────────────────────────
// FORMULA 4: Count how many times this combination appears
// ────────────────────────────────────────────────────────────────────────────
//
// USE WHEN: You want to see the actual count, not just TRUE/FALSE.
//           Helpful for analysis: "This combo appears 5 times!"
//
// RETURNS:  A number (1, 2, 3...) or blank if cells are empty
//
// ─── Two columns (A and C): ───

=IF(OR($A2="", $C2=""), "", COUNTIFS($A:$A, $A2, $C:$C, $C2))

//
// This is the simplest form — just the raw COUNTIFS result.
// Returns "" (blank) for empty rows to keep your data clean.
//



// ============================================================================
//                     🔧 HOW TO CUSTOMIZE FOR YOUR DATA
// ============================================================================
//
// CHANGING COLUMNS:
// -----------------
// Just replace the letters! Example for columns B and D instead of A and C:
//
//   =IF(OR($B2="", $D2=""), FALSE, COUNTIFS($B:$B, $B2, $D:$D, $D2) > 1)
//          ↑↑↑     ↑↑↑                      ↑↑↑↑↑  ↑↑↑  ↑↑↑↑↑  ↑↑↑
//
//
// ADDING MORE COLUMNS:
// --------------------
// For each additional column, add TWO things:
//
//   1. Add to the blank check:    OR($A2="", $C2="", $E2="")
//                                                    ↑↑↑↑↑↑ new
//
//   2. Add to COUNTIFS:           COUNTIFS(..., $E:$E, $E2)
//                                               ↑↑↑↑↑  ↑↑↑ new pair
//
//
// ============================================================================



// ============================================================================
//                     📋 READY-TO-USE: 3-COLUMN FORMULAS
// ============================================================================


// ─── Mark ALL duplicates (three columns: A, C, E) ───

=IF(OR($A2="", $C2="", $E2=""), FALSE,
  COUNTIFS($A:$A, $A2, $C:$C, $C2, $E:$E, $E2) > 1
)


// ─── Mark 2nd+ occurrences (three columns: A, C, E) ───

=IF(OR($A2="", $C2="", $E2=""), FALSE,
  COUNTIFS($A$2:$A2, $A2, $C$2:$C2, $C2, $E$2:$E2, $E2) > 1
)


// ─── Mark ONLY first occurrence (three columns: A, C, E) ───

=IF(OR($A2="", $C2="", $E2=""), FALSE,
  AND(
    COUNTIFS($A:$A, $A2, $C:$C, $C2, $E:$E, $E2) > 1,
    COUNTIFS($A$2:$A2, $A2, $C$2:$C2, $C2, $E$2:$E2, $E2) = 1
  )
)


// ─── Count occurrences (three columns: A, C, E) ───

=IF(OR($A2="", $C2="", $E2=""), "",
  COUNTIFS($A:$A, $A2, $C:$C, $C2, $E:$E, $E2)
)



// ============================================================================
//                     📋 READY-TO-USE: 4-COLUMN FORMULAS
// ============================================================================


// ─── Mark ALL duplicates (four columns: A, C, E, H) ───

=IF(OR($A2="", $C2="", $E2="", $H2=""), FALSE,
  COUNTIFS($A:$A, $A2, $C:$C, $C2, $E:$E, $E2, $H:$H, $H2) > 1
)


// ─── Mark 2nd+ occurrences (four columns: A, C, E, H) ───

=IF(OR($A2="", $C2="", $E2="", $H2=""), FALSE,
  COUNTIFS($A$2:$A2, $A2, $C$2:$C2, $C2, $E$2:$E2, $E2, $H$2:$H2, $H2) > 1
)


// ─── Mark ONLY first occurrence (four columns: A, C, E, H) ───

=IF(OR($A2="", $C2="", $E2="", $H2=""), FALSE,
  AND(
    COUNTIFS($A:$A, $A2, $C:$C, $C2, $E:$E, $E2, $H:$H, $H2) > 1,
    COUNTIFS($A$2:$A2, $A2, $C$2:$C2, $C2, $E$2:$E2, $E2, $H$2:$H2, $H2) = 1
  )
)



// ============================================================================
//                  ⚡ PERFORMANCE VERSION (LARGE DATASETS)
// ============================================================================
//
// WHEN TO USE:
// If your spreadsheet is slow (thousands of rows), use bounded ranges
// instead of whole-column references.
//
// CHANGE: $A:$A  →  $A$2:$A$5000
//         ↑         ↑
//         whole column
//                   bounded to row 5000
//
// IMPORTANT: Set the end row (5000) to be >= your last data row.
//            Make ALL ranges the same size.
//
// ─── Example: Mark ALL duplicates, bounded to rows 2-5000 ───

=IF(OR($A2="", $C2=""), FALSE,
  COUNTIFS($A$2:$A$5000, $A2, $C$2:$C$5000, $C2) > 1
)



// ============================================================================
//                  🧹 HANDLING TRICKY "BLANK" CELLS
// ============================================================================
//
// PROBLEM: Some cells LOOK empty but contain spaces or invisible characters.
//          The standard $A2="" check won't catch these.
//
// SOLUTION: Use LEN(TRIM(...)) = 0 instead of =""
//           TRIM removes spaces, LEN counts characters.
//           If LEN = 0 after trimming, it's effectively blank.
//
// ─── Example: Mark ALL duplicates with robust blank handling ───

=IF(OR(LEN(TRIM($A2))=0, LEN(TRIM($C2))=0), FALSE,
  COUNTIFS($A:$A, $A2, $C:$C, $C2) > 1
)



// ============================================================================
//                         📝 QUICK REFERENCE CHEAT SHEET
// ============================================================================
//
// ┌─────────────────────────┬─────────────────────────────────────────────────┐
// │ I want to...            │ Use this range style                            │
// ├─────────────────────────┼─────────────────────────────────────────────────┤
// │ Find ALL duplicates     │ $A:$A (whole column)                            │
// │                         │ Looks everywhere: above AND below current row   │
// ├─────────────────────────┼─────────────────────────────────────────────────┤
// │ Skip the first, mark    │ $A$2:$A2 (running/growing range)                │
// │ 2nd+ occurrences        │ Only looks at rows from start UP TO current     │
// ├─────────────────────────┼─────────────────────────────────────────────────┤
// │ Speed up large files    │ $A$2:$A$5000 (bounded range)                    │
// │                         │ Same as whole column, but limited scope         │
// └─────────────────────────┴─────────────────────────────────────────────────┘
//
//
// THE DOLLAR SIGN ($) RULES:
// --------------------------
//   $A2      → Column is locked (A stays A when you drag sideways)
//            → Row is flexible (2 becomes 3, 4, 5... when you drag down)
//
//   $A:$A    → Entire column, locked
//
//   $A$2:$A2 → Start is locked at row 2, end grows as you drag down
//              This is how the "running count" trick works!
//
//
// ============================================================================
