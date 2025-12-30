
// Set colors of a cell based on if it contains any of the numbers in a list
=LET(
  raw_list, $S$3:$S$500,
  target_cell, $E3,
  
  comment1, "Extract leading digits from List raw_list",
  clean_list, ARRAYFORMULA(IFERROR(REGEXEXTRACT(TO_TEXT(raw_list), "^\d+"), "")),
  
  comment2, "Combine all clean numbers into one big OR pattern (e.g. 123|456|789)",
  pattern, TEXTJOIN("|", TRUE, clean_list),
  
  comment3, "Check if Target contains any of those numbers (Guard against empty pattern)",
  result, IF(pattern = "", FALSE, REGEXMATCH(TO_TEXT(target_cell), "\b(" & pattern & ")\b")),
  
  result
)