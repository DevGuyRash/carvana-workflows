// ============================================================================
//                    📚 EXCEL/SHEETS DUPLICATE DETECTION LIBRARY
// ============================================================================
//
//                            TABLE OF CONTENTS
//                            -----------------
//
//   PART 1: THE BASICS                              (Start here if new!)
//     - What problem are we solving?
//     - How COUNTIFS works
//     - The three types of duplicate questions
//
//   PART 2: CORE FORMULAS (1-4)                     (Most common use cases)
//     - Formula 1: Mark ALL duplicates
//     - Formula 2: Mark 2nd+ occurrences only
//     - Formula 3: Mark ONLY the first occurrence
//     - Formula 4: Count occurrences
//
//   PART 3: CUSTOMIZATION GUIDE                     (Change columns, add more)
//
//   PART 4: READY-TO-USE TEMPLATES                  (3-column and 4-column)
//
//   PART 5: PERFORMANCE & EDGE CASES                (Large files, tricky blanks)
//
//   PART 6: ADVANCED — "FUZZY" MATCHING (K-of-N)    (When not ALL columns need to match)
//     - Formula 5-8: Minimum-match duplicates
//
//   PART 7: QUICK REFERENCE CHEAT SHEET
//
// ============================================================================



// ============================================================================
//                         PART 1: THE BASICS
// ============================================================================
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  WHAT PROBLEM ARE WE SOLVING?                                            │
// └──────────────────────────────────────────────────────────────────────────┘
//
// You have a spreadsheet. You want to find rows where certain values repeat.
// 
// REAL-WORLD EXAMPLES:
//   • Orders list    → Find duplicate Customer + Product combinations
//   • Employee data  → Find duplicate Name + Department entries
//   • Inventory      → Find duplicate SKU + Warehouse pairs
//   • Contacts       → Find duplicate Email + Phone combinations
//
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  THE KEY TOOL: COUNTIFS                                                  │
// └──────────────────────────────────────────────────────────────────────────┘
//
// COUNTIFS counts how many rows match ALL your conditions.
//
// SIMPLE FORM:
//
//    COUNTIFS(where_to_look, what_to_find)
//
// MULTIPLE CONDITIONS (this is what we use):
//
//    COUNTIFS(column1, value1, column2, value2, column3, value3, ...)
//            └─────────────┘  └─────────────┘  └─────────────┘
//               pair #1          pair #2          pair #3
//
// THE LOGIC:
//   • If the count = 1  →  This combination appears exactly once (unique)
//   • If the count > 1  →  This combination appears multiple times (duplicate!)
//
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  THE THREE QUESTIONS YOU CAN ASK                                         │
// └──────────────────────────────────────────────────────────────────────────┘
//
//   QUESTION 1: "Does this combination appear MORE THAN ONCE anywhere?"
//               → Answer: Marks ALL duplicate rows (including the first one)
//               → Use Formula 1
//
//   QUESTION 2: "Have I seen this combination BEFORE in my list?"
//               → Answer: Marks only the 2nd, 3rd, 4th... (skips the first)
//               → Use Formula 2
//
//   QUESTION 3: "Is this the FIRST occurrence of something that repeats?"
//               → Answer: Marks only the first one in each duplicate group
//               → Use Formula 3
//
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  WHICH FORMULA SHOULD I USE? (Decision Guide)                            │
// └──────────────────────────────────────────────────────────────────────────┘
//
//   "I want to highlight all rows that are duplicated"
//     → Use Formula 1 (marks ALL copies, including the first)
//
//   "I want to delete duplicates but keep one copy"
//     → Use Formula 2 (marks only the EXTRA copies, delete those)
//
//   "I want to review just the 'original' row in each duplicate group"
//     → Use Formula 3 (marks only the FIRST occurrence)
//
//   "I want to see a count (like: this appears 5 times)"
//     → Use Formula 4 (returns a number, not TRUE/FALSE)
//
//   "Some columns might not match — I want 'close enough' matches"
//     → Use Formulas 5-8 in Part 6 (advanced K-of-N matching)
//
// ============================================================================



// ============================================================================
//                   PART 2: CORE FORMULAS (Copy & Paste These)
// ============================================================================
//
// HOW TO USE THESE FORMULAS:
//   1. Copy the formula you need
//   2. Paste it into a new column (e.g., column Z) in row 2
//   3. Press Enter
//   4. Drag the cell down to fill all your data rows
//   5. The formula will show TRUE or FALSE for each row
//
// ============================================================================


