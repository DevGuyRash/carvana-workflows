=LET(
  invoiceId, [@[*Invoice ID]],
  IF(
    invoiceId="",
    "",
    LET(
      supplierNumber, [@[**Supplier Number]],
      invoiceDateText, IF([@[*Invoice Date]]="", TEXT(TODAY(), "mmddyyyy"), TEXT([@[*Invoice Date]], "mmddyyyy")),
      relatedLineCount, COUNTIF(tbl_invoice_lines[*Invoice ID], invoiceId),

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
        IF(dateSequence=1, "", "-" & (dateSequence-1)) &
        "-TR",

      IF(
        relatedLineCount<>1,
        dateInvoiceNumber,
        LET(
          relatedDescriptions, IFERROR(FILTER(tbl_invoice_lines[Description], tbl_invoice_lines[*Invoice ID]=invoiceId), ""),
          relatedTextRaw, UPPER(REGEXREPLACE(TRIM(TEXTJOIN(" ", TRUE, relatedDescriptions)), "\s+", " ")),
          relatedText, REGEXREPLACE(relatedTextRaw, "\s*-\s*", "-"),

          stockLabelMatch,
            IFERROR(
              REGEXEXTRACT(
                relatedText,
                "\bSTOCK(?:\s*NUMBER(?:S)?)?\b\s*(?:[#:\(\)\[\]\-]\s*)*[A-Z0-9&-]{3,}\b"
              ),
              ""
            ),
          stockByLabelRaw,
            IFERROR(
              REGEXEXTRACT(
                stockLabelMatch,
                "[A-Z0-9&-]{3,}$"
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
                  "^((?:[A-Z0-9&]{2,8}-)?\d{7,12})"
                ),
                ""
              )
            ),
          stockByLabelNumeric,
            IF(
              stockByLabel="",
              "",
              REGEXREPLACE(stockByLabel, "^[A-Z0-9&]{2,8}-", "")
            ),
          stockTagByLabel,
            IFERROR(
              REGEXEXTRACT(
                stockByLabelRaw,
                "^(?:[A-Z0-9&]{2,8}-)?\d{7,12}-(?:[A-Z]{2,8}|[0-9]{1,4})$"
              ),
              ""
            ),
          stockTagByLabelOnly,
            IF(
              stockTagByLabel="",
              "",
              REGEXREPLACE(stockTagByLabel, "^(?:[A-Z0-9&]{2,8}-)?\d{7,12}-", "")
            ),
          descriptorMatchRaw,
            IFERROR(
              REGEXEXTRACT(
                relatedText,
                "(?:^|[^A-Z0-9&])(?:[A-Z0-9&]{2,8}-)?\d{7,12}(?:-(?:[A-Z]{2,8}|\d{1,4}))?-[A-HJ-NPR-Z0-9]{11,17}(?:-\d{3,})?(?:-[A-Z0-9&]{2,30})*(?:$|[^A-Z0-9&])"
              ),
              ""
            ),
          descriptorMatch, REGEXREPLACE(descriptorMatchRaw, "^[^A-Z0-9&]+|[^A-Z0-9&]+$", ""),
          stockByDescriptor,
            IFERROR(
              REGEXEXTRACT(
                descriptorMatch,
                "^((?:[A-Z0-9&]{2,8}-)?\d{7,12})"
              ),
              ""
            ),
          stockByDescriptorNumeric,
            IF(
              stockByDescriptor="",
              "",
              REGEXREPLACE(stockByDescriptor, "^[A-Z0-9&]{2,8}-", "")
            ),
          stockTagByDescriptor,
            IFERROR(
              REGEXEXTRACT(
                descriptorMatch,
                "^(?:[A-Z0-9&]{2,8}-)?\d{7,12}-((?:[A-Z]{2,8}|\d{1,4}))-[A-HJ-NPR-Z0-9]{11,17}(?:-\d{3,})?(?:-[A-Z0-9&]{2,30})*$"
              ),
              ""
            ),
          stockTagByDescriptorOnly,
            IF(
              stockTagByDescriptor="",
              "",
              stockTagByDescriptor
            ),
          stockBaseCandidate, IF(stockByLabelNumeric<>"", stockByLabelNumeric, stockByDescriptorNumeric),
          stockTag, IF(stockTagByLabelOnly<>"", stockTagByLabelOnly, stockTagByDescriptorOnly),
          stockCandidate, IF(stockTag="", stockBaseCandidate, stockBaseCandidate & "-" & stockTag),
          stockIsVinLike,
            IF(
              stockCandidate="",
              FALSE,
              REGEXTEST(stockBaseCandidate, "^[A-HJ-NPR-Z0-9]{11,17}$")
            ),
          usableStock, IF(stockIsVinLike, "", stockCandidate),
          stockInvoiceNumber, usableStock & "-TR",

          IF(usableStock="", dateInvoiceNumber, stockInvoiceNumber)
        )
      )
    )
  )
)
