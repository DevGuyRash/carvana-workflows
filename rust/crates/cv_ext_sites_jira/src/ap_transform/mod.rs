#![allow(clippy::indexing_slicing)] // Reason: fixed-width AP export schema rows are pre-sized from ap_output_columns().

mod address;
mod constants;
mod extraction;
mod normalize;
mod transform;
mod vendor_rules;

pub use constants::ap_output_columns;
pub use transform::{transform_filter_rows, transform_filter_table_aoa};
