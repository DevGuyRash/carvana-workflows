pub(super) const INVOICE_VALUE_FORMULA: &str = r#"=LET(_c,MATCH("Oracle Invoice Number",$1:$1,0),_v,INDEX($A:$XFD,ROW(),_c),NOT(OR(ISBLANK(_v),LEN(TRIM(_v))=0,LOWER(TRIM(_v))="n/a",_v="-",_v="—")))"#;

pub(super) const STATUS_NOT_FINISHED: &str = "NOT FINISHED";
pub(super) const TRACKING_ID_DEFAULT: &str = "0000000001";

pub(super) const REQUEST_INVOICE: &str = "Invoice";
pub(super) const REQUEST_CHECK_REQUEST: &str = "Check Request";
pub(super) const REQUEST_GOODWILL: &str = "Goodwill";
pub(super) const REQUEST_TITLE_REG: &str = "Title & Reg";
pub(super) const REQUEST_WIRE_TRANSFER: &str = "Wire Transfer";

pub(super) const MAIL_MISC: &str = "MISC";
pub(super) const MAIL_INHOUSE: &str = "INHOUSE";
pub(super) const MAIL_HUB_CHECKS: &str = "HUB CHECKS";

pub fn ap_output_columns() -> Vec<String> {
    vec![
        "Status",
        "Invoice Exists",
        "Oracle Error",
        "Auto Close",
        "Tracking ID",
        "Key",
        "Vendor",
        "Oracle Invoice Number",
        "Request Type",
        "Mailing Instructions",
        "Reference",
        "Invoice",
        "StockNumber",
        "VIN",
        "PID",
        "Final Amount",
        "Address",
        "Street Address",
        "Apt/Suite",
        "City",
        "State",
        "Zip",
        "Amount to be paid",
        "Fee Amount",
        "Tax Amount",
        "Description",
        "AP Department",
        "AP Description",
        "AP Request Type",
    ]
    .into_iter()
    .map(|s| s.to_string())
    .collect()
}
