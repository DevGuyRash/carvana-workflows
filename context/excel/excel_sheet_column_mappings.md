## T&R Upload Template

### Notes

- All headers currently exist on Row 4 and real data starts on Row 5

### 'AP_INVOICES_INTERFACE' Sheet

Named Values:

- Table Name: `tbl_invoices`

| Header Name           | Cell Reference |
| :-------------------- | :------------- |
| \*Invoice ID          | A4             |
| \*Business Unit       | B4             |
| \*Source              | C4             |
| \*Invoice Number      | D4             |
| \*Invoice Amount      | E4             |
| \*Invoice Date        | F4             |
| \*\*Supplier Number   | H4             |
| \*Supplier Site       | I4             |
| Invoice Currency      | J4             |
| Payment Currency      | K4             |
| Description           | L4             |
| Import Set            | M4             |
| \*Invoice Type        | N4             |
| Legal Entity          | O4             |
| \*Payment Terms       | T4             |
| Invoice Received Date | W4             |
| Accounting Date       | X4             |
| Payment Method        | Y4             |
| Pay Alone             | AA4            |

#### AP_INVOICES_INTERFACE Conditional Formatting Rules (Summary)

| Rule ID   | Applies To Range | Applies To Headers                              | Rule Type        |
| :-------- | :--------------- | :---------------------------------------------- | :--------------- |
| INV-CF-01 | `$A$5:$DZ$9`     | All headers in `AP_INVOICES_INTERFACE` (`A:DZ`) | Formula          |
| INV-CF-02 | `$X$5:$X$9`      | Accounting Date                                 | Formula          |
| INV-CF-03 | `$W$5:$W$9`      | Invoice Received Date                           | Formula          |
| INV-CF-04 | `$F$5:$F$9`      | \*Invoice Date                                  | Formula          |
| INV-CF-05 | `$AA$5:$AA$9`    | Pay Alone                                       | Formula          |
| INV-CF-06 | `$Y$5:$Y$9`      | Payment Method                                  | Formula          |
| INV-CF-07 | `$T$5:$T$9`      | \*Payment Terms                                 | Formula          |
| INV-CF-08 | `$M$5:$M$9`      | Import Set                                      | Duplicate values |
| INV-CF-09 | `$D$5:$D$9`      | \*Invoice Number                                | Duplicate values |
| INV-CF-10 | `$A$5:$A$9`      | \*Invoice ID                                    | Formula          |
| INV-CF-11 | `$E$5:$E$9`      | \*Invoice Amount                                | Formula          |

#### AP_INVOICES_INTERFACE Conditional Formatting Formulas (Formatted)

##### INV-CF-01

```excel
=AND(
  $E5>=100000,
  $E5<>""
)
```

##### INV-CF-02

```excel
=OR(
  $X5="",
  ISNUMBER($X5)=FALSE,
  IF(
    ISNUMBER($X5),
    OR(
      INT($X5)<>$X5,
      EOMONTH($X5,0)<>EOMONTH(TODAY(),0)
    ),
    FALSE
  )
)
```

##### INV-CF-03

```excel
=OR(
  $W5="",
  ISNUMBER($W5)=FALSE,
  IF(
    ISNUMBER($W5),
    OR(
      INT($W5)<>$W5,
      EOMONTH($W5,0)<>EOMONTH(TODAY(),0)
    ),
    FALSE
  )
)
```

##### INV-CF-04

```excel
=OR(
  $F5="",
  ISNUMBER($F5)=FALSE,
  IF(
    ISNUMBER($F5),
    OR(
      INT($F5)<>$F5,
      EOMONTH($F5,0)<>EOMONTH(TODAY(),0)
    ),
    FALSE
  )
)
```

##### INV-CF-05

```excel
=OR(
  AND($AA5="", $T5<>"", $Y5<>""),
  AND($AA5<>"", OR($T5="", $Y5=""))
)
```

##### INV-CF-06

```excel
=OR(
  AND($Y5="", $T5<>"", $AA5<>""),
  AND($Y5<>"", OR($T5="", $AA5=""))
)
```

##### INV-CF-07

```excel
=OR(
  AND($T5="", $Y5<>"", $AA5<>""),
  AND($T5<>"", OR($Y5="", $AA5=""))
)
```

##### INV-CF-08

```text
Duplicate values
```

##### INV-CF-09

