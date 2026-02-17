=LET(
  ln, [@[Line Number]],
  lnCol, tbl_invoice_lines[Line Number],
  invCol, tbl_invoice_lines[*Invoice ID],
  rowIx, ROW() - ROW(INDEX(lnCol, 1, 1)) + 1,
  IF(
    ln="",
    "",
    IF(
      rowIx=1,
      1,
      LET(
        prevIx, rowIx-1,
        prevLn, INDEX(lnCol, prevIx),
        prevInv, INDEX(invCol, prevIx),
        nextExpected, prevLn + 1,
        IF(
          ln = nextExpected,
          prevInv,
          IF(
            ln < nextExpected,
            prevInv + 1,
            LET(
              lnHist, TAKE(lnCol, prevIx),
              matchIx, XMATCH(ln - 1, lnHist, 0, -1),
              hasPrevLineForInv, IFERROR(INDEX(invCol, matchIx) = prevInv, FALSE),
              IF(hasPrevLineForInv, prevInv, "ERROR")
            )
          )
        )
      )
    )
  )
)