// ────────────────────────────────────────────────────────────────────────────
// FORMULA 1: Mark ALL duplicates (including the first occurrence)
// ────────────────────────────────────────────────────────────────────────────
//
// WHAT IT DOES:
//   Returns TRUE for EVERY row that is part of a duplicate group.
//   If a combination appears 3 times, all 3 rows get TRUE.
//
// WHEN TO USE:
//   You want to highlight or review ALL rows that share the same values.
//
// EXAMPLE:
//   Row 2: Apple, Red     → TRUE  (appears in row 2 AND row 5)
//   Row 3: Banana, Yellow → FALSE (unique)
//   Row 4: Orange, Orange → FALSE (unique)
//   Row 5: Apple, Red     → TRUE  (appears in row 2 AND row 5)
//
// RETURNS:
//   TRUE  = this combination exists more than once in the dataset
//   FALSE = this combination is unique (or has blank cells)
//
// ─── THE FORMULA (checks columns A and C): ───

=IF(OR($A2="", $C2=""), FALSE, COUNTIFS($A:$A, $A2, $C:$C, $C2) > 1)

//
// STEP-BY-STEP BREAKDOWN:
//
//   Part 1: IF(OR($A2="", $C2=""), FALSE, ...)
//           ┌─────────────────────────────────────────────────────────────┐
//           │ "First, check if either cell is blank"                      │
//           │  • If A2 is empty → return FALSE (skip this row)            │
//           │  • If C2 is empty → return FALSE (skip this row)            │
//           │  • Why? Blank values shouldn't be treated as a valid pair   │
//           └─────────────────────────────────────────────────────────────┘
//
//   Part 2: COUNTIFS($A:$A, $A2, $C:$C, $C2)
//           ┌─────────────────────────────────────────────────────────────┐
//           │ "Count how many rows match both conditions"                 │
//           │  • $A:$A, $A2 = "where column A equals this row's A value"  │
//           │  • $C:$C, $C2 = "AND column C equals this row's C value"    │
//           │  • $A:$A means "search the ENTIRE column A" (all rows)      │
//           └─────────────────────────────────────────────────────────────┘
//
//   Part 3: > 1
//           ┌─────────────────────────────────────────────────────────────┐
//           │ "Is the count greater than 1?"                              │
//           │  • Count = 1 → only this row has this combo → FALSE         │
//           │  • Count = 2+ → other rows have same combo → TRUE           │
//           └─────────────────────────────────────────────────────────────┘
//


// ────────────────────────────────────────────────────────────────────────────
// FORMULA 2: Mark only 2nd, 3rd, 4th... occurrences (skip the first)
// ────────────────────────────────────────────────────────────────────────────
//
// WHAT IT DOES:
//   Returns FALSE for the first occurrence, TRUE for all repeats after it.
//   If a combination appears 3 times, the 1st is FALSE, the 2nd and 3rd are TRUE.
//
// WHEN TO USE:
//   You want to DELETE duplicates but KEEP ONE copy.
//   Filter to TRUE, delete those rows, and you're left with unique data.
//
// EXAMPLE:
//   Row 2: Apple, Red     → FALSE (first time seeing this)
//   Row 3: Banana, Yellow → FALSE (unique)
//   Row 4: Apple, Red     → TRUE  (seen before in row 2!)
//   Row 5: Apple, Red     → TRUE  (seen before in rows 2 and 4!)
//
// RETURNS:
//   TRUE  = this is a REPEAT (I've seen this combination before)
//   FALSE = this is the FIRST occurrence (or has blank cells)
//
// ─── THE FORMULA (checks columns A and C): ───

=IF(OR($A2="", $C2=""), FALSE, COUNTIFS($A$2:$A2, $A2, $C$2:$C2, $C2) > 1)

