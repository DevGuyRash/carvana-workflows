=LET(
  invoiceId, [@[*Invoice ID]],
  supplierNumber, [@[**Supplier Number]],
  invoiceDateText, IF([@[*Invoice Date]]="", TEXT(TODAY(), "mmddyyyy"), TEXT([@[*Invoice Date]], "mmddyyyy")),

  relatedLineCount, COUNTIF(tbl_invoice_lines[*Invoice ID], invoiceId),
  relatedDescriptions, IFERROR(FILTER(tbl_invoice_lines[Description], tbl_invoice_lines[*Invoice ID]=invoiceId), ""),
  relatedText, UPPER(REGEXREPLACE(TRIM(TEXTJOIN(" ", TRUE, relatedDescriptions)), "\s+", " ")),

  stockLabelMatch,
    IFERROR(
      REGEXEXTRACT(
        relatedText,
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
        relatedText,
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
  stockBaseCandidate, IF(stockByLabel<>"", stockByLabel, stockByDescriptor),
  stockTag,
    IF(
      stockBaseCandidate="",
      "",
      IFERROR(
        REGEXEXTRACT(
          relatedText,
          "(?:^|[^A-Z0-9])" & stockBaseCandidate & "-(ADJ|SP|[0-9])(?:-|[^A-Z0-9]|$)"
        ),
        ""
      )
    ),
  stockCandidate, IF(stockTag="", stockBaseCandidate, stockBaseCandidate & "-" & stockTag),
  stockIsVinLike,
    IF(
      stockCandidate="",
      FALSE,
      REGEXTEST(stockBaseCandidate, "^[A-HJ-NPR-Z0-9]{11,17}$")
    ),
  usableStock, IF(stockIsVinLike, "", stockCandidate),

  priorDateModeCount,
    IF(
      supplierNumber="",
      0,
      SUMPRODUCT(
        --(tbl_invoices[**Supplier Number]=supplierNumber),
        --(TEXT(tbl_invoices[*Invoice Date], "mmddyyyy")=invoiceDateText),
        --(ROW(tbl_invoices[*Invoice ID])<ROW()),
        --(COUNTIF(tbl_invoice_lines[*Invoice ID], tbl_invoices[*Invoice ID])>1)
      )
    ),

  dateSequence, priorDateModeCount + 1,
  dateInvoiceNumber,
    invoiceDateText &
    IF(dateSequence=1, "", "-" & dateSequence) &
    "-TR",

  stockInvoiceNumber, usableStock & "-TR",
  useDateMode, OR(relatedLineCount>1, usableStock=""),

  IF(invoiceId="", "", IF(useDateMode, dateInvoiceNumber, stockInvoiceNumber))
)
