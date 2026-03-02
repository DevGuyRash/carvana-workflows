pub fn transform_filter_table_aoa(
    captured_table: Vec<Vec<String>>,
    today_mmddyyyy: &str,
) -> (Vec<String>, Vec<Vec<String>>) {
    let columns = ap_output_columns();
    let rules = vendor_rules();
    let mut out_rows: Vec<Vec<String>> = Vec::new();

    if captured_table.is_empty() {
        return (columns, out_rows);
    }
    let header_row = captured_table.first().cloned().unwrap_or_default();
    let mut mp: BTreeMap<String, usize> = BTreeMap::new();
    for (idx, header) in header_row.iter().enumerate() {
        mp.insert(normalize_header(header), idx);
    }
    let ix = |names: &[&str]| -> Option<usize> {
        names
            .iter()
            .map(|name| normalize_header(name))
            .find_map(|key| mp.get(&key).copied())
    };
    let ix_exact = |name: &str| -> Option<usize> {
        header_row.iter().position(|header| {
            normalize_whitespace(header).eq_ignore_ascii_case(&normalize_whitespace(name))
        })
    };
    let val = |row: &[String], idx: Option<usize>| -> String {
        idx.and_then(|i| row.get(i))
            .map(|text| normalize_whitespace(text))
            .unwrap_or_default()
    };

    let vin_capture = r"([A-HJ-NPR-Z0-9]{11,17})\b";
    let stock_capture = r"((?:[A-Z0-9&]{2,8}-)?\d{7,12}(?:-(?:[A-Z]{2,8}|\d{1,4}))?)\b";
    let pid_capture = r"(\d{3,})\b";
    let vin_strict = Regex::new(r"^[A-HJ-NPR-Z0-9]{11,17}$").ok();
    let stc_re = Regex::new(r"(?i)(^|\b)stc(\b|$)").ok();
    let descriptor_re = Regex::new(r"(?i)(?:^|[^A-Z0-9&])((?:[A-Z0-9&]{2,8}-)?\d{7,12})(?:-([A-Z]{2,8}|\d{1,4}))?-([A-HJ-NPR-Z0-9]{11,17})(?:-(\d{3,}))?(?:-[A-Z0-9&]{2,30})*(?:$|[^A-Z0-9&])").ok();
    let stock_split_re =
        Regex::new(r"(?i)^((?:[A-Z0-9&]{2,8}-)?\d{7,12})(?:-([A-Z]{2,8}|\d{1,4}))?$").ok();
    let stock_prefix_strip_re = Regex::new(r"^[A-Z0-9&]{2,8}-").ok();
    let good_re = Regex::new(r"(?i)good\s*will|goodwill").ok();
    let hub_re = Regex::new(r"(?i)hub\s*checks").ok();
    let logistics_re = Regex::new(r"(?i)logistics").ok();
    let finance_ops_re = Regex::new(r"(?i)finance\s*operations").ok();
    let title_reg_re =
        Regex::new(r"(?i)\b(title\s*&?\s*reg(istration)?|t\s*&\s*r|t/r|title\s*and\s*registration|title&registration)\b").ok();
    let inhouse_re = Regex::new(r"(?i)inhouse").ok();
    let misc_re = Regex::new(r"(?i)misc").ok();

    let i_oe = ix(&["Oracle Error"]);
    let i_k = ix(&["Key"]);
    let i_v = ix(&["Vendor"]);
    let i_oin = ix(&[
        "Oracle Invoice Number",
        "Oracle invoice #",
        "Oracle Invoice #",
    ]);
    let i_mi = ix(&["Mailing Instructions", "Mail Instructions", "Mailing"]);
    let i_adr = ix(&[
        "Address",
        "Mailing Address",
        "Payee Address",
        "Remit Address",
        "Remittance Address",
        "Mail To Address",
        "Mail-To Address",
    ]);
    let i_str = ix(&[
        "Street Address",
        "Street",
        "Address Line 1",
        "Address1",
        "Address 1",
        "Address Line1",
        "Line 1",
        "Line1",
    ]);
    let i_apt = ix(&[
        "Apt/Suite",
        "Apt",
        "Suite",
        "Unit",
        "Address Line 2",
        "Address2",
        "Address 2",
        "Address Line2",
        "Line 2",
        "Line2",
    ]);
    let i_city = ix(&["City", "Town"]);
    let i_state = ix(&["State", "Province", "Region"]);
    let i_zip = ix(&[
        "Zip",
        "Zip Code",
        "ZipCode",
        "Postal Code",
        "PostalCode",
        "Post Code",
        "PostCode",
    ]);
    let i_cra = ix(&["Check Request Amount", "Check Request Amt"]);
    let i_amt = ix(&[
        "Amount to be paid",
        "Amount to be Paid",
        "Amount Payable",
        "Amount",
    ]);
    let i_fee = ix(&["Fee Amount", "Fees"]);
    let i_tax = ix(&["Tax Amount", "Taxes", "Tax"]);
    let i_sn1 = ix_exact("StockNumber");
    let i_sn2 = ix_exact("Stock Number");
    let i_vin = ix(&["VIN", "VIN Number", "VIN Numbers"]);
    let i_pid = ix(&["PID", "PID Number"]);
    let i_d = ix(&["Description", "Details", "Issue Details"]);
    let i_apd = ix(&["AP Department", "AP Dept", "Department", "AP Department "]);
    let i_apx = ix(&[
        "AP Description",
        "AP Desc",
        "AP-Description",
        "AP description",
        "A/P Description",
    ]);
    let i_aptype = ix(&[
        "AP Request Type",
        "AP Type",
        "AP RequestType",
        "Request Type (AP)",
    ]);
    let i_sum = ix(&["Summary", "Issue Summary", "Ticket Summary", "Title"]);

    for row in captured_table.into_iter().skip(1) {
        let mut out = vec![String::new(); columns.len()];
        out[0] = STATUS_NOT_FINISHED.to_string();
        out[3] = "FALSE".to_string();
        out[4] = TRACKING_ID_DEFAULT.to_string();
        let oracle_invoice = sid(&val(&row, i_oin));
        out[7] = oracle_invoice.clone();
        out[1] = if is_blank(&oracle_invoice) {
            "False"
        } else {
            "True"
        }
        .to_string();
        let oracle_error = val(&row, i_oe);
        out[2] = if matches!(oracle_error.trim().to_lowercase().as_str(), "yes" | "true") {
            "TRUE".to_string()
        } else {
            "FALSE".to_string()
        };
        let key = val(&row, i_k);
        out[5] = hyperlink_formula(&key);
        out[6] = val(&row, i_v);
        out[9] = val(&row, i_mi);
        out[16] = val(&row, i_adr);
        let raw_street = val(&row, i_str);
        let raw_apt = val(&row, i_apt);
        let raw_city = val(&row, i_city);
        let raw_state = val(&row, i_state);
        let raw_zip = val(&row, i_zip);

        let fee_raw = val(&row, i_fee);
        let tax_raw = val(&row, i_tax);
        out[23] = fee_raw.clone();
        out[24] = tax_raw.clone();
        out[25] = val(&row, i_d);
        out[26] = val(&row, i_apd);
        out[27] = val(&row, i_apx);
        out[28] = val(&row, i_aptype);

        let summary = val(&row, i_sum);
        let txt = row
            .iter()
            .map(|v| normalize_whitespace(v))
            .collect::<Vec<_>>()
            .join("\n");

        let mut stock = sid(&val(&row, i_sn1));
        if is_blank(&stock) {
            stock = sid(&val(&row, i_sn2));
        }
        let mut vin = sid(&val(&row, i_vin));
        let mut pid = sid(&val(&row, i_pid));
        if is_blank(&stock) {
            stock = find_value_near_label(&txt, "stock", stock_capture);
        }
        if is_blank(&vin) {
            vin = find_value_near_label(&txt, "vin", vin_capture);
        }
        if is_blank(&pid) {
            pid = find_value_near_label(&txt, "pid", pid_capture);
        }
        let descriptor_input = normalize_dash_spaces(&txt).to_uppercase();
        if let Some(caps) = descriptor_re
            .as_ref()
            .and_then(|re| re.captures(&descriptor_input))
        {
            if is_blank(&stock) {
                let base = caps.get(1).map(|m| m.as_str()).unwrap_or_default();
                let tag = caps.get(2).map(|m| m.as_str()).unwrap_or_default();
                stock = if tag.is_empty() {
                    base.to_string()
                } else {
                    format!("{base}-{tag}")
                };
            }
            if is_blank(&vin) {
                vin = caps
                    .get(3)
                    .map(|m| m.as_str().to_string())
                    .unwrap_or_default();
            }
            if is_blank(&pid) {
                pid = caps
                    .get(4)
                    .map(|m| m.as_str().to_string())
                    .unwrap_or_default();
            }
        }
        stock = sid(&stock);
        vin = sid(&vin);
        pid = sid(&pid);
        if !stock.is_empty() && vin_strict.as_ref().is_some_and(|re| re.is_match(&stock)) {
            stock.clear();
        }
        let mut stock_for_invoice = stock.clone();
        if let Some(caps) = stock_split_re.as_ref().and_then(|re| re.captures(&stock)) {
            let base = sid(caps.get(1).map(|m| m.as_str()).unwrap_or_default()).to_uppercase();
            let tag = sid(caps.get(2).map(|m| m.as_str()).unwrap_or_default()).to_uppercase();
            stock = if tag.is_empty() {
                base.clone()
            } else {
                format!("{base}-{tag}")
            };
            let numeric = stock_prefix_strip_re
                .as_ref()
                .map(|re| re.replace(&base, "").to_string())
                .unwrap_or(base.clone());
            stock_for_invoice = if tag.is_empty() {
                numeric
            } else {
                format!("{numeric}-{tag}")
            };
        }

        let any_id = !is_blank(&stock) || !is_blank(&vin) || !is_blank(&pid);
        let stock_d = if any_id {
            if is_blank(&stock) {
                "STOCK".to_string()
            } else {
                stock.clone()
            }
        } else {
            String::new()
        };
        let vin_d = if any_id {
            if is_blank(&vin) {
                "VIN".to_string()
            } else {
                vin.clone()
            }
        } else {
            String::new()
        };
        let pid_d = if any_id {
            if is_blank(&pid) {
                "PID".to_string()
            } else {
                pid.clone()
            }
        } else {
            String::new()
        };

        out[12] = stock_d.clone();
        out[13] = vin_d.clone();
        out[14] = pid_d.clone();
        out[10] = if any_id {
            format!("HUB-{stock_d}-{vin_d}-{pid_d}")
        } else {
            String::new()
        };

        out[11] = format!(
            "{}-TR",
            if !is_blank(&stock_for_invoice) {
                stock_for_invoice.clone()
            } else {
                today_mmddyyyy.to_string()
            }
        );

        let cra = val(&row, i_cra);
        let amt = val(&row, i_amt);
        let mut final_amount = if !is_blank(&cra) {
            cra
        } else if !is_blank(&amt) {
            amt
        } else {
            let fee = parse_money(&fee_raw);
            let tax = parse_money(&tax_raw);
            if fee.is_some() || tax.is_some() {
                let sum = fee.unwrap_or(0.0) + tax.unwrap_or(0.0);
                sum.to_string()
            } else {
                String::new()
            }
        };
        if is_blank(&final_amount) {
            final_amount = "0".to_string();
        }
        out[15] = final_amount.clone();
        out[22] = final_amount;

        let compact_invoice = oracle_invoice
            .replace(char::is_whitespace, "")
            .to_uppercase();
        if compact_invoice.ends_with("CR") {
            out[8] = REQUEST_CHECK_REQUEST.to_string();
        } else if compact_invoice.ends_with("GDW") {
            out[8] = REQUEST_GOODWILL.to_string();
        } else if compact_invoice.ends_with("TR") {
            out[8] = REQUEST_TITLE_REG.to_string();
        }

        if out[6].is_empty() && !summary.is_empty() {
            out[6] = summary;
        }

        let good = good_re.as_ref().is_some_and(|re| re.is_match(&txt));
        let hub = hub_re.as_ref().is_some_and(|re| re.is_match(&txt));
        let gdw = compact_invoice.ends_with("GDW");
        let apd = out[26].clone();
        let apx = out[27].clone();
        let apd_apx = format!("{apd} {apx}");

        if !hub && !good && !gdw && logistics_re.as_ref().is_some_and(|re| re.is_match(&apd)) {
            out[8] = REQUEST_CHECK_REQUEST.to_string();
            out[9] = MAIL_INHOUSE.to_string();
        }
        if !hub && !good && !gdw && stc_re.as_ref().is_some_and(|re| re.is_match(&apd_apx)) {
            out[8] = REQUEST_CHECK_REQUEST.to_string();
            out[9] = MAIL_INHOUSE.to_string();
        }
        if stc_re.as_ref().is_some_and(|re| re.is_match(&apd_apx)) && good {
            out[8] = REQUEST_GOODWILL.to_string();
            out[9] = MAIL_INHOUSE.to_string();
        }
        if !hub && !good && !gdw && finance_ops_re.as_ref().is_some_and(|re| re.is_match(&apd)) {
            out[8] = REQUEST_CHECK_REQUEST.to_string();
            out[9] = MAIL_INHOUSE.to_string();
        }
        if title_reg_re.as_ref().is_some_and(|re| re.is_match(&apx)) {
            out[8] = REQUEST_CHECK_REQUEST.to_string();
        }

        for rule in &rules {
            if rule.pattern.as_ref().is_some_and(|re| re.is_match(&txt)) {
                if rule.exclude.as_ref().is_some_and(|ex| ex.is_match(&txt)) {
                    continue;
                }
                apply_vendor_rule(&mut out, rule);
            }
        }

        if out[8] == REQUEST_INVOICE || out[8] == REQUEST_WIRE_TRANSFER {
            out[9] = MAIL_MISC.to_string();
        }

        for rule in &rules {
            if rule.pattern.as_ref().is_some_and(|re| re.is_match(&txt)) {
                if rule.exclude.as_ref().is_some_and(|ex| ex.is_match(&txt)) {
                    continue;
                }
                apply_vendor_rule(&mut out, rule);
            }
        }

        let mi = out[9].clone();
        out[9] = if inhouse_re.as_ref().is_some_and(|re| re.is_match(&mi)) {
            MAIL_INHOUSE.to_string()
        } else if hub_re.as_ref().is_some_and(|re| re.is_match(&mi)) {
            MAIL_HUB_CHECKS.to_string()
        } else if misc_re.as_ref().is_some_and(|re| re.is_match(&mi)) {
            MAIL_MISC.to_string()
        } else {
            mi
        };

        let (full, street, apt, city, state, zip) = parse_address_smart(
            &out[16],
            &raw_street,
            &raw_apt,
            &raw_city,
            &raw_state,
            &raw_zip,
            &txt,
        );
        if !full.is_empty() {
            out[16] = full;
        }
        out[17] = street;
        out[18] = apt;
        out[19] = city;
        out[20] = state;
        out[21] = zip;

        out_rows.push(out);
    }

    out_rows.sort_by(|a, b| {
        for idx in [9usize, 8usize, 1usize, 2usize, 6usize, 5usize] {
            let a_val = a.get(idx).cloned().unwrap_or_default().to_lowercase();
            let b_val = b.get(idx).cloned().unwrap_or_default().to_lowercase();
            if a_val == b_val {
                continue;
            }
            if a_val.is_empty() {
                return std::cmp::Ordering::Greater;
            }
            if b_val.is_empty() {
                return std::cmp::Ordering::Less;
            }
            return a_val.cmp(&b_val);
        }
        std::cmp::Ordering::Equal
    });

    for row in &mut out_rows {
        row[1] = INVOICE_VALUE_FORMULA.to_string();
    }

    (columns, out_rows)
}