//
// THE MAGIC: Notice the range changed from $A:$A to $A$2:$A2
//
// HOW THE "RUNNING RANGE" WORKS:
//
//   $A$2:$A2 is a "growing" range that expands as you go down:
//
//   ┌─────────┬──────────────────┬─────────────────────────────────────────┐
//   │ In row  │ Range becomes    │ What it checks                          │
//   ├─────────┼──────────────────┼─────────────────────────────────────────┤
//   │ Row 2   │ $A$2:$A2         │ Just row 2 (itself only)                │
//   │ Row 3   │ $A$2:$A3         │ Rows 2-3 (row 2 + itself)               │
//   │ Row 4   │ $A$2:$A4         │ Rows 2-4 (rows 2,3 + itself)            │
//   │ Row 5   │ $A$2:$A5         │ Rows 2-5 (rows 2,3,4 + itself)          │
//   └─────────┴──────────────────┴─────────────────────────────────────────┘
//
//   RESULT:
//   • First occurrence → count = 1 (only counts itself) → FALSE
//   • Second occurrence → count = 2 (itself + earlier match) → TRUE
//   • Third occurrence → count = 3 → TRUE
//
//   Think of it as asking: "Have I seen this BEFORE (above me in the list)?"
//


// ────────────────────────────────────────────────────────────────────────────
// FORMULA 3: Mark ONLY the first occurrence (when duplicates exist)
// ────────────────────────────────────────────────────────────────────────────
//
// WHAT IT DOES:
//   Returns TRUE only for the FIRST row in a duplicate group.
//   Later copies and unique rows all get FALSE.
//
// WHEN TO USE:
//   You want to identify the "original" row in each duplicate group.
//   Useful for reviewing which copy to keep before deleting others.
//
// EXAMPLE:
//   Row 2: Apple, Red     → TRUE  (first of a duplicate group)
//   Row 3: Banana, Yellow → FALSE (unique, so not "first of duplicates")
//   Row 4: Apple, Red     → FALSE (duplicate, but not the first)
//   Row 5: Apple, Red     → FALSE (duplicate, but not the first)
//
// RETURNS:
//   TRUE  = this is the FIRST occurrence AND duplicates exist later
//   FALSE = unique, OR it's a repeat, OR has blank cells
//
// ─── THE FORMULA (checks columns A and C): ───

=IF(OR($A2="", $C2=""), FALSE,
  AND(
    COUNTIFS($A:$A, $A2, $C:$C, $C2) > 1,
    COUNTIFS($A$2:$A2, $A2, $C$2:$C2, $C2) = 1
  )
)

//
// HOW IT WORKS (two conditions that must BOTH be true):
//
//   Condition 1: COUNTIFS($A:$A, $A2, $C:$C, $C2) > 1
//                ┌──────────────────────────────────────────────────────┐
//                │ "This combination exists more than once somewhere"   │
//                │  Uses full column ($A:$A) = looks at ALL rows        │
//                └──────────────────────────────────────────────────────┘
//
//   Condition 2: COUNTIFS($A$2:$A2, $A2, $C$2:$C2, $C2) = 1
//                ┌──────────────────────────────────────────────────────┐
//                │ "This is the FIRST time I'm seeing this"             │
//                │  Uses running range ($A$2:$A2) = only rows so far    │
//                │  Count = 1 means no earlier row has this combo       │
//                └──────────────────────────────────────────────────────┘
//
//   Together: "Duplicates exist" AND "This is the first one" → TRUE
//


// ────────────────────────────────────────────────────────────────────────────
// FORMULA 4: Count how many times this combination appears
// ────────────────────────────────────────────────────────────────────────────
//
// WHAT IT DOES:
//   Returns a NUMBER showing how many times this combination appears.
//   Not TRUE/FALSE — an actual count.
//
// WHEN TO USE:
//   You want to analyze your data: "How many times does each combo appear?"
//   Useful for reports or finding which duplicates are most common.
//
// EXAMPLE:
//   Row 2: Apple, Red     → 3 (this combo appears 3 times total)
//   Row 3: Banana, Yellow → 1 (unique)
//   Row 4: Apple, Red     → 3
//   Row 5: Apple, Red     → 3
//
// RETURNS:
//   A number (1, 2, 3...) or blank if cells are empty
//
// ─── THE FORMULA (checks columns A and C): ───

=IF(OR($A2="", $C2=""), "", COUNTIFS($A:$A, $A2, $C:$C, $C2))

//
// This is the simplest form — just the raw COUNTIFS result.
// Returns "" (blank) for empty rows to keep your data clean.
//



