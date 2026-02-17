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

#### AP_INVOICES_INTERFACE Formula Source Mapping (`excel/tr_upload_sheet/invoices`)

Use the formula in each `.fx` file in the first data row (Row 5) of the mapped column; Excel table fill should propagate to the rest of the column.

| Header Name      | Target Cell | Formula File Path                                                          |
| :--------------- | :---------- | :------------------------------------------------------------------------- |
| \*Invoice Number | D5          | `excel/tr_upload_sheet/invoices/invoice_number_stock_or_date_increment.fx` |
| Import Set       | M5          | `excel/tr_upload_sheet/invoices/dated_initialed_uuid.fx`                   |

#### AP_INVOICES_INTERFACE Conditional Formatting Rules (Summary)

| Rule ID   | Applies To Range (cell refs) | Applies To Range (table mapping, recommended) | Applies To Headers                              | Rule Type        |
| :-------- | :--------------------------- | :-------------------------------------------- | :---------------------------------------------- | :--------------- |
| INV-CF-01 | `$A$5:$DZ$9`                | `tbl_invoices[#Data]`                         | All headers in `AP_INVOICES_INTERFACE` (`A:DZ`) | Formula          |
| INV-CF-02 | `$X$5:$X$9`                 | `tbl_invoices[Accounting Date]`               | Accounting Date                                 | Formula          |
| INV-CF-03 | `$W$5:$W$9`                 | `tbl_invoices[Invoice Received Date]`         | Invoice Received Date                           | Formula          |
| INV-CF-04 | `$F$5:$F$9`                 | `tbl_invoices[*Invoice Date]`                 | \*Invoice Date                                  | Formula          |
| INV-CF-05 | `$AA$5:$AA$9`               | `tbl_invoices[Pay Alone]`                     | Pay Alone                                       | Formula          |
| INV-CF-06 | `$Y$5:$Y$9`                 | `tbl_invoices[Payment Method]`                | Payment Method                                  | Formula          |
| INV-CF-07 | `$T$5:$T$9`                 | `tbl_invoices[*Payment Terms]`                | \*Payment Terms                                 | Formula          |
| INV-CF-08 | `$M$5:$M$9`                 | `tbl_invoices[Import Set]`                    | Import Set                                      | Duplicate values |
| INV-CF-09 | `$D$5:$D$9`                 | `tbl_invoices[*Invoice Number]`               | \*Invoice Number                                | Duplicate values |
| INV-CF-10 | `$A$5:$A$9`                 | `tbl_invoices[*Invoice ID]`                   | \*Invoice ID                                    | Formula          |
| INV-CF-11 | `$E$5:$E$9`                 | `tbl_invoices[*Invoice Amount]`               | \*Invoice Amount                                | Formula          |

Use the table-mapping `Applies To` references in Excel for production; the fixed `$...$5:$...$9` ranges are small-sheet examples.

#### AP_INVOICES_INTERFACE Conditional Formatting Formulas (Formatted)

##### INV-CF-01

Description: Flags unusually large invoice amounts (100,000 or greater).

```excel
=AND(
  $E5>=100000,
  $E5<>""
)
```

##### INV-CF-02

Description: Flags invalid Accounting Date values (blank, non-date, time component, or outside current month).

```excel
=cf_BadMonthDate($X5)
```

##### INV-CF-03

Description: Flags invalid Invoice Received Date values (blank, non-date, time component, or outside current month).

```excel
=cf_BadMonthDate($W5)
```

##### INV-CF-04

Description: Flags invalid Invoice Date values (blank, non-date, time component, or outside current month).

```excel
=cf_BadMonthDate($F5)
```

##### INV-CF-05

Description: Ensures Pay Alone is either set with Payment Terms and Payment Method, or blank with both blank.

```excel
=OR(
  AND($AA5="", $T5<>"", $Y5<>""),
  AND($AA5<>"", OR($T5="", $Y5=""))
)
```

##### INV-CF-06

Description: Ensures Payment Method is present only when Payment Terms and Pay Alone are both present.

```excel
=OR(
  AND($Y5="", $T5<>"", $AA5<>""),
  AND($Y5<>"", OR($T5="", $AA5=""))
)
```

##### INV-CF-07

Description: Ensures Payment Terms is present only when Payment Method and Pay Alone are both present.

```excel
=OR(
  AND($T5="", $Y5<>"", $AA5<>""),
  AND($T5<>"", OR($Y5="", $AA5=""))
)
```

##### INV-CF-08

Description: Highlights duplicate Import Set values.

