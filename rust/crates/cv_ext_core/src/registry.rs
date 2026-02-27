use cv_ext_contract::{RuleDefinition, Site, WorkflowDefinition};
use cv_ext_sites_carma::carma_rules;
use cv_ext_sites_jira::jira_rules;
use cv_ext_sites_oracle::oracle_rules;

pub fn rules_for_site(site: Site) -> Vec<RuleDefinition> {
    match site {
        Site::Jira => jira_rules(),
        Site::Oracle => oracle_rules(),
        Site::Carma => carma_rules(),
    }
}

pub fn workflows_for_site(site: Site) -> Vec<WorkflowDefinition> {
    rules_for_site(site)
        .into_iter()
        .map(|rule| WorkflowDefinition {
            id: rule.id,
            label: rule.label,
            description: rule.description,
            site: rule.site,
            actions: rule.actions,
            internal: rule.priority >= 200,
        })
        .collect()
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
