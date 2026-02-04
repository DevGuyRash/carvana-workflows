=LET(
  initials, "AK",
  dateText, TEXT(TODAY(), "mmddyyyy"),
  saltValue, "A1B2C3",
  saltRounds, 3,
  fileInfo, CELL("filename", A1),
  uuid, IF(fileInfo="","",
    LET(
      openBracketPos, FIND("[", fileInfo),
      closeBracketPos, FIND("]", fileInfo, openBracketPos),
      sourceText, LEFT(fileInfo, closeBracketPos),

      roundCount, MAX(0, IFERROR(INT(saltRounds), 0)),
      saltText, "" & saltValue,

      chunkBase, 2^16,
      modulus32, chunkBase^2,
      fnvPrime, 16777619,

      mulMod32, LAMBDA(leftNum,rightNum,
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
        REDUCE(2166136261, SEQUENCE(LEN(textIn)), LAMBDA(hashVal,indexPos,
          mulMod32(BITXOR(hashVal, UNICODE(MID(textIn, indexPos, 1))), fnvPrime)
        ))
      ),

      blockHex, LAMBDA(blockLabel,
        LET(
          initHash, fnvHash32(sourceText & "|" & saltText & "|" & blockLabel),
          finalHash,
            IF(roundCount<1,
              initHash,
              REDUCE(
                initHash,
                SEQUENCE(roundCount),
                LAMBDA(h,i,
                  fnvHash32(BASE(h, 16, 8) & "|" & saltText & "|" & blockLabel & "|" & i)
                )
              )
            ),
          LOWER(BASE(finalHash, 16, 8))
        )
      ),

      hexAll, blockHex("A") & blockHex("B") & blockHex("C") & blockHex("D"),
      uuidHex, LEFT(hexAll, 12) & "4" & MID(hexAll, 14, 3) & "8" & MID(hexAll, 18, 15),

      LEFT(uuidHex, 8) & "-" & MID(uuidHex, 9, 4) & "-" & MID(uuidHex, 13, 4) & "-" & MID(uuidHex, 17, 4) & "-" & RIGHT(uuidHex, 12)
    )
  ),
  finalText, dateText & initials & "-" & "TR" & "-" & uuid,
  finalText
)