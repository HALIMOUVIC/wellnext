use std::collections::HashSet;

use crate::matrix::{get_french_designation, get_french_type, get_tubing_type_defaults, update_tubing_component_matrix};
use crate::types::{TubingComponent, TubingPreset, VisualTool};

pub fn get_effective_type(type_name: &str, name: &str) -> String {
    let t = type_name.to_lowercase();
    let n = name.to_lowercase();

    if t.contains("mandrel") || t.contains("mandrin") || n.contains("mandrel") || n.contains("mandrin") || n.contains("gas lift") {
        return "Side-pocket Mandrel".to_string();
    }
    if t.contains("packer") || t.contains("pkr") || n.contains("packer") || n.contains("pkr") {
        return "Packer".to_string();
    }
    if t.contains("nipple") || t.contains("siège") || t.contains("siége") || t.contains("siege") || n.contains("nipple") || n.contains("siège") || n.contains("siége") || n.contains("siege") || n.contains("fnp") || n.contains("no-go") {
        return "Seating Nipple".to_string();
    }
    if t.contains("shoe") || t.contains("sabot") || n.contains("shoe") || n.contains("sabot") {
        return "Shoe".to_string();
    }
    if t.contains("reduction") || t.contains("swage") || t.contains("crossover") || t.contains("cross-over") || t.contains("réduction") || n.contains("reduction") || n.contains("swage") || n.contains("crossover") || n.contains("cross-over") || n.contains("réduction") {
        return "Reduction".to_string();
    }
    if t.contains("pompe") || t.contains("pump") || n.contains("pompe") || n.contains("pump") {
        return "Pompe".to_string();
    }
    if t.contains("moteur") || t.contains("motor") || n.contains("moteur") || n.contains("motor") {
        return "Moteur".to_string();
    }
    if t.contains("crépine") || t.contains("crepine") || n.contains("crépine") || n.contains("crepine") || t.contains("screen") || n.contains("screen") {
        return "Crépine".to_string();
    }
    if t.contains("tailpipe") || t.contains("queue") || n.contains("tailpipe") || n.contains("queue") {
        return "Tailpipe".to_string();
    }
    if t.contains("anchor") || t.contains("ancrage") || t.contains("seal") || n.contains("anchor") || n.contains("ancrage") || n.contains("seal") {
        return "Anchor-seal".to_string();
    }
    if t.contains("pup") || t.contains("court") || n.contains("pup") || n.contains("court") || n.contains("joint court") || n.contains("tubing court") {
        return "Tubing Court".to_string();
    }
    if t.contains("drill") || n.contains("drill") {
        return "Drill".to_string();
    }
    if type_name.is_empty() {
        "Tubing".to_string()
    } else {
        type_name.to_string()
    }
}

