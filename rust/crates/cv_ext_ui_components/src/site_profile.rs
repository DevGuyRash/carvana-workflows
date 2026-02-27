pub trait SiteTableProfile {
    fn id(&self) -> &'static str;
    fn quick_copy_columns(&self) -> &'static [&'static str];
    fn default_selected_columns(&self) -> &'static [&'static str];
}

pub struct CarmaTableProfile;

impl SiteTableProfile for CarmaTableProfile {
    fn id(&self) -> &'static str {
        "carma"
    }

    fn quick_copy_columns(&self) -> &'static [&'static str] {
        &[
            "reference",
            "stocknumber",
            "latestpurchasestocknumber",
            "vin",
            "latestpurchasevin",
        ]
    }

    fn default_selected_columns(&self) -> &'static [&'static str] {
        &[
            "reference",
            "searchterm",
            "searchurl",
            "table",
            "page",
            "stocknumber",
            "latestpurchasestocknumber",
            "vin",
            "latestpurchasevin",
            "purchaseid",
            "latestpurchasepurchaseid",
        ]
    }
}