```text
Duplicate values
```

##### INV-CF-10

```excel
=LET(
  note_text_1, N("TRUE if Invoice IDs are not continuous from 1..this ID within AP_INVOICES_INTERFACE."),
  note_text_2, N("Blank Invoice ID -> ignore (FALSE). Non-integer / <1 -> invalid (TRUE)."),

  inv_raw, $A5,
  inv_rng, $A$5:$A$1494,

  inv_blank, LEN(inv_raw&"")=0,
  inv_num, IFERROR(--inv_raw, 0),
  inv_is_pos_int, AND(inv_num>=1, inv_num=INT(inv_num)),

  present_cnt,
    IF(
      inv_is_pos_int,
      SUM(--(COUNTIF(inv_rng, SEQUENCE(inv_num))>0)),
      0
    ),

  continuity_ok, present_cnt=inv_num,

  IF(inv_blank, FALSE, IF(inv_is_pos_int, NOT(continuity_ok), TRUE))
)
```

##### INV-CF-11

```excel
=LET(
  note_text_1, N("TRUE when header Invoice Amount mismatches sum of nonblank line amounts."),
  note_text_2, N("Blank=blank is OK; blank vs nonblank is a mismatch."),

  inv_id, $A5,
  header_amt, $E5,

  line_ids, AP_INVOICE_LINES_INTERFACE!$A$5:$A$1489,
  line_amts, AP_INVOICE_LINES_INTERFACE!$D$5:$D$1489,

  has_nonblank_amt, COUNTIFS(line_ids, inv_id, line_amts, "<>")>0,
  lines_total, IF(has_nonblank_amt, SUMIFS(line_amts, line_ids, inv_id), ""),

  header_blank, LEN(header_amt&"")=0,
  lines_blank, LEN(lines_total&"")=0,

  mismatch,
    IF(
      AND(header_blank, lines_blank),
      FALSE,
      IF(OR(header_blank, lines_blank), TRUE, header_amt<>lines_total)
    ),

  AND(LEN(inv_id&"")>0, mismatch)
)
```

### 'AP_INVOICE_LINES_INTERFACE' Sheet

Named Values:

- Table Name: `tbl_invoice_lines`

| Header Name              | Cell Reference |
| :----------------------- | :------------- |
| \*Invoice ID             | A4             |
| Line Number              | B4             |
| \*Line Type              | C4             |
| \*Amount                 | D4             |
| Description              | H4             |
| Item Description         | M4             |
| Distribution Combination | V4             |
| Accounting Date          | X4             |
| Attribute Category       | BN4            |
| Attribute 6              | BT4            |
| Project Number           | DX4            |
| Task Number              | DY4            |
| Expenditure Type         | DZ4            |
| Expenditure Organization | EA4            |

#### AP_INVOICE_LINES_INTERFACE Conditional Formatting Rules (Summary)

| Rule ID    | Applies To Range | Applies To Headers        | Rule Type        |
| :--------- | :--------------- | :------------------------ | :--------------- |
| LINE-CF-01 | `$M$5:$M$9`      | Item Description          | Formula          |
| LINE-CF-02 | `$X$5:$X$9`      | Accounting Date           | Formula          |
| LINE-CF-03 | `$BN$5:$BN$9`    | Attribute Category        | Formula          |
| LINE-CF-04 | `$DY$5:$DY$9`    | Task Number               | Formula          |
| LINE-CF-05 | `$DZ$5:$DZ$9`    | Expenditure Type          | Formula          |
| LINE-CF-06 | `$EA$5:$EA$9`    | Expenditure Organization  | Formula          |
| LINE-CF-07 | `$BT$5:$BT$9`    | Attribute 6               | Formula          |
| LINE-CF-08 | `$BT$5:$BT$9`    | Attribute 6               | Duplicate Values |
| LINE-CF-09 | `$DX$5:$DX$9`    | Project Number            | Formula          |
| LINE-CF-10 | `$DX$5:$DX$9`    | Project Number            | Duplicate Values |
| LINE-CF-11 | `$A$5:$A$9`      | \*Invoice ID              | Formula          |
| LINE-CF-12 | `$A$5:$B$9`      | \*Invoice ID, Line Number | Formula          |
| LINE-CF-13 | `$A$5:$B$9`      | \*Invoice ID, Line Number | Formula          |
| LINE-CF-14 | `$A$5:$A$9`      | \*Invoice ID              | Formula          |
| LINE-CF-15 | `$A$5:$A$9`      | \*Invoice ID              | Formula          |

