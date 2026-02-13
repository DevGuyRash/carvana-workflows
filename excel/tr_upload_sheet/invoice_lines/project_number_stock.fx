=LET(
  rawText, "" & [@Description],
  normalizedText, UPPER(REGEXREPLACE(TRIM(rawText), "\s+", " ")),
  stockLabelMatch,
    IFERROR(
      REGEXEXTRACT(
        normalizedText,
        "\bSTOCK(?:\s*NUMBER(?:S)?)?\b\s*(?:[#:\(\)\[\]\-]\s*)*[A-Z0-9-]{3,}\b"
      ),
      ""
    ),
  stockByLabel,
    IFERROR(
      REGEXEXTRACT(
        stockLabelMatch,
        "[A-Z0-9-]{3,}$"
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
  stockByDescriptor,
    IF(
      descriptorPartCount>=3,
      INDEX(descriptorParts, 1, descriptorPartCount-2),
      ""
    ),
  stockCandidate, IF(stockByLabel<>"", stockByLabel, stockByDescriptor),
  stockIsVinLike,
    IF(
      stockCandidate="",
      FALSE,
      REGEXTEST(stockCandidate, "^[A-HJ-NPR-Z0-9]{11,17}$")
    ),
  IF(stockIsVinLike, "", stockCandidate)
)
