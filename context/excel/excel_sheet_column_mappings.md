## T&R Upload Template

### Notes

- All headers currently exist on Row 4 and real data starts on Row 5

### 'AP_INVOICES_INTERFACE' Sheet

Named Values:

- Table Name: `tbl_invoices`

| Header Name           | Cell Reference |
| :-------------------- | :------------- |
| *Invoice ID           | A4             |
| *Business Unit        | B4             |
| *Source               | C4             |
| *Invoice Number       | D4             |
| *Invoice Amount       | E4             |
| *Invoice Date         | F4             |
| **Supplier Number     | H4             |
| *Supplier Site        | I4             |
| Invoice Currency      | J4             |
| Payment Currency      | K4             |
| Description           | L4             |
| Import Set            | M4             |
| *Invoice Type         | N4             |
| Legal Entity          | O4             |
| *Payment Terms        | T4             |
| Invoice Received Date | W4             |
| Accounting Date       | X4             |
| Payment Method        | Y4             |
| Pay Alone             | AA4            |

### 'AP_INVOICE_LINES_INTERFACE' Sheet

Named Values:

- Table Name: `tbl_invoice_lines`

| Header Name              | Cell Reference |
| :----------------------- | :------------- |
| *Invoice ID              | A4             |
| *Line Number             | B4             |
| *Line Type               | C4             |
| *Amount                  | D4             |
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