#### AP_INVOICE_LINES_INTERFACE Conditional Formatting Formulas (Formatted)

##### LINE-CF-01

```excel
=$M5<>$H5
```

##### LINE-CF-02

```excel
=OR(
  $X5="",
  ISNUMBER($X5)=FALSE,
  IF(
    ISNUMBER($X5),
    OR(
      INT($X5)<>$X5,
      EOMONTH($X5,0)<>EOMONTH(TODAY(),0)
    ),
    FALSE
  )
)
```

##### LINE-CF-03

```excel
=($EA5="")<>($BN5="")
```

##### LINE-CF-04

```excel
=($EA5="")<>($DY5="")
```

##### LINE-CF-05

```excel
=($EA5="")<>($DZ5="")
```

##### LINE-CF-06

```excel
=AND(
  $EA5<>"",
  OR($BN5="", $BT5="", $DX5="", $DY5="", $DZ5="")
)
```

##### LINE-CF-07

```excel
=($EA5="")<>($BT5="")
```

##### LINE-CF-08

```text
Duplicate Values
```

##### LINE-CF-09

```excel
=($EA5="")<>($DX5="")
```

##### LINE-CF-10

```text
Duplicate Values
```

##### LINE-CF-11

```excel
=LET(
  note_text_1, N("TRUE if Invoice IDs are not continuous from 1..this ID within AP_INVOICE_LINES_INTERFACE."),
  note_text_2, N("Blank Invoice ID -> ignore (FALSE). Non-integer / <1 -> invalid (TRUE)."),

  inv_raw, $A5,
  inv_rng, $A$5:$A$1489,

  inv_blank, LEN(inv_raw&"")=0,
  inv_num, IFERROR(--inv_raw, 0),
  inv_is_pos_int, AND(inv_num>=1, inv_num=INT(inv_num)),

  present_cnt,
    IF(
      inv_is_pos_int,
      SUM(--(COUNTIF(inv_rng, SEQUENCE(inv_num))>0)),
      0
    ),

  continuity_ok, present_cnt=inv_num,

  IF(inv_blank, FALSE, IF(inv_is_pos_int, NOT(continuity_ok), TRUE))
)
```

##### LINE-CF-12

```excel
=LET(
  note_text_1, N("TRUE when this invoice does NOT have a continuous set of line numbers from 1..this row's Line Number."),
  note_text_2, N("If Invoice ID is blank -> ignore (FALSE). If Line Number is blank / non-integer / <1 -> invalid (TRUE)."),

  inv_id, $A5,
  ln_raw, $B5,

  inv_rng, $A$5:$A$1489,
  ln_rng,  $B$5:$B$1489,

  inv_blank, LEN(inv_id&"")=0,

  ln_num, IFERROR(--ln_raw, 0),
  ln_is_pos_int, AND(ln_num>=1, ln_num=INT(ln_num)),

  present_count,
    IF(
      ln_is_pos_int,
      SUM(--(COUNTIFS(inv_rng, inv_id, ln_rng, SEQUENCE(ln_num))>0)),
      0
    ),

  continuity_ok, present_count=ln_num,

  IF(inv_blank, FALSE, IF(ln_is_pos_int, NOT(continuity_ok), TRUE))
)
```

##### LINE-CF-13

```excel
=LET(
  note_text_1, N("TRUE when (Invoice ID, Line Number) appears more than once in this sheet."),
  note_text_2, N("Blanks are ignored: if Invoice ID or Line Number is blank, returns FALSE."),

  inv_id, $A5,
  line_no, $B5,

  inv_id_rng, $A$5:$A$1489,
  line_no_rng, $B$5:$B$1489,

  inv_blank, LEN(inv_id&"")=0,
  line_blank, LEN(line_no&"")=0,

  occurrences, COUNTIFS(inv_id_rng, inv_id, line_no_rng, line_no),

  AND(NOT(inv_blank), NOT(line_blank), occurrences>1)
)
```

##### LINE-CF-14

```excel
=OR(
  $A5="",
  COUNTIF(AP_INVOICES_INTERFACE!$A:$A, $A5)=0
)
```

##### LINE-CF-15

