use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CasingString {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub borehole_size: serde_json::Value,
    #[serde(default)]
    pub casing_size: serde_json::Value,
    #[serde(default)]
    pub top_depth: f64,
    #[serde(default)]
    pub shoe_depth: f64,
    #[serde(default)]
    pub drilled_depth: f64,
    pub top_of_cement: Option<f64>,
    pub top_of_liner: Option<f64>,
    #[serde(default, rename = "startFromTOL")]
    pub start_from_tol: bool,
    pub top_of_fonde: Option<f64>,
    pub grade: Option<String>,
    pub weight: Option<f64>,
    pub connection: Option<String>,
    pub observations: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TubingComponent {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub r#type: String,
    #[serde(default)]
    pub od: String,
    #[serde(default)]
    pub length: f64,
    #[serde(default)]
    pub bottom_depth: f64,
    #[serde(default)]
    pub is_cote_product_added: bool,
    pub observations: Option<String>,
    pub qty: Option<String>,
    pub custom_type: Option<String>,
    pub min_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct PerforationZone {
    pub id: String,
    #[serde(default)]
    pub top_depth: f64,
    #[serde(default)]
    pub bottom_depth: f64,
    #[serde(default)]
    pub height: f64,
    pub perfo_type: Option<String>,
    pub diameter: Option<String>,
    pub density: Option<f64>,
    pub shots: Option<f64>,
    pub observations: Option<String>,
    pub calage: Option<String>,
    pub reservoir: Option<String>,
    #[serde(default, rename = "isSqueezed")]
    pub is_squeezed: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CrepineZone {
    pub id: String,
    #[serde(default)]
    pub top_depth: f64,
    #[serde(default)]
    pub bottom_depth: f64,
    #[serde(default)]
    pub height: f64,
    pub type_crepine: Option<String>,
    pub diameter: Option<String>,
    pub slot: Option<String>,
    pub id_mi: Option<String>,
    pub nbre_coups: Option<f64>,
    pub observations: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CrepineZoneParams {
    pub top_of_liner: Option<f64>,
    pub shoe_depth: Option<f64>,
    pub diameter: Option<String>,
    pub length: Option<f64>,
    pub tubing_sabot_depth: Option<f64>,
    pub tubing_diameter: Option<String>,
    pub tubing_length: Option<f64>,
    pub observations: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WellData {
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub purpose: String,
    #[serde(default)]
    pub completion_type: String,
    #[serde(default)]
    pub reservoir: String,
    pub field: Option<String>,
    #[serde(default)]
    pub elevation_sol: f64,
    #[serde(default)]
    pub elevation_forage: f64,
    #[serde(default)]
    pub elevation_production: f64,
    pub spool_prod: Option<String>,
    pub packer_type: Option<String>,
    pub susp_tbg: Option<String>,
    pub etan_tbg: Option<String>,
    pub origine_cotes: Option<String>,
    #[serde(default)]
    pub casings: Vec<CasingString>,
    #[serde(default)]
    pub tubings: Vec<TubingComponent>,
    #[serde(default)]
    pub srp_components: Vec<TubingComponent>,
    #[serde(default)]
    pub perforations: Vec<PerforationZone>,
    #[serde(default)]
    pub liner_crepines: Vec<CrepineZone>,
    pub liner_crepine_params: Option<CrepineZoneParams>,
    #[serde(default)]
    pub cement_plugs: Vec<CementPlug>,
    pub observations: Option<String>,
    pub folio: Option<String>,
    pub folio_to_cancel: Option<String>,
    #[serde(default)]
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct CementPlug {
    pub id: String,
    #[serde(default)]
    pub top_depth: f64,
    #[serde(default)]
    pub bottom_depth: f64,
    pub observations: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DepthAnchor {
    pub depth: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VisualTool {
    #[serde(flatten)]
    pub component: TubingComponent,
    pub visual_y_top: f64,
    pub visual_y_bottom: f64,
    pub visual_height: f64,
    pub effective_type: String,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ScaleMode {
    Compact,
    Linear,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TubingPreset {
    pub default_name: String,
    pub default_od: String,
    pub default_custom_type: String,
    pub default_min_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TubingComponentConfig {
    pub r#type: String,
    pub default_name: String,
    pub default_od: String,
    pub default_custom_type: String,
    pub default_min_id: String,
    pub french_designation: String,
    pub french_type: String,
    pub render_type: String,
    pub vector_type: Option<String>,
    pub fill_color: Option<String>,
    pub stroke_color: Option<String>,
    pub stroke_width: Option<f64>,
    pub image_url: Option<String>,
    pub view_box: Option<String>,
    pub main_scale: Option<f64>,
    pub print_scale: Option<f64>,
    pub min_height: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CustomToolTypeRow {
    pub r#type: String,
    pub default_name: Option<String>,
    pub default_od: Option<String>,
    pub default_custom_type: Option<String>,
    pub default_min_id: Option<String>,
    pub french_designation: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchematicLayout {
    pub svg_width: f64,
    pub svg_height: f64,
    pub x_center: f64,
    pub y_start: f64,
    pub y_end: f64,
    pub casing_radius_factor: f64,
    pub tubing_half_width: f64,
    pub visual_tool_limit: f64,
    pub min_block_spacing: f64,
}

impl Default for SchematicLayout {
    fn default() -> Self {
        Self::interactive()
    }
}

impl SchematicLayout {
    pub fn interactive() -> Self {
        Self {
            svg_width: 700.0,
            svg_height: 1100.0,
            x_center: 350.0,
            y_start: 40.0,
            y_end: 1050.0,
            casing_radius_factor: 4.5,
            tubing_half_width: 7.0,
            visual_tool_limit: 950.0,
            min_block_spacing: 42.0,
        }
    }

    pub fn print() -> Self {
        Self {
            svg_width: 700.0,
            svg_height: 940.0,
            x_center: 350.0,
            y_start: 50.0,
            y_end: 915.0,
            casing_radius_factor: 4.5,
            tubing_half_width: 5.0,
            visual_tool_limit: 835.0,
            min_block_spacing: 42.0,
        }
    }
}