// ============================================================================
//                    PART 3: HOW TO CUSTOMIZE FOR YOUR DATA
// ============================================================================
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  CHANGING WHICH COLUMNS TO CHECK                                         │
// └──────────────────────────────────────────────────────────────────────────┘
//
// Just replace the column letters! 
//
// EXAMPLE: Check columns B and D instead of A and C:
//
//   BEFORE: =IF(OR($A2="", $C2=""), FALSE, COUNTIFS($A:$A, $A2, $C:$C, $C2) > 1)
//                   ↓       ↓                       ↓     ↓    ↓     ↓
//   AFTER:  =IF(OR($B2="", $D2=""), FALSE, COUNTIFS($B:$B, $B2, $D:$D, $D2) > 1)
//
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  ADDING MORE COLUMNS TO CHECK                                            │
// └──────────────────────────────────────────────────────────────────────────┘
//
// For each additional column, you add TWO things:
//
//   1. ADD TO THE BLANK CHECK (inside the OR):
//
//      OR($A2="", $C2="")           ← original (2 columns)
//      OR($A2="", $C2="", $E2="")   ← with column E added
//                         ↑↑↑↑↑↑↑
//                         new part
//
//   2. ADD TO COUNTIFS (add another range + value pair):
//
//      COUNTIFS($A:$A, $A2, $C:$C, $C2)                    ← original
//      COUNTIFS($A:$A, $A2, $C:$C, $C2, $E:$E, $E2)        ← with column E
//                                      ↑↑↑↑↑↑↑↑↑↑↑
//                                      new pair
//
// FULL EXAMPLE (3 columns: A, C, E):
//
//   =IF(OR($A2="", $C2="", $E2=""), FALSE,
//     COUNTIFS($A:$A, $A2, $C:$C, $C2, $E:$E, $E2) > 1
//   )
//
// ============================================================================



// ============================================================================
//                    PART 4: READY-TO-USE TEMPLATES
// ============================================================================


// ┌──────────────────────────────────────────────────────────────────────────┐
// │  3-COLUMN FORMULAS (A, C, E)                                             │
// └──────────────────────────────────────────────────────────────────────────┘


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



// ┌──────────────────────────────────────────────────────────────────────────┐
// │  4-COLUMN FORMULAS (A, C, E, H)                                          │
// └──────────────────────────────────────────────────────────────────────────┘


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
//                    PART 5: PERFORMANCE & EDGE CASES
// ============================================================================


// ┌──────────────────────────────────────────────────────────────────────────┐
// │  ⚡ SPEEDING UP LARGE DATASETS (1000+ rows)                              │
// └──────────────────────────────────────────────────────────────────────────┘
//
// PROBLEM:
//   Whole-column references like $A:$A check a million+ cells.
//   This can make your spreadsheet slow if you have lots of formulas.
//
// SOLUTION:
//   Use "bounded ranges" that only check the rows you actually have data in.
//
// HOW TO CHANGE:
//
//   BEFORE: $A:$A              (whole column — slow)
//   AFTER:  $A$2:$A$5000       (bounded — faster)
//           ↑    ↑
//           start  end (set this to your last data row or higher)
//
// IMPORTANT RULES:
//   • ALL ranges must use the SAME start and end rows
//   • Set the end row to be >= your last data row (ok to overestimate)
//
// ─── Example: Mark ALL duplicates, bounded to rows 2-5000 ───

=IF(OR($A2="", $C2=""), FALSE,
  COUNTIFS($A$2:$A$5000, $A2, $C$2:$C$5000, $C2) > 1
)



// ┌──────────────────────────────────────────────────────────────────────────┐
// │  🧹 HANDLING CELLS THAT LOOK BLANK BUT AREN'T                            │
// └──────────────────────────────────────────────────────────────────────────┘
//
// PROBLEM:
//   Some cells appear empty but actually contain:
//     • Spaces: "   "
//     • Non-breaking spaces (copied from web pages)
//     • Other invisible characters
//
//   The standard check ($A2="") won't catch these!
//
// SOLUTION:
//   Use LEN(TRIM(...))=0 instead of =""
//
//   • TRIM removes leading/trailing spaces
//   • LEN counts remaining characters
//   • If LEN = 0 after trimming, it's truly blank
//
// ─── Example: Mark ALL duplicates with robust blank handling ───

=IF(OR(LEN(TRIM($A2))=0, LEN(TRIM($C2))=0), FALSE,
  COUNTIFS($A:$A, $A2, $C:$C, $C2) > 1
)



