pub struct StatusSurfaceModel<'a> {
    pub status: &'a str,
    pub icon: &'a str,
    pub title: &'a str,
    pub css_class: &'a str,
}

impl<'a> StatusSurfaceModel<'a> {
    pub fn for_oracle_validation(status: &'a str) -> Self {
        match status {
            "validated" => Self {
                status,
                icon: "✅",
                title: "Validated",
                css_class: "cv-validated",
            },
            "needs-revalidated" => Self {
                status,
                icon: "⚠️",
                title: "Needs Revalidation",
                css_class: "cv-needs-revalidated",
            },
            "checking" => Self {
                status,
                icon: "🔄",
                title: "Checking...",
                css_class: "cv-checking",
            },
            _ => Self {
                status,
                icon: "❓",
                title: "Status Unknown",
                css_class: "cv-unknown",
            },
        }
    }
}

#[cfg(test)]
mod tests {
    use super::StatusSurfaceModel;

    #[test]
    fn oracle_status_maps_to_known_css_class() {
        let model = StatusSurfaceModel::for_oracle_validation("validated");
        assert_eq!(model.css_class, "cv-validated");
    }
}
