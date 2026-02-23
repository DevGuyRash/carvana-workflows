use cv_ext_contract::{Action, Site, WorkflowDefinition};

pub fn carma_workflows() -> Vec<WorkflowDefinition> {
    vec![WorkflowDefinition {
        id: "carma.bulk.search.scrape".to_string(),
        label: "Carma: Bulk Search Scrape".to_string(),
        description: "Scrape bulk search result tables and export CSV/JSON from extension runtime.".to_string(),
        site: Site::Carma,
        actions: vec![
            Action::WaitFor {
                selector: "table".to_string(),
                timeout_ms: 12000,
            },
            Action::ExtractTable {
                selector: "table".to_string(),
            },
        ],
        internal: false,
    }]
}