// ============================================================================
//                    PART 6: ADVANCED — "FUZZY" K-OF-N MATCHING
// ============================================================================
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  WHEN DO YOU NEED THIS?                                                  │
// └──────────────────────────────────────────────────────────────────────────┘
//
// Normal duplicates (Formulas 1-4) require ALL columns to match.
//
// But sometimes you want "close enough" matches:
//   • "Flag rows where at least 2 out of 3 columns match"
//   • "Find records that share any 3 fields out of 5"
//
// This is called "K-of-N matching":
//   • N = total number of columns you're checking
//   • K = minimum number that must match
//
// EXAMPLES (with 3 columns: Name, Email, Phone):
//
//   K = 3 → All three must match (same as regular duplicates)
//   K = 2 → Any two must match:
//           • Name + Email match, OR
//           • Name + Phone match, OR
//           • Email + Phone match
//   K = 1 → Any one matches (usually too loose!)
//
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  HOW THESE FORMULAS WORK (Conceptually)                                  │
// └──────────────────────────────────────────────────────────────────────────┘
//
// The idea:
//   1. For each row in the dataset, count how many columns match the current row
//   2. If that count >= K, it's a "match"
//   3. If there are multiple "matches" (including itself), we have duplicates
//
// Why not just use COUNTIFS?
//   COUNTIFS requires ALL conditions to be true. There's no built-in way to say
//   "any 2 out of 3." You'd have to write separate COUNTIFS for every possible
//   pair, which gets complicated fast (3 pairs for 3 columns, 10 pairs for 5
//   columns, etc.)
//
// These formulas use a "match score" approach that scales cleanly.
//
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  PREREQUISITES: Understanding the Building Blocks                        │
// └──────────────────────────────────────────────────────────────────────────┘
//
// These formulas use advanced functions. Here's a quick primer:
//
// LET(name, value, ..., result)
//   Creates named variables inside a formula. Makes complex formulas readable.
//   Example: LET(x, 5, y, 10, x + y)  → returns 15
//
// HSTACK(range1, range2, ...)
//   Stacks columns side by side horizontally.
//   Example: HSTACK(A2:A10, C2:C10, E2:E10) makes a 3-column array
//
// MMULT(array1, array2)
//   Matrix multiplication. We use it to sum across columns.
//
// SEQUENCE(rows, cols, start, step)
//   Creates a sequence of numbers.
//
// --(...) (double negative)
//   Converts TRUE/FALSE to 1/0 so we can do math on it.
//
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  SETUP REQUIREMENTS                                                      │
// └──────────────────────────────────────────────────────────────────────────┘
//
// 1. Put your minimum match number (K) in a cell, e.g., cell $Z$1
//    • If you want "at least 2 columns must match," put 2 in Z1
//
// 2. Replace 5000 with your actual last data row (or higher)
//
// 3. Replace columns A, C, E with your actual columns
//
// ============================================================================


// ────────────────────────────────────────────────────────────────────────────
// FORMULA 5: Mark ALL "minimum-match" duplicates (including the first)
// ────────────────────────────────────────────────────────────────────────────
//
// WHAT IT DOES:
//   Returns TRUE for any row that has at least one OTHER row where >= K
//   columns match.
//
// WHEN TO USE:
//   You want to find "close enough" duplicates where not every column matches.
//
// EXAMPLE (K=2, checking Name/Email/Phone):
//   Row 2: John, john@x.com, 555-1234  → TRUE (matches row 4 on Name + Email)
//   Row 3: Jane, jane@y.com, 555-5678  → FALSE (no other row matches 2+ columns)
//   Row 4: John, john@x.com, 555-9999  → TRUE (matches row 2 on Name + Email)
//
// RETURNS:
//   TRUE  = at least one other row matches on >= K columns
//   FALSE = no sufficient matches (or not enough filled cells)
//
// ─── THE FORMULA (columns A, C, E — minimum match in $Z$1): ───

=LET(
  min, $Z$1,
  key,  HSTACK($A2, $C2, $E2),
  data, HSTACK($A$2:$A$5000, $C$2:$C$5000, $E$2:$E$5000),

  keyOK, --(key<>""),
  filled, SUM(keyOK),

  IF(filled < min, FALSE,
    LET(
      ones, SEQUENCE(COLUMNS(data), 1, 1, 0),
      score, MMULT(--(data=key) * keyOK, ones),
      SUM(--(score >= min)) > 1
    )
  )
)

