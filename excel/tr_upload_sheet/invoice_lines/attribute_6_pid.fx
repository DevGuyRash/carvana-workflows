=LET(
  rawText, "" & [@Description],
  normalizedText, UPPER(REGEXREPLACE(TRIM(rawText), "\s+", " ")),
  pidLabelMatch,
    IFERROR(
      REGEXEXTRACT(
        normalizedText,
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
  descriptorMatchRaw,
    IFERROR(
      REGEXEXTRACT(
        normalizedText,
        "(?:^|[^A-Z0-9])(?:[A-Z0-9]{2,5}-)?\d{7,12}-[A-HJ-NPR-Z0-9]{11,17}-\d{3,}(?:$|[^A-Z0-9])"
      ),
      ""
    ),
  descriptorMatch, REGEXREPLACE(descriptorMatchRaw, "^[^A-Z0-9]+|[^A-Z0-9]+$", ""),
  descriptorParts, IF(descriptorMatch="", "", TEXTSPLIT(descriptorMatch, "-")),
  descriptorPartCount, IF(descriptorMatch="", 0, COUNTA(descriptorParts)),
  pidByDescriptor,
    IF(
      descriptorPartCount>=3,
      INDEX(descriptorParts, 1, descriptorPartCount),
      ""
    ),
  IF(pidByLabel<>"", pidByLabel, pidByDescriptor)
)
