=LET(
  dt, IF(ISNUMBER(B1), B1, DATEVALUE(B1)),
  prefix, "T&R Checks ",
  data_rng, "A2:P",

  REM_1, "--- PRE-CALCULATE DATE PARTS ---",
  mon_list, UNIQUE({TEXT(dt, "m"); TEXT(dt, "mm")}),
  day_list, UNIQUE({TEXT(dt, "d"); TEXT(dt, "dd")}),
  yr_list,  {TEXT(dt, "yy"); TEXT(dt, "yyyy")},
  sep_list, {"."; "-"; "/"},
  
  REM_2, "--- GENERATE CARTESIAN PRODUCT (Vector Method) ---",
  REM_Step1, "Combine Month & Sep1",
  step1, TOCOL(mon_list & TOROW(sep_list)),
  
  REM_Step2, "Add Day",
  step2, TOCOL(step1 & TOROW(day_list)),
  
  REM_Step3, "Add Sep2 (Allows mixed separators)",
  step3, TOCOL(step2 & TOROW(sep_list)),
  
  REM_Step4, "Add Year",
  date_formats, TOCOL(step3 & TOROW(yr_list)),

  REM_3, "--- ADD TAB NAME VARIATIONS (Trailing Spaces) ---",
  REM_Suffix, "Check both 'Name' and 'Name '",
  tab_names, TOCOL(prefix & date_formats & TOROW({""; " "})),

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