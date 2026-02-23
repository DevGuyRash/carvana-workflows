use cv_ext_contract::{Site, WorkflowDefinition};
use cv_ext_workflows_carma::carma_workflows;
use cv_ext_workflows_jira::jira_workflows;
use cv_ext_workflows_oracle::oracle_workflows;

pub fn workflows_for_site(site: Site) -> Vec<WorkflowDefinition> {
    match site {
        Site::Jira => jira_workflows(),
        Site::Oracle => oracle_workflows(),
        Site::Carma => carma_workflows(),
    }
}

pub fn detect_site_from_href(href: &str) -> Option<Site> {
    let lower = href.to_lowercase();
    if lower.contains("jira.carvana.com") {
        return Some(Site::Jira);
    }
    if lower.contains("oraclecloud.com") && lower.contains("fa") {
        return Some(Site::Oracle);
    }
    if lower.contains("carma.cvnacorp.com") {
        return Some(Site::Carma);
    }
    None
}

#[cfg(test)]
mod tests {
    use cv_ext_contract::Site;

    use super::detect_site_from_href;

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
}
