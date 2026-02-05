=LET(
  firstRow, 5,
  r, ROW(),
  ln, $B5,
  IF(ln="","",
    IF(r=firstRow, 1,
      LET(
        prevLn, $B4,
        prevInv, $A4,
        nextExpected, prevLn + 1,
        IF(
          ln = nextExpected,
          prevInv,
          IF(
            ln > nextExpected,
            LET(
              invHist, INDEX($A:$A, firstRow):INDEX($A:$A, r-1),
              lnHist,  INDEX($B:$B, firstRow):INDEX($B:$B, r-1),
              IF(COUNTIFS(invHist, prevInv, lnHist, ln-1)>0, prevInv, "ERROR")
            ),
            prevInv + 1
          )
        )
      )
    )
  )
)