=LET(
  raw_list_rejected,  $T$1:$T$500,
  raw_list_accepted,  $S$1:$S$500,
  raw_list_reprinted, $U$1:$U$500,

  target_cell, $E3,

  use_rejected, FALSE,
  use_reprinted, FALSE,

  raw_list, IF(use_rejected, raw_list_rejected,
           IF(use_reprinted, raw_list_reprinted, raw_list_accepted)),

  list_nums,
    ARRAYFORMULA(
      IFERROR(
        REGEXEXTRACT(
          SUBSTITUTE(TO_TEXT(raw_list), CHAR(160), " "),
          "^[[:space:]]*([0-9]+)"
        ),
        ""
      )
    ),

  t, SUBSTITUTE(TO_TEXT(target_cell), CHAR(160), " "),
  inv,
    IFERROR(
      REGEXEXTRACT(
        t,
        "(?:^|[^0-9A-Za-z_])([0-9]+)(?:$|[^0-9A-Za-z_])"
      ),
      ""
    ),

  AND(inv<>"", COUNTIF(list_nums, inv)>0)
)