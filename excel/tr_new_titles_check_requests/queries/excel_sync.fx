=LET(
  dt, INT(IF(ISNUMBER(B1), B1, DATEVALUE(B1))),
  prefix, "T&R Checks ",
  data_rng, "A2:P",

  REM_1, "--- PRE-CALCULATE DATE PARTS ---",
  mon_m,  TEXT(dt, "m"),
  mon_mm, TEXT(dt, "mm"),
  day_d,  TEXT(dt, "d"),
  day_dd, TEXT(dt, "dd"),

  mon_list, IF(LEN(mon_m)=1, {mon_m; mon_mm}, {mon_m}),
  day_list, IF(LEN(day_d)=1, {day_d; day_dd}, {day_d}),

  yr_list,  {TEXT(dt, "yy"); TEXT(dt, "yyyy")},
  sep_list, {"."; "-"; "/"},

  REM_2, "--- GENERATE CARTESIAN PRODUCT (Vector Method) ---",
  step1, TOCOL(ARRAYFORMULA(mon_list & TOROW(sep_list))),
  step2, TOCOL(ARRAYFORMULA(step1 & TOROW(day_list))),
  step3, TOCOL(ARRAYFORMULA(step2 & TOROW(sep_list))),
  date_formats, TOCOL(ARRAYFORMULA(step3 & TOROW(yr_list))),

  REM_3, "--- ADD TAB NAME VARIATIONS (Trailing Spaces) ---",
  tab_names, TOCOL(ARRAYFORMULA(prefix & date_formats & TOROW({""; " "}))),

  REM_4, "--- SEARCH AND RETRIEVE ---",
  validSheet, REDUCE(NA(), tab_names, LAMBDA(found, name,
    IF(ISTEXT(found), found,
      IF(IFERROR(ROWS(INDIRECT("'" & name & "'!A1")), 0) > 0, name, NA())
    )
  )),

  IF(ISNA(validSheet),
    "ERROR: Checked " & COUNTA(tab_names) & " variations. No match found.",
    QUERY(
      ARRAYFORMULA(SUBSTITUTE(TO_TEXT(INDIRECT("'" & validSheet & "'!" & data_rng)), "$", "")),
      "SELECT * WHERE Col1 IS NOT NULL AND NOT Col1 CONTAINS 'CLOSED' AND NOT Col1 CONTAINS 'WARNING'",
      1
    )
  )
)