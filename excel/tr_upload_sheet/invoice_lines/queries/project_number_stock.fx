=LET(
  rawText, "" & [@Description],
  normalizedText, UPPER(REGEXREPLACE(TRIM(rawText), "\s+", " ")),
  canonicalText, REGEXREPLACE(normalizedText, "\s*-\s*", "-"),
  stockLabelMatch,
    IFERROR(
      REGEXEXTRACT(
        canonicalText,
        "\bSTOCK(?:\s*NUMBER(?:S)?)?\b\s*(?:[#:\(\)\[\]\-]\s*)*[A-Z0-9-]{3,}\b"
      ),
      ""
    ),
  stockByLabelRaw,
    IFERROR(
      REGEXEXTRACT(
        stockLabelMatch,
        "[A-Z0-9-]{3,}$"
      ),
      ""
    ),
  stockByLabel,
    IF(
      stockByLabelRaw="",
      "",
      IFERROR(
        REGEXEXTRACT(
          stockByLabelRaw,
          "^(?:[A-Z0-9]{2,5}-)?\d{7,12}"
        ),
        ""
      )
    ),
  stockByLabelNumeric,
    IF(
      stockByLabel="",
      "",
      REGEXREPLACE(stockByLabel, "^[A-Z0-9]{2,5}-", "")
    ),
  descriptorMatchRaw,
    IFERROR(
      REGEXEXTRACT(
        canonicalText,
        "(?:^|[^A-Z0-9])(?:[A-Z0-9]{2,5}-)?\d{7,12}(?:-(?:[A-Z]{2,8}|\d{1,4}))?-[A-HJ-NPR-Z0-9]{11,17}-\d{3,}(?:$|[^A-Z0-9])"
      ),
      ""
    ),
  descriptorMatch, REGEXREPLACE(descriptorMatchRaw, "^[^A-Z0-9]+|[^A-Z0-9]+$", ""),
  stockByDescriptor,
    IFERROR(
      REGEXEXTRACT(
        descriptorMatch,
        "^(?:[A-Z0-9]{2,5}-)?\d{7,12}"
      ),
      ""
    ),
  stockByDescriptorNumeric,
    IF(
      stockByDescriptor="",
      "",
      REGEXREPLACE(stockByDescriptor, "^[A-Z0-9]{2,5}-", "")
    ),
  stockCandidate, IF(stockByLabelNumeric<>"", stockByLabelNumeric, stockByDescriptorNumeric),
  stockIsVinLike,
    IF(
      stockCandidate="",
      FALSE,
      REGEXTEST(stockCandidate, "^[A-HJ-NPR-Z0-9]{11,17}$")
    ),
  IF(stockIsVinLike, "", stockCandidate)
)
