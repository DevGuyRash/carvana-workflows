use thiserror::Error;

#[derive(Debug, Error)]
pub enum WasmRuntimeError {
    #[error("{0}")]
    Message(String),
}

impl From<String> for WasmRuntimeError {
    fn from(value: String) -> Self {
        Self::Message(value)
    }
}

impl From<&str> for WasmRuntimeError {
    fn from(value: &str) -> Self {
        Self::Message(value.to_string())
    }
}