//
// PLAIN ENGLISH EXPLANATION:
//
//   min      = the minimum number of columns that must match (from cell Z1)
//   key      = this row's values, stacked horizontally
//   data     = all rows' values, stacked horizontally
//   keyOK    = which cells in this row are non-blank (1 or 0)
//   filled   = how many non-blank cells this row has
//
//   If this row doesn't have enough filled cells to even qualify, return FALSE.
//
//   Otherwise:
//   score    = for each row in the dataset, how many columns match this row?
//              (blanks in the key don't count as matches)
//   
//   If at least 2 rows have score >= min, that means this row PLUS at least
//   one other row match → TRUE
//


// ────────────────────────────────────────────────────────────────────────────
// FORMULA 6: Mark only 2nd, 3rd, 4th... occurrences (minimum-match version)
// ────────────────────────────────────────────────────────────────────────────
//
// WHAT IT DOES:
//   Returns FALSE for the first "minimum-match" in a group, TRUE for later ones.
//
// WHEN TO USE:
//   You want to keep one copy of each "close enough" duplicate group.
//
// HOW IT WORKS:
//   Uses a running range (row 2 → current row) so it only sees earlier rows.
//   First match has count=1 (just itself) → FALSE
//   Later matches have count=2+ (itself + earlier) → TRUE
//
// ─── THE FORMULA (columns A, C, E — minimum match in $Z$1): ───

=LET(
  min, $Z$1,
  key,  HSTACK($A2, $C2, $E2),
  data, HSTACK($A$2:$A2, $C$2:$C2, $E$2:$E2),

  keyOK, --(key<>""),
  filled, SUM(keyOK),

  IF(filled < min, FALSE,
    LET(
      ones, SEQUENCE(COLUMNS(data), 1, 1, 0),
      score, MMULT(--(data=key) * keyOK, ones),
      SUM(--(score >= min)) > 1
    )
  )
)

//
// NOTE THE DIFFERENCE FROM FORMULA 5:
//   Formula 5 uses: $A$2:$A$5000 (all data rows)
//   Formula 6 uses: $A$2:$A2 (running range — only rows up to current)
//
//   This is the same "running range" technique from Formula 2!
//


// ────────────────────────────────────────────────────────────────────────────
// FORMULA 7: Mark ONLY the first occurrence (minimum-match version)
// ────────────────────────────────────────────────────────────────────────────
//
// WHAT IT DOES:
//   Returns TRUE only for the FIRST row in a "minimum-match" group.
//   Later copies and rows without matches get FALSE.
//
// WHEN TO USE:
//   You want to identify the "original" row in each fuzzy-duplicate group.
//
// ─── THE FORMULA (columns A, C, E — minimum match in $Z$1): ───

=LET(
  min, $Z$1,
  key,  HSTACK($A2, $C2, $E2),

  dataAll, HSTACK($A$2:$A$5000, $C$2:$C$5000, $E$2:$E$5000),
  dataRun, HSTACK($A$2:$A2,    $C$2:$C2,    $E$2:$E2),

  keyOK, --(key<>""),
  filled, SUM(keyOK),

  IF(filled < min, FALSE,
    LET(
      onesAll, SEQUENCE(COLUMNS(dataAll), 1, 1, 0),
      scoreAll, MMULT(--(dataAll=key) * keyOK, onesAll),
      cntAll, SUM(--(scoreAll >= min)),

      onesRun, SEQUENCE(COLUMNS(dataRun), 1, 1, 0),
      scoreRun, MMULT(--(dataRun=key) * keyOK, onesRun),
      cntRun, SUM(--(scoreRun >= min)),

      AND(cntAll > 1, cntRun = 1)
    )
  )
)

//
// LOGIC (same idea as Formula 3):
//   cntAll = matches in the entire dataset
//   cntRun = matches in rows so far (up to current row)
//
//   Returns TRUE when:
//     cntAll > 1  → "There ARE matches somewhere in the dataset"
//     cntRun = 1  → "I haven't seen a match before this row" (this is the first)
//


// ────────────────────────────────────────────────────────────────────────────
// FORMULA 8: Count how many rows match on >= K columns
// ────────────────────────────────────────────────────────────────────────────
//
// WHAT IT DOES:
//   Returns a NUMBER: how many rows (including this one) match on at least
//   K columns.
//
// WHEN TO USE:
//   You want to analyze fuzzy-duplicate counts, not just TRUE/FALSE.
//
// RETURNS:
//   A number (includes the row itself), or blank if it doesn't qualify
//
// ─── THE FORMULA (columns A, C, E — minimum match in $Z$1): ───

