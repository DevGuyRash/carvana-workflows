=LET(
  firstRow, 5,
  r, ROW(),
  ln, B5,
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
            "ERROR",
            prevInv + 1
          )
        )
      )
    )
  )
)