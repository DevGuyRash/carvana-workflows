=LET(
  rawText, "" & [@Description],
  normalizedText, UPPER(REGEXREPLACE(TRIM(rawText), "\s+", " ")),
  canonicalText, REGEXREPLACE(normalizedText, "\s*-\s*", "-"),
  pidLabelMatch,
    IFERROR(
      REGEXEXTRACT(
        canonicalText,
        "\bPID(?:\s*NUMBER(?:S)?)?\b\s*(?:[#:\(\)\[\]\-]\s*)*\d{3,}\b"
      ),
      ""
    ),
  pidByLabel,
    IFERROR(
      REGEXEXTRACT(
        pidLabelMatch,
        "\d{3,}$"
      ),
      ""
    ),
  pidByDescriptor,
    IFERROR(
      REGEXEXTRACT(
        canonicalText,
        "(?:^|[^A-Z0-9&])(?:[A-Z0-9&]{2,8}-)?\d{7,12}(?:-(?:[A-Z]{2,8}|\d{1,4}))?-[A-HJ-NPR-Z0-9]{11,17}-(\d{3,})(?:-[A-Z0-9&]{2,30})*(?:$|[^A-Z0-9&])"
      ),
      ""
    ),
  IF(pidByLabel<>"", pidByLabel, pidByDescriptor)
)