pub fn get_filtered_tubings(tubings: &[TubingComponent]) -> Vec<TubingComponent> {
    let mut seen_joint_court = false;
    let mut seen_keys = HashSet::new();

    let tubings_with_depths: Vec<TubingComponent> = tubings
        .iter()
        .enumerate()
        .map(|(index, tool)| {
            if tool.bottom_depth > 0.0 {
                return tool.clone();
            }
            if index > 0 {
                let prev = &tubings[index - 1];
                let prev_name = prev.name.to_lowercase();
                let tool_name = tool.name.to_lowercase();
                if tool_name.contains("anchor") && prev_name.contains("packer") {
                    let mut updated = tool.clone();
                    updated.bottom_depth = (prev.bottom_depth - 0.22).max(0.0);
                    return updated;
                }
                let mut updated = tool.clone();
                updated.bottom_depth = (prev.bottom_depth - prev.length).max(0.0);
                return updated;
            }
            tool.clone()
        })
        .collect();

    tubings_with_depths
        .into_iter()
        .filter(|tool| {
            if !tool.is_cote_product_added || tool.name.is_empty() {
                return false;
            }
            let effective_type = get_effective_type(&tool.r#type, &tool.name);
            if effective_type == "Tubing Court" {
                if seen_joint_court {
                    return false;
                }
                seen_joint_court = true;
            }
            if effective_type != "Side-pocket Mandrel" {
                let depth_key = format!(
                    "{}_{}",
                    effective_type,
                    ((tool.bottom_depth * 10.0).round() / 10.0)
                );
                if seen_keys.contains(&depth_key) {
                    return false;
                }
                seen_keys.insert(depth_key);
            }
            true
        })
        .collect()
}

/// Tools that span the casing and block the tubing column (only packer skips tubing segments).
/// Side-pocket mandrels, nipples, shoes, etc. stay on the tubing string.
pub fn breaks_tubing_string(effective_type: &str) -> bool {
    effective_type == "Packer"
}

fn is_tubing_like(effective_type: &str) -> bool {
    effective_type == "Tubing" || effective_type == "Tubing Court"
}

/// Force completion tools in the same depth cluster (< 150 m) into one visual stack.
pub fn compact_completion_clusters(tools: &mut [VisualTool]) {
    let mut completion: Vec<usize> = tools
        .iter()
        .enumerate()
        .filter(|(_, t)| !is_tubing_like(&t.effective_type))
        .map(|(i, _)| i)
        .collect();

    if completion.len() <= 1 {
        return;
    }

    completion.sort_by(|a, b| {
        tools[*a]
            .component
            .bottom_depth
            .partial_cmp(&tools[*b].component.bottom_depth)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut group_start = 0;
    let mut i = 1;
    while i <= completion.len() {
        let break_cluster = i == completion.len()
            || tools[completion[i]].component.bottom_depth
                - tools[completion[group_start]].component.bottom_depth
                >= 150.0;

        if break_cluster {
            if i - group_start > 1 {
                let mut y = completion[group_start..i]
                    .iter()
                    .map(|&idx| tools[idx].visual_y_top)
                    .fold(f64::INFINITY, f64::min);

                for &idx in &completion[group_start..i] {
                    let h = tools[idx].visual_height;
                    tools[idx].visual_y_top = y;
                    tools[idx].visual_y_bottom = y + h;
                    tools[idx].visual_height = h;
                    y += h;
                }
            }
            group_start = i;
        }
        i += 1;
    }
}

fn min_height_for_type(effective_type: &str, raw_height: f64) -> f64 {
    let base = match effective_type {
        "Packer" | "Side-pocket Mandrel" | "Pompe" | "Moteur" => 45.0,
        "Crépine" => 35.0,
        "Seating Nipple" | "Shoe" | "Anchor-seal" | "Drill" => 25.0,
        "Reduction" => 20.0,
        "Tubing Court" => 35.0,
        _ => raw_height.max(15.0),
    };
    base.max(15.0)
}

pub fn calculate_computed_tools<F>(
    filtered_tubings: &[TubingComponent],
    map_depth_to_y_raw_fn: F,
    limit: f64,
) -> Vec<VisualTool>
where
    F: Fn(f64) -> f64,
{
    let mut sorted_tools = filtered_tubings.to_vec();
    sorted_tools.sort_by(|a, b| {
        a.bottom_depth
            .partial_cmp(&b.bottom_depth)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut result: Vec<VisualTool> = Vec::new();
    for (idx, tool) in sorted_tools.iter().enumerate() {
        let effective_type = get_effective_type(&tool.r#type, &tool.name);
        let raw_y_bottom = map_depth_to_y_raw_fn(tool.bottom_depth);
        let raw_y_top = map_depth_to_y_raw_fn(tool.bottom_depth - tool.length);
        let normal_height = min_height_for_type(&effective_type, raw_y_bottom - raw_y_top);

        let mut visual_y_top = raw_y_top;
        let mut visual_y_bottom = raw_y_top + normal_height;

        if idx > 0 {
            let prev = &result[idx - 1];
            let gap = tool.bottom_depth - prev.component.bottom_depth;
            if gap < 150.0 {
                visual_y_top = prev.visual_y_bottom;
                visual_y_bottom = visual_y_top + normal_height;
            } else if !is_tubing_like(&effective_type) {
                // Completion cluster: stack on nearest prior completion tool even if
                // tubing joints sit between them in the sorted depth list.
                if let Some(prev_comp) = result
                    .iter()
                    .rev()
                    .find(|t| !is_tubing_like(&t.effective_type))
                {
                    let cluster_gap = tool.bottom_depth - prev_comp.component.bottom_depth;
                    if cluster_gap < 150.0 {
                        visual_y_top = prev_comp.visual_y_bottom;
                        visual_y_bottom = visual_y_top + normal_height;
                    }
                }
            }
        }

        result.push(VisualTool {
            component: tool.clone(),
            visual_y_top,
            visual_y_bottom,
            visual_height: visual_y_bottom - visual_y_top,
            effective_type,
        });
    }

    compact_completion_clusters(&mut result);

    if let Some(last) = result.last() {
        let deepest = last.visual_y_bottom;
        if deepest > limit {
            let overhang = deepest - limit;
            for item in &mut result {
                item.visual_y_top -= overhang;
                item.visual_y_bottom -= overhang;
            }
        }
    }

    result
}

pub fn recalculate_bottom_depths(tubings: &[TubingComponent]) -> Vec<TubingComponent> {
    let mut current_depth = 0.0;
    tubings
        .iter()
        .map(|t| {
            current_depth += t.length;
            let mut updated = t.clone();
            updated.bottom_depth = (current_depth * 100.0).round() / 100.0;
            updated
        })
        .collect()
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TubingWithCote {
    #[serde(flatten)]
    pub component: TubingComponent,
    pub calculated_cote: f64,
}

pub fn calculate_cote_products(tubings: &[TubingComponent], spool_prod: Option<&str>) -> Vec<TubingWithCote> {
    let spool = spool_prod.and_then(|s| s.parse::<f64>().ok()).unwrap_or(0.0);
    let total_length: f64 = tubings.iter().map(|t| t.length).sum();
    let mut current_cote = total_length - spool;

    tubings
        .iter()
        .map(|tool| {
            let cote = current_cote;
            current_cote -= tool.length;
            TubingWithCote {
                component: tool.clone(),
                calculated_cote: cote,
            }
        })
        .collect()
}

pub fn french_designation(
    type_name: &str,
    name: &str,
    matrix: &std::collections::HashMap<String, crate::types::TubingComponentConfig>,
) -> String {
    get_french_designation(type_name, name, matrix)
}

pub fn french_type(
    type_name: &str,
    name: &str,
    matrix: &std::collections::HashMap<String, crate::types::TubingComponentConfig>,
) -> String {
    get_french_type(type_name, name, matrix)
}

pub fn tubing_type_defaults(
    type_name: &str,
    matrix: &std::collections::HashMap<String, crate::types::TubingComponentConfig>,
) -> TubingPreset {
    get_tubing_type_defaults(type_name, matrix)
}

pub fn merge_tool_matrix_from_db(
    rows: &[crate::types::CustomToolTypeRow],
) -> std::collections::HashMap<String, crate::types::TubingComponentConfig> {
    update_tubing_component_matrix(rows)
}