=LET(
  min, $Z$1,
  key,  HSTACK($A2, $C2, $E2),
  data, HSTACK($A$2:$A$5000, $C$2:$C$5000, $E$2:$E$5000),

  keyOK, --(key<>""),
  filled, SUM(keyOK),

  IF(filled < min, "",
    LET(
      ones, SEQUENCE(COLUMNS(data), 1, 1, 0),
      score, MMULT(--(data=key) * keyOK, ones),
      SUM(--(score >= min))
    )
  )
)

//
// TIP: To EXCLUDE the row itself from the count, subtract 1:
//
//   SUM(--(score >= min)) - 1
//


// ┌──────────────────────────────────────────────────────────────────────────┐
// │  🔧 HOW TO CUSTOMIZE K-OF-N FORMULAS                                     │
// └──────────────────────────────────────────────────────────────────────────┘
//
// ADDING MORE COLUMNS IS EASY!
//
// You only change TWO places:
//
// 1. Add the cell to "key":
//
//    key,  HSTACK($A2, $C2, $E2)              ← original (3 columns)
//    key,  HSTACK($A2, $C2, $E2, $H2, $K2)    ← with columns H and K added
//
// 2. Add the range to "data" (same order!):
//
//    data, HSTACK($A$2:$A$5000, $C$2:$C$5000, $E$2:$E$5000)
//    data, HSTACK($A$2:$A$5000, $C$2:$C$5000, $E$2:$E$5000, $H$2:$H$5000, $K$2:$K$5000)
//
// That's it! The formula automatically handles any K-of-N combination.
//
//
// CHANGING K (minimum match):
//
//   • Edit cell $Z$1 to change how many columns must match
//   • Or hardcode it by changing "min, $Z$1" to "min, 2" (or 3, etc.)
//
//
// HANDLING TRICKY BLANKS (spaces):
//
//   Replace this line:
//     keyOK, --(key<>""),
//
//   With this:
//     keyOK, --(LEN(TRIM(key))>0),
//
// ============================================================================



// ============================================================================
//                    PART 7: QUICK REFERENCE CHEAT SHEET
// ============================================================================
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  RANGE STYLES AT A GLANCE                                                │
// └──────────────────────────────────────────────────────────────────────────┘
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
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  THE DOLLAR SIGN ($) — WHAT IT MEANS                                     │
// └──────────────────────────────────────────────────────────────────────────┘
//
//   $A2      → Column is LOCKED (A stays A when you drag sideways)
//            → Row is FLEXIBLE (2 becomes 3, 4, 5... when you drag down)
//
//   $A:$A    → Entire column, locked
//
//   $A$2:$A2 → Start is LOCKED at row 2
//            → End GROWS as you drag down (row 2, then 3, then 4...)
//              This is how the "running count" trick works!
//
//   $A$2:$A$5000 → Both start AND end are LOCKED (fixed range)
//
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  FORMULA QUICK PICKER                                                    │
// └──────────────────────────────────────────────────────────────────────────┘
//
//   ┌─────────────────────────────────────┬───────────────────────────────────┐
//   │ What I want                         │ Which formula                     │
//   ├─────────────────────────────────────┼───────────────────────────────────┤
//   │ Mark ALL duplicated rows            │ Formula 1 (or 5 for fuzzy)        │
//   │ Mark repeats, skip the first        │ Formula 2 (or 6 for fuzzy)        │
//   │ Mark only the first in each group   │ Formula 3 (or 7 for fuzzy)        │
//   │ Get the actual count                │ Formula 4 (or 8 for fuzzy)        │
//   │ Not all columns need to match       │ Formulas 5-8 (K-of-N matching)    │
//   └─────────────────────────────────────┴───────────────────────────────────┘
//
//
// ┌──────────────────────────────────────────────────────────────────────────┐
// │  COMMON MISTAKES TO AVOID                                                │
// └──────────────────────────────────────────────────────────────────────────┘
//
//   ✗ Forgetting $ on column letters
//     → Your columns will shift when you drag the formula sideways
//
//   ✗ Using different range sizes in COUNTIFS
//     → All ranges must have the same number of rows
//
//   ✗ Using $A:$A on very large sheets
//     → Slows down your spreadsheet; use bounded ranges instead
//
//   ✗ Not handling blanks
//     → Blank cells might "match" each other; the formulas above handle this
//
// ============================================================================
