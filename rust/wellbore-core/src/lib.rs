pub mod depth;
pub mod layout;
pub mod matrix;
pub mod parse;
pub mod perforation;
pub mod tubing;
pub mod types;

pub use depth::*;
pub use layout::*;
pub use matrix::*;
pub use parse::*;
pub use perforation::*;
pub use tubing::*;
pub use types::*;

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchematicComputeInput {
    pub well: WellData,
    pub layout: SchematicLayout,
    pub scale_mode: ScaleMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchematicComputeOutput {
    pub max_depth: f64,
    pub key_anchors: Vec<DepthAnchor>,
    pub filtered_tubings: Vec<TubingComponent>,
    pub computed_tools: Vec<VisualTool>,
}

pub fn compute_schematic(input: &SchematicComputeInput) -> SchematicComputeOutput {
    let max_depth = calculate_max_depth(&input.well);
    let key_anchors = calculate_key_anchors(
        &input.well,
        max_depth,
        input.layout.y_start,
        input.layout.y_end,
    );
    let filtered = get_filtered_tubings(&input.well.tubings);
    let scale_mode = input.scale_mode;
    let anchors = key_anchors.clone();
    let y_start = input.layout.y_start;
    let y_end = input.layout.y_end;
    let computed_tools = calculate_computed_tools(&filtered, |depth| {
        map_depth_to_y_raw(depth, scale_mode, max_depth, &anchors, y_start, y_end)
    }, input.layout.visual_tool_limit);

    SchematicComputeOutput {
        max_depth,
        key_anchors,
        filtered_tubings: filtered,
        computed_tools,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_fraction_size() {
        assert!((parse_size_str("9.625") - 9.625).abs() < 0.001);
        assert!((parse_size_str("2''7/8") - 2.875).abs() < 0.01);
    }

    #[test]
    fn max_depth_defaults_to_100() {
        let well = WellData::default();
        assert_eq!(calculate_max_depth(&well), 100.0);
    }
}
