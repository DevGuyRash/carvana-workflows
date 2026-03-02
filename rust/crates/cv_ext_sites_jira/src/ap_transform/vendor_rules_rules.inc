{
    rules.push(rule!(
        r"(?i)notice of lien online application",
        Some("MISSOURI DEPARTMENT OF REVENUE"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)villarreal\s*enterprise\s*group",
        Some("VILLARREAL ENTERPRISE GROUP LLC"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)lyft",
        Some("LYFT, INC"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)waymo",
        Some("WAYMO LLC"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)notarize",
        Some("NOTARIZE INC"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)plate express",
        Some("PLATE EXPRESS"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)scale invoice",
        Some("HARBOR TRUCK STOP INC"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)motor\s*car\s*tag\s*(?:&|and)\s*title",
        Some("MOTOR CAR TAG & TITLE"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)tag\s*agency\s*of\s*pinellas",
        Some("TAG AGENCY PROFESSIONALS"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)edealer\s*services",
        Some("eDealer Services"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)\bvitu\b|vitu llc|vitu,?\s*inc",
        Some("VITU"),
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        true,
        None
    ));
    rules.push(rule!(
        r"(?i)title one",
        Some("Title One"),
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        true,
        None
    ));
    rules.push(rule!(
        r"(?i)omv\s*express|expres+s\s*omv|\[external\](?: *carvana [a-z] #\d+)+",
        Some("Express OMV"),
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        true,
        None
    ));
    rules.push(rule!(
        r"(?i)daily activity summary",
        None,
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        true,
        None
    ));
    rules.push(rule!(
        r"(?i)add invoice",
        None,
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        true,
        None
    ));
    rules.push(rule!(
        r"(?i)best[- ]?pass",
        Some("Bestpass"),
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)ez title",
        None,
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)troy licensing office",
        None,
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        true,
        None
    ));
    rules.push(rule!(
        r"(?i)ean services llc|enterprise holdings inc",
        Some("ENTERPRISE HOLDINGS INC"),
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)invoice\s*\d+\s*and\s*spreadsheet|mvd\s*now|mvdnow",
        Some("MVD NOW LLC"),
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)hertz car sales|cv7775|hertz",
        Some("HERTZ CAR SALES"),
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)quick[- ]?serv",
        Some("QUICK-SERV LICENSE CENTER"),
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        true,
        None
    ));
    rules.push(rule!(
        r"(?i)invoice",
        None,
        Some(REQUEST_INVOICE),
        Some(MAIL_MISC),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)wire\s*transfer",
        None,
        Some(REQUEST_WIRE_TRANSFER),
        Some(MAIL_MISC),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)folder",
        None,
        Some(REQUEST_CHECK_REQUEST),
        Some(MAIL_HUB_CHECKS),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)walked to the dmv",
        None,
        Some(REQUEST_CHECK_REQUEST),
        Some(MAIL_HUB_CHECKS),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)\bncdmv\b|\bnc dmv\b",
        None,
        Some(REQUEST_CHECK_REQUEST),
        Some(MAIL_HUB_CHECKS),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)service oklahoma",
        Some("SERVICE OKLAHOMA"),
        Some(REQUEST_CHECK_REQUEST),
        Some(MAIL_HUB_CHECKS),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)commonwealth of pennsylvania",
        None,
        Some(REQUEST_CHECK_REQUEST),
        Some(MAIL_HUB_CHECKS),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)market street",
        Some("Market Street"),
        Some(REQUEST_CHECK_REQUEST),
        Some(MAIL_INHOUSE),
        false,
        Some("4011 N MARKET ST, Spokane, WA 99207")
    ));
    rules.push(rule!(
        r"(?i)corporate check request",
        None,
        Some(REQUEST_CHECK_REQUEST),
        Some(MAIL_INHOUSE),
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)50 state dmv",
        None,
        Some(REQUEST_CHECK_REQUEST),
        None,
        false,
        None
    ));
    rules.push(rule!(r"(?i)dealer account no 43259|sc dmv", Some("SC DMV"), Some(REQUEST_CHECK_REQUEST), Some(MAIL_INHOUSE), false, Some("South Carolina Department of Motor / ATTN Carol Reynolds / 10311 Wilson Boulevard, Blythewood, SC 29016")));
    rules.push(rule!(
        r"(?i)(?:tarrant\s*c(?:ou)?nty\s*tax\s*assessor(?:\s*-\s*col(?:lector)?)?|rick\s*d\.?\s*barnes)",
        Some("TARRANT COUNTY TAX ASSESSOR-COLLECTOR"),
        None,
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)sell to carvana",
        None,
        Some(REQUEST_CHECK_REQUEST),
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)ttstc",
        None,
        Some(REQUEST_CHECK_REQUEST),
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)customer check request",
        None,
        Some(REQUEST_CHECK_REQUEST),
        Some(MAIL_HUB_CHECKS),
        false,
        None,
        r"(?i)good\s*will|goodwill|GDW"
    ));
    rules.push(rule!(
        r"(?i)t&r check request",
        None,
        Some(REQUEST_CHECK_REQUEST),
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)title & reg checks",
        None,
        Some(REQUEST_CHECK_REQUEST),
        None,
        false,
        None
    ));
    rules.push(rule!(
        r"(?i)carvana az processing",
        None,
        None,
        None,
        true,
        None
    ));
}
