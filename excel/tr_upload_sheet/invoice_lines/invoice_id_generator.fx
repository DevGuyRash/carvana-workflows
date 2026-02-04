=LET(
  r, ROW(),
  ln, INDEX($B:$B, r),
  startRow, IFERROR(XMATCH(TRUE, IFERROR($B:$B*1, 0) > 0, 0), 0),
  IF(OR(ln="", startRow=0), "",
    IF(r=startRow, 1,
      LET(
        prevLn, INDEX($B:$B, r-1),
        prevInv, INDEX($A:$A, r-1),
        invRange, INDEX($A:$A, startRow):INDEX($A:$A, r-1),
        lnRange,  INDEX($B:$B, startRow):INDEX($B:$B, r-1),
        hasPrevLine, COUNTIFS(invRange, prevInv, lnRange, ln-1) > 0,
        IF(
          ln = prevLn + 1,
          prevInv,
          IF(
            ln > prevLn + 1,
            IF(hasPrevLine, prevInv, "ERROR"),
            prevInv + 1
          )
        )
      )
    )
  )
)