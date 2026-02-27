#[derive(Debug, Clone)]
pub struct PanelTabs {
    allowed: Vec<&'static str>,
    active: String,
}

impl PanelTabs {
    pub fn new(allowed: Vec<&'static str>, default: &str) -> Self {
        let active = if allowed.iter().any(|item| item == &default) {
            default.to_string()
        } else {
            allowed.first().copied().unwrap_or("").to_string()
        };
        Self { allowed, active }
    }

    pub fn set_active(&mut self, value: &str) {
        if self.allowed.iter().any(|item| item == &value) {
            self.active = value.to_string();
        }
    }

    pub fn active(&self) -> &str {
        self.active.as_str()
    }
}

#[cfg(test)]
mod tests {
    use super::PanelTabs;

    #[test]
    fn tabs_only_accept_allowed_values() {
        let mut tabs = PanelTabs::new(vec!["a", "b"], "a");
        tabs.set_active("b");
        assert_eq!(tabs.active(), "b");
        tabs.set_active("x");
        assert_eq!(tabs.active(), "b");
    }
}