```text
Duplicate values
```

##### INV-CF-09

Description: Highlights duplicate Invoice Number values.

```text
Duplicate values
```

##### INV-CF-10

Description: Flags invalid or non-continuous Invoice ID values based on the first missing ID from the lowest present ID.

```excel
=LET(
  inv_raw, $A5,

  inv_blank, LEN(inv_raw&"")=0,
  inv_num, IFERROR(--inv_raw, 0),
  inv_is_pos_int, AND(inv_num>=1, inv_num=INT(inv_num)),

  IF(
    inv_blank,
    FALSE,
    IF(
      inv_is_pos_int,
      inv_num>=cfInv_FirstMissingID,
      TRUE
    )
  )
)
```

##### INV-CF-11

Description: Flags invoice headers where `*Invoice Amount` does not match the sum of related line amounts.

```excel
=LET(
  inv_id, $A5,
  header_amt, $E5,

  lines_total,
    XLOOKUP(
      inv_id,
      INDEX(cfLine_TotalsByInvID,,1),
      INDEX(cfLine_TotalsByInvID,,2),
      ""
    ),

  header_blank, LEN(header_amt&"")=0,
  lines_blank,  LEN(lines_total&"")=0,

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

#### AP_INVOICE_LINES_INTERFACE Formula Source Mapping (`excel/tr_upload_sheet/invoice_lines`)

Use the formula in each `.fx` file in the first data row (Row 5) of the mapped column; Excel table fill should propagate to the rest of the column.

| Header Name    | Target Cell | Formula File Path                                             |
| :------------- | :---------- | :------------------------------------------------------------ |
| \*Invoice ID   | A5          | `excel/tr_upload_sheet/invoice_lines/invoice_id_generator.fx` |
| Attribute 6    | BT5         | `excel/tr_upload_sheet/invoice_lines/attribute_6_pid.fx`      |
| Project Number | DX5         | `excel/tr_upload_sheet/invoice_lines/project_number_stock.fx` |

#### AP_INVOICE_LINES_INTERFACE Conditional Formatting Rules (Summary)

| Rule ID    | Applies To Range (cell refs) | Applies To Range (table mapping, recommended) | Applies To Headers        | Rule Type        |
| :--------- | :--------------------------- | :-------------------------------------------- | :------------------------ | :--------------- |
| LINE-CF-01 | `$M$5:$M$9`                 | `tbl_invoice_lines[Item Description]`         | Item Description          | Formula          |
| LINE-CF-02 | `$X$5:$X$9`                 | `tbl_invoice_lines[Accounting Date]`          | Accounting Date           | Formula          |
| LINE-CF-03 | `$BN$5:$BN$9`               | `tbl_invoice_lines[Attribute Category]`       | Attribute Category        | Formula          |
| LINE-CF-04 | `$DY$5:$DY$9`               | `tbl_invoice_lines[Task Number]`              | Task Number               | Formula          |
| LINE-CF-05 | `$DZ$5:$DZ$9`               | `tbl_invoice_lines[Expenditure Type]`         | Expenditure Type          | Formula          |
| LINE-CF-06 | `$EA$5:$EA$9`               | `tbl_invoice_lines[Expenditure Organization]` | Expenditure Organization  | Formula          |
| LINE-CF-07 | `$BT$5:$BT$9`               | `tbl_invoice_lines[Attribute 6]`              | Attribute 6               | Formula          |
| LINE-CF-08 | `$BT$5:$BT$9`               | `tbl_invoice_lines[Attribute 6]`              | Attribute 6               | Duplicate Values |
| LINE-CF-09 | `$DX$5:$DX$9`               | `tbl_invoice_lines[Project Number]`           | Project Number            | Formula          |
| LINE-CF-10 | `$DX$5:$DX$9`               | `tbl_invoice_lines[Project Number]`           | Project Number            | Duplicate Values |
| LINE-CF-11 | `$A$5:$A$9`                 | `tbl_invoice_lines[*Invoice ID]`              | \*Invoice ID              | Formula          |
| LINE-CF-12 | `$A$5:$B$9`                 | `tbl_invoice_lines[[*Invoice ID]:[Line Number]]` | \*Invoice ID, Line Number | Formula          |
| LINE-CF-13 | `$A$5:$B$9`                 | `tbl_invoice_lines[[*Invoice ID]:[Line Number]]` | \*Invoice ID, Line Number | Formula          |
| LINE-CF-14 | `$A$5:$A$9`                 | `tbl_invoice_lines[*Invoice ID]`              | \*Invoice ID              | Formula          |
| LINE-CF-15 | `$A$5:$A$9,$D$5:$D$9`       | `tbl_invoice_lines[*Invoice ID],tbl_invoice_lines[*Amount]` | \*Invoice ID, \*Amount    | Formula          |

Use the table-mapping `Applies To` references in Excel for production; the fixed `$...$5:$...$9` ranges are small-sheet examples.

#### AP_INVOICE_LINES_INTERFACE Conditional Formatting Formulas (Formatted)

##### LINE-CF-01

Description: Flags rows where Item Description does not match Description.

```excel
=$M5<>$H5
```

##### LINE-CF-02

Description: Flags invalid Accounting Date values (blank, non-date, time component, or outside current month).

```excel
=cf_BadMonthDate($X5)
```

##### LINE-CF-03

Description: Ensures Attribute Category presence matches Expenditure Organization presence.

```excel
=($EA5="")<>($BN5="")
```

##### LINE-CF-04

Description: Ensures Task Number presence matches Expenditure Organization presence.

```excel
=($EA5="")<>($DY5="")
```

##### LINE-CF-05

Description: Ensures Expenditure Type presence matches Expenditure Organization presence.

```excel
=($EA5="")<>($DZ5="")
```

##### LINE-CF-06

Description: Requires all related project/cost fields when Expenditure Organization is populated.

```excel
=AND(
  $EA5<>"",
  OR($BN5="", $BT5="", $DX5="", $DY5="", $DZ5="")
)
```

##### LINE-CF-07

Description: Ensures Attribute 6 presence matches Expenditure Organization presence.

```excel
=($EA5="")<>($BT5="")
```

##### LINE-CF-08

Description: Highlights duplicate Attribute 6 values.

```text
Duplicate Values
```

##### LINE-CF-09

Description: Ensures Project Number presence matches Expenditure Organization presence.

```excel
=($EA5="")<>($DX5="")
```

##### LINE-CF-10

Description: Highlights duplicate Project Number values.

```text
Duplicate Values
```

##### LINE-CF-11

Description: Flags invalid or non-continuous Invoice ID values based on the first missing ID from the lowest present ID in invoice lines.

```excel
=LET(
  inv_raw, $A5,

  inv_blank, LEN(inv_raw&"")=0,
  inv_num, IFERROR(--inv_raw, 0),
  inv_is_pos_int, AND(inv_num>=1, inv_num=INT(inv_num)),

  IF(
    inv_blank,
    FALSE,
    IF(
      inv_is_pos_int,
      inv_num>=cfLine_FirstMissingInvID,
      TRUE
    )
  )
)
```

##### LINE-CF-12

Description: Flags invalid or non-continuous Line Number values within each Invoice ID group.

```excel
=LET(
  inv_id, $A5,
  ln_raw, $B5,

  inv_blank, LEN(inv_id&"")=0,

  ln_num, IFERROR(--ln_raw, 0),
  ln_is_pos_int, AND(ln_num>=1, ln_num=INT(ln_num)),

  miss_ln,
    XLOOKUP(
      inv_id,
      INDEX(cfLine_FirstMissingLineNoByInvID,,1),
      INDEX(cfLine_FirstMissingLineNoByInvID,,2),
      1
    ),

  IF(inv_blank, FALSE, IF(ln_is_pos_int, ln_num>=miss_ln, TRUE))
)
```

##### LINE-CF-13

Description: Flags duplicate `(Invoice ID, Line Number)` pairs.

```excel
=LET(
  inv_id, $A5,
  line_no, $B5,

  inv_id_rng, rngLineInvID,
  line_no_rng, rngLineNo,

  inv_blank, LEN(inv_id&"")=0,
  line_blank, LEN(line_no&"")=0,

  occurrences, COUNTIFS(inv_id_rng, inv_id, line_no_rng, line_no),

  AND(NOT(inv_blank), NOT(line_blank), occurrences>1)
)
```

##### LINE-CF-14

Description: Flags line rows whose Invoice ID is blank or missing from the invoice header table.

```excel
=OR(
  $A5="",
  COUNTIF(rngInvID, $A5)=0
)
```

##### LINE-CF-15

Description: Flags invoice line rows where header amount and summed line amounts are inconsistent (applied to both `*Invoice ID` and `*Amount` cells).

```excel
=LET(
  inv_id, $A5,

  header_amt,
    XLOOKUP(inv_id, rngInvID, rngInvAmt, ""),

  lines_total,
    XLOOKUP(
      inv_id,
      INDEX(cfLine_TotalsByInvID,,1),
      INDEX(cfLine_TotalsByInvID,,2),
      ""
    ),

  header_blank, LEN(header_amt&"")=0,
  lines_blank,  LEN(lines_total&"")=0,

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
| `rngLineAmt`    | Amount column in invoice lines table. Used to SUMIFS line totals per invoice.                                                  | `=tbl_invoice_lines[[#Data],[*Amount]]`           | `*Amount` (`AP_INVOICE_LINES_INTERFACE`)     |
| `rngLineInvID`  | Invoice ID column in invoice lines table. Used for joins (COUNTIFS/SUMIFS) and line continuity checks.                         | `=tbl_invoice_lines[[#Data],[*Invoice ID]]`       | `*Invoice ID` (`AP_INVOICE_LINES_INTERFACE`) |
| `rngLineNo`     | Line Number column in invoice lines table. Used for per-invoice 1..N continuity and duplicate pair checks.                     | `=tbl_invoice_lines[[#Data],[Line Number]]`       | `Line Number` (`AP_INVOICE_LINES_INTERFACE`) |

### Workbook Named Formulas (Conditional Formatting Optimization)

Add these in Name Manager as workbook-level named formulas.

| Name                               | Comment                                                      | Refers To                                                                                                                                                                                                                           |
| :--------------------------------- | :----------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `cf_BadMonthDate`                  | Reusable date validation for current-month-only date fields. | `=LAMBDA(d,LET(v,d,OR(v="",NOT(ISNUMBER(v)),INT(v)<>v,v<curMonthStart,v>curMonthEnd)))`                                                                                                                                             |
| `cf_FirstMissingPosInt`            | Returns smallest missing positive integer in a range (expected to start at 1). | `=LAMBDA(rng,LET(nums,IFERROR(--rng,0),pos,FILTER(nums,(nums>=1)*(nums=INT(nums)),0),uniq,SORT(UNIQUE(pos)),n,ROWS(uniq),expected,SEQUENCE(n),mismatchPos,XMATCH(FALSE,uniq=expected,0),IFERROR(INDEX(expected,mismatchPos),n+1)))` |
| `cf_FirstMissingPosIntFromMin`     | Returns smallest missing positive integer starting from the range minimum.       | `=LAMBDA(rng,LET(nums,IFERROR(--rng,0),pos,FILTER(nums,(nums>=1)*(nums=INT(nums)),0),uniq,SORT(UNIQUE(pos)),n,ROWS(uniq),start,INDEX(uniq,1),expected,SEQUENCE(n,,start),mismatchPos,XMATCH(FALSE,uniq=expected,0),IFERROR(INDEX(expected,mismatchPos),start+n)))` |
| `cfInv_FirstMissingID`             | Smallest missing invoice ID in `AP_INVOICES_INTERFACE` from the lowest present ID.      | `=cf_FirstMissingPosIntFromMin(rngInvID)`                                                                                                                                                                                          |
| `cfLine_FirstMissingInvID`         | Smallest missing invoice ID in `AP_INVOICE_LINES_INTERFACE` from the lowest present ID. | `=cf_FirstMissingPosIntFromMin(rngLineInvID)`                                                                                                                                                                                      |
| `cfLine_TotalsByInvID`             | 2-column spill: `[Invoice ID, LinesTotalOrBlank]`.           | `=IFERROR(LET(ids,rngLineInvID,amts,rngLineAmt,uniq,UNIQUE(FILTER(ids,ids<>"")),cnt,COUNTIFS(ids,uniq,amts,"<>"),sum,SUMIFS(amts,ids,uniq),tot,IF(cnt>0,sum,""),HSTACK(uniq,tot)),HSTACK("",""))`                                   |
| `cfLine_FirstMissingLineNoByInvID` | 2-column spill: `[Invoice ID, FirstMissingLineNumber]`.      | `=IFERROR(LET(ids,rngLineInvID,lns,rngLineNo,invList,UNIQUE(FILTER(ids,ids<>"")),miss,MAP(invList,LAMBDA(i,cf_FirstMissingPosInt(FILTER(lns,ids=i,0)))),HSTACK(invList,miss)),HSTACK("",1))`                                        |

Notes:

- `rngLineAmt` must refer to a real range: `=tbl_invoice_lines[[#Data],[*Amount]]`.
- Do not wrap table references in quotes in Name Manager.
- Prefer CF `Applies To` table ranges over full columns or static row ranges.
