use std::time::{SystemTime, UNIX_EPOCH};

use serde_json::Value;

#[async_trait::async_trait(?Send)]
pub trait ActionExecutor {
    fn now_ms(&self) -> u64;
    async fn wait_for(&mut self, selector: &str, timeout_ms: u32) -> Result<Value, String>;
    async fn click(&mut self, selector: &str) -> Result<Value, String>;
    async fn type_text(&mut self, selector: &str, text: &str) -> Result<Value, String>;
    async fn extract_table(&mut self, selector: &str) -> Result<Value, String>;
    async fn execute_command(&mut self, command: &str) -> Result<Value, String>;
}

#[derive(Default)]
pub struct NoopExecutor;

fn unsupported(action: &str) -> Result<Value, String> {
    Err(format!(
        "action '{action}' requires a concrete runtime executor"
    ))
}

#[async_trait::async_trait(?Send)]
impl ActionExecutor for NoopExecutor {
    fn now_ms(&self) -> u64 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .map(|duration| duration.as_millis() as u64)
            .unwrap_or(0)
    }

    async fn wait_for(&mut self, _selector: &str, _timeout_ms: u32) -> Result<Value, String> {
        unsupported("wait_for")
    }

    async fn click(&mut self, _selector: &str) -> Result<Value, String> {
        unsupported("click")
    }

    async fn type_text(&mut self, _selector: &str, _text: &str) -> Result<Value, String> {
        unsupported("type")
    }

    async fn extract_table(&mut self, _selector: &str) -> Result<Value, String> {
        unsupported("extract_table")
    }

    async fn execute_command(&mut self, _command: &str) -> Result<Value, String> {
        unsupported("execute")
    }
}