```excel
=LET(
  note_text_1, N("TRUE highlights all lines for invoices where header amount <> sum(lines)."),
  note_text_2, N("Blank=blank is OK; blank vs nonblank is mismatch."),

  inv_id, $A5,

  inv_ids, AP_INVOICES_INTERFACE!$A$5:$A$1494,
  inv_amts, AP_INVOICES_INTERFACE!$E$5:$E$1494,
  header_amt, XLOOKUP(inv_id, inv_ids, inv_amts, ""),

  line_ids, $A$5:$A$1489,
  line_amts, $D$5:$D$1489,
  has_nonblank_amt, COUNTIFS(line_ids, inv_id, line_amts, "<>")>0,
  lines_total, IF(has_nonblank_amt, SUMIFS(line_amts, line_ids, inv_id), ""),

  header_blank, LEN(header_amt&"")=0,
  lines_blank, LEN(lines_total&"")=0,

  mismatch,
    IF(
      AND(header_blank, lines_blank),
      FALSE,
      IF(OR(header_blank, lines_blank), TRUE, header_amt<>lines_total)
    ),

  AND(LEN(inv_id&"")>0, mismatch)
)
```

### 'Defaults' Sheet

Named Values:

- Table Name: `tbl_defaults_invoices`

| Header Name           | Cell Reference |
| --------------------- | -------------- |
| Business Unit         | A1             |
| Source Options        | B1             |
| Invoice Date          | C1             |
| Supplier Site         | D1             |
| Invoice Currency      | E1             |
| Payment Currency      | F1             |
| Import Set Date       | G1             |
| Import Set Initials   | H1             |
| Import Set Suffix     | I1             |
| Invoice Type          | J1             |
| Legal Entity          | K1             |
| Payment Terms         | L1             |
| Invoice Received Date | M1             |
| Accounting Date       | N1             |
| Payment Method        | O1             |
| Pay Alone             | P1             |

---

Named Values:

- Table Name: `tbl_defaults_invoice_lines`

| Header Name              | Cell Reference |
| ------------------------ | -------------- |
| Line Type                | R1             |
| Distribution             | S1             |
| Date                     | T1             |
| Attribute                | U1             |
| Task Number              | V1             |
| Expenditure Type         | W1             |
| Expenditure Organization | X1             |

### Workbook Named Ranges

| Name            | Comment                                                                                                                        | Refers To                                         | Applies To Headers                           |
| :-------------- | :----------------------------------------------------------------------------------------------------------------------------- | :------------------------------------------------ | :------------------------------------------- |
| `curMonthEnd`   | Last day of current month (computed once).                                                                                     | `=tbl_defaults_month_info[[#Data],[Month End]]`   | `Month End` (`tbl_defaults_month_info`)      |
| `curMonthStart` | First day of current month (computed once).                                                                                    | `=tbl_defaults_month_info[[#Data],[Month Start]]` | `Month Start` (`tbl_defaults_month_info`)    |
| `rngInvAmt`     | Invoice Amount column in invoices table. Used for header-vs-lines amount reconciliation CF.                                    | `=tbl_invoices[[#Data],[*Invoice Amount]]`        | `*Invoice Amount` (`AP_INVOICES_INTERFACE`)  |
| `rngInvID`      | Invoice IDs in the invoices table data area (auto-resizes with the table). Use to avoid fixed ranges / full-column refs in CF. | `=tbl_invoices[[#Data],[*Invoice ID]]`            | `*Invoice ID` (`AP_INVOICES_INTERFACE`)      |
| `rngLineAmt`    | Amount column in invoice lines table. Used to SUMIFS line totals per invoice.                                                  | `="tbl_invoice_lines[[#Data],[*Amount]]"`         | `*Amount` (`AP_INVOICE_LINES_INTERFACE`)     |
| `rngLineInvID`  | Invoice ID column in invoice lines table. Used for joins (COUNTIFS/SUMIFS) and line continuity checks.                         | `=tbl_invoice_lines[[#Data],[*Invoice ID]]`       | `*Invoice ID` (`AP_INVOICE_LINES_INTERFACE`) |
| `rngLineNo`     | Line Number column in invoice lines table. Used for per-invoice 1..N continuity and duplicate pair checks.                     | `=tbl_invoice_lines[[#Data],[Line Number]]`       | `Line Number` (`AP_INVOICE_LINES_INTERFACE`) |
