use regex::Regex;

use super::constants::{
    MAIL_HUB_CHECKS, MAIL_INHOUSE, MAIL_MISC, REQUEST_CHECK_REQUEST, REQUEST_INVOICE,
    REQUEST_WIRE_TRANSFER,
};

pub(super) struct VendorRule {
    pub(super) pattern: Option<Regex>,
    pub(super) vendor: Option<&'static str>,
    pub(super) request_type: Option<&'static str>,
    pub(super) mailing: Option<&'static str>,
    pub(super) auto_close: bool,
    pub(super) address_override: Option<&'static str>,
    pub(super) exclude: Option<Regex>,
}

pub(super) fn vendor_rules() -> Vec<VendorRule> {
    let mut rules = Vec::new();
    macro_rules! rule {
        ($re:expr, $vendor:expr, $rt:expr, $mail:expr, $auto:expr, $addr:expr) => {{
            VendorRule {
                pattern: Regex::new($re).ok(),
                vendor: $vendor,
                request_type: $rt,
                mailing: $mail,
                auto_close: $auto,
                address_override: $addr,
                exclude: None,
            }
        }};
        ($re:expr, $vendor:expr, $rt:expr, $mail:expr, $auto:expr, $addr:expr, $exclude:expr) => {{
            VendorRule {
                pattern: Regex::new($re).ok(),
                vendor: $vendor,
                request_type: $rt,
                mailing: $mail,
                auto_close: $auto,
                address_override: $addr,
                exclude: Regex::new($exclude).ok(),
            }
        }};
    }

    include!("vendor_rules_rules.inc");
    rules
}

pub(super) fn apply_vendor_rule(output: &mut [String], rule: &VendorRule) {
    if let Some(vendor) = rule.vendor {
        output[6] = vendor.to_string();
    }
    if let Some(request_type) = rule.request_type {
        output[8] = request_type.to_string();
    }
    if let Some(mailing) = rule.mailing {
        output[9] = mailing.to_string();
    }
    if rule.auto_close {
        output[3] = "TRUE".to_string();
    }
    if let Some(addr) = rule.address_override {
        output[16] = addr.to_string();
    }
}
