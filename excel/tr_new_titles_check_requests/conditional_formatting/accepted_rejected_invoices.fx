=LET(
  function_overview, "Set colors of a cell based on if it contains any of the numbers in a list",
  function_range, "Please use this function in $A$3:$Q$500 to keep it fast. Raise if needed.",
  comment_1, "rejected invoice numbers",
  raw_list_rejected, $T:$T,
  comment_2, "accepted invoice numbers",
  raw_list_accepted, $S:$S,
  comment_3, "reprinted invoice numbers",
  raw_list_reprinted, $U:$U,
  target_cell, $E3,
  comment_4, "change this to flip between rejected and accepted",
  use_rejected, FALSE,
  use_reprinted, FALSE,
  raw_list, IF(use_rejected, raw_list_rejected, IF(use_reprinted, raw_list_reprinted, raw_list_accepted)),
  
  comment1, "Extract leading digits from List raw_list",
  clean_list, ARRAYFORMULA(IFERROR(REGEXEXTRACT(TO_TEXT(raw_list), "^\d+"), "")),
  
  comment2, "Combine all clean numbers into one big OR pattern (e.g. 123|456|789)",
  pattern, TEXTJOIN("|", TRUE, clean_list),
  
  comment3, "Check if Target contains any of those numbers (Guard against empty pattern)",
  result, IF(pattern = "", FALSE, REGEXMATCH(TO_TEXT(target_cell), "\b(" & pattern & ")\b")),
  
  result
)