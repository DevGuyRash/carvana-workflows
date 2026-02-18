=LET(
    invoice_id, [@[*Invoice ID]],
    default_dist, tbl_defaults_invoice_lines[Distribution Combination],
    IF(invoice_id <> "", INDEX(default_dist, 1), "")
)
