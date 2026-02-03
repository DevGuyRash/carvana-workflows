=LET(
  initials, "AK",
  date, TEXT(TODAY(), "yyyymmdd"),
  fileInfo, CELL("filename", A1),
  uuid, IF(fileInfo="","",
    LET(
      openBracketPos, FIND("[", fileInfo),
      closeBracketPos, FIND("]", fileInfo, openBracketPos),
      sourceText, LEFT(fileInfo, closeBracketPos),

      chunkBase, 2^16,
      modulus32, chunkBase^2,
      fnvPrime, 16777619,

      mulMod32, LAMBDA(leftNum, rightNum,
        LET(
          leftLow, MOD(leftNum, chunkBase),
          leftHigh, INT(leftNum/chunkBase),
          rightLow, MOD(rightNum, chunkBase),
          rightHigh, INT(rightNum/chunkBase),
          MOD(
            leftLow*rightLow + MOD(leftLow*rightHigh + leftHigh*rightLow, chunkBase)*chunkBase,
            modulus32
          )
        )
      ),

      fnvHash32, LAMBDA(textIn,
        REDUCE(2166136261, SEQUENCE(LEN(textIn)), LAMBDA(hashVal, indexPos,
          mulMod32(BITXOR(hashVal, UNICODE(MID(textIn, indexPos, 1))), fnvPrime)
        ))
      ),

      toHex8, LAMBDA(textIn, LOWER(BASE(fnvHash32(textIn), 16, 8))),
      hexAll, toHex8(sourceText) & toHex8(sourceText&"|2") & toHex8(sourceText&"|3") & toHex8(sourceText&"|4"),

      uuidHex, LEFT(hexAll, 12) & "4" & MID(hexAll, 14, 3) & "8" & MID(hexAll, 18, 15),

      LEFT(uuidHex, 8) & "-" & MID(uuidHex, 9, 4) & "-" & MID(uuidHex, 13, 4) & "-" & MID(uuidHex, 17, 4) & "-" & RIGHT(uuidHex, 12)
    )
  ),
  finalText, date & initials & "-" & "TR" & "-" & uuid,
  finalText
)
