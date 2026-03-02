use cv_ext_contract::Site;
use cv_ext_core::detect_site_from_href;

#[test]
fn detects_supported_hosts() {
    assert_eq!(
        detect_site_from_href("https://jira.carvana.com/issues"),
        Some(Site::Jira)
    );
    assert_eq!(
        detect_site_from_href("https://edsk.fa.us2.oraclecloud.com/home"),
        Some(Site::Oracle)
    );
    assert_eq!(
        detect_site_from_href("https://carma.cvnacorp.com/research/search/1"),
        Some(Site::Carma)
    );
}
