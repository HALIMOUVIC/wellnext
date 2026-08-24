use crate::depth::{map_depth_to_y, map_depth_to_y_raw};
use crate::matrix::{active_tubing_component_matrix, get_french_type};
use crate::parse::{format_casing_size, format_depth, parse_size_to_number, parse_size_str};
use crate::types::{
    CasingString, PerforationZone, ScaleMode, SchematicLayout, TubingComponent, VisualTool, WellData,
};
use crate::SchematicComputeOutput;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchematicLayoutInput {
    pub well: WellData,
    pub layout: SchematicLayout,
    pub scale_mode: ScaleMode,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchematicFullOutput {
    pub schematic: SchematicComputeOutput,
    pub layout: SchematicGeometryOutput,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SchematicGeometryOutput {
    pub sorted_casing_indices: Vec<usize>,
    pub casings: Vec<CasingDrawData>,
    pub formation: Option<FormationLayout>,
    pub tubing_segments: Vec<YRange>,
    pub perforation: Option<PerforationDrawLayout>,
    pub left_labels: Vec<ResolvedLeftLabel>,
    pub right_labels: Vec<ResolvedRightLabel>,
    pub print_table_rows: Vec<PrintTableRowMeta>,
    pub tbg_bottom_depth: f64,
    pub tbg_visual_y_bottom: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CasingDrawData {
    pub casing_index: usize,
    pub casing_id: String,
    pub casing_r: f64,
    pub borehole_r: f64,
    pub y_top: f64,
    pub y_shoe: f64,
    pub y_drilled: f64,
    pub y_toc: f64,
    pub has_cement: bool,
    pub toc_val: Option<f64>,
    pub has_liner: bool,
    pub tol_val: Option<f64>,
    pub y_tol: Option<f64>,
    #[serde(rename = "hasTF")]
    pub has_tf: bool,
    pub tf_val: Option<f64>,
    #[serde(rename = "yTF")]
    pub y_tf: Option<f64>,
    pub block_y: f64,
    pub prev_casing_r: f64,
    pub prev_shoe_y: f64,
    pub prev_drilled_y: f64,
    pub prev_borehole_r: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FormationLayout {
    pub y_top: f64,
    pub y_bot_dotted: f64,
    pub rect_height: f64,
    pub formation_label: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct YRange {
    pub y_start: f64,
    pub y_end: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerforationDrawLayout {
    pub top_depth: f64,
    pub bottom_depth: f64,
    pub y_top: f64,
    pub y_bottom: f64,
    pub shot_rows: Vec<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedLeftLabel {
    pub text: String,
    pub target_y: f64,
    pub target_x: f64,
    pub resolved_y: f64,
    pub label_type: String,
    pub depth_str: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ResolvedRightLabel {
    pub id: String,
    pub target_y: f64,
    pub resolved_y: f64,
    pub height: f64,
    pub start_x: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PrintTableRowMeta {
    pub tool_id: String,
    pub qty: String,
    pub display_od: String,
    pub display_type: String,
    pub shows_cote: bool,
}

pub fn get_casing_top_depth(casing: &CasingString) -> f64 {
    let has_liner = is_valid_optional_depth(casing.top_of_liner);
    if has_liner {
        if let Some(tol) = casing.top_of_liner {
            if casing.start_from_tol || tol > 0.0 {
                return tol;
            }
        }
    }
    casing.top_depth
}

pub struct DepthMapper<'a> {
    scale_mode: ScaleMode,
    max_depth: f64,
    key_anchors: &'a [crate::types::DepthAnchor],
    y_start: f64,
    y_end: f64,
    tbg_bottom_depth: f64,
    tbg_visual_y_bottom: f64,
    svg_height: f64,
}

impl DepthMapper<'_> {
    #[allow(dead_code)]
    fn map_raw(&self, depth: f64) -> f64 {
        map_depth_to_y_raw(
            depth,
            self.scale_mode,
            self.max_depth,
            self.key_anchors,
            self.y_start,
            self.y_end,
        )
    }

    fn map(&self, depth: f64) -> f64 {
        map_depth_to_y(
            depth,
            self.scale_mode,
            self.max_depth,
            self.key_anchors,
            self.y_start,
            self.y_end,
            self.tbg_bottom_depth,
            self.tbg_visual_y_bottom,
            self.svg_height,
        )
    }
}

fn is_valid_optional_depth(val: Option<f64>) -> bool {
    val.map(|v| !v.is_nan()).unwrap_or(false)
}

pub fn sort_casing_indices(casings: &[CasingString]) -> Vec<usize> {
    let mut indices: Vec<usize> = (0..casings.len()).collect();
    indices.sort_by(|&a, &b| {
        let sa = parse_size_to_number(&casings[a].casing_size);
        let sb = parse_size_to_number(&casings[b].casing_size);
        sb.partial_cmp(&sa).unwrap_or(std::cmp::Ordering::Equal)
    });
    indices
}

pub fn resolve_block_labels(target_ys: &[f64], min_spacing: f64) -> Vec<f64> {
    let mut sorted: Vec<(usize, f64)> = target_ys.iter().copied().enumerate().collect();
    sorted.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

    let mut actual = vec![0.0; target_ys.len()];
    let mut current_y = f64::NEG_INFINITY;
    for (idx, target_y) in sorted {
        let y = if target_y < current_y + min_spacing {
            current_y + min_spacing
        } else {
            target_y
        };
        actual[idx] = y;
        current_y = y;
    }
    actual
}

pub fn resolve_spacing_labels(
    mut resolved: Vec<f64>,
    spacing_y: f64,
    min_y: f64,
    max_y: f64,
    iterations: u32,
) -> Vec<f64> {
    for _ in 0..iterations {
        let mut changed = false;
        for j in 0..resolved.len().saturating_sub(1) {
            if resolved[j + 1] - resolved[j] < spacing_y {
                let overlap = spacing_y - (resolved[j + 1] - resolved[j]);
                resolved[j] -= overlap / 2.0;
                resolved[j + 1] += overlap / 2.0;
                changed = true;
            }
        }
        for y in &mut resolved {
            if *y < min_y {
                *y = min_y;
                changed = true;
            }
            if *y > max_y {
                *y = max_y;
                changed = true;
            }
        }
        if !changed {
            break;
        }
    }
    resolved
}

pub fn resolve_height_labels(
    mut items: Vec<(f64, f64)>,
    padding: f64,
    iterations: u32,
) -> Vec<f64> {
    items.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
    let mut adjusted: Vec<f64> = items.iter().map(|(target, _)| *target).collect();
    let heights: Vec<f64> = items.iter().map(|(_, h)| *h).collect();

    for _ in 0..iterations {
        for i in 0..adjusted.len().saturating_sub(1) {
            let required = (heights[i] + heights[i + 1]) / 2.0 + padding;
            let actual = adjusted[i + 1] - adjusted[i];
            if actual < required {
                let overlap = required - actual;
                adjusted[i] -= overlap / 2.0;
                adjusted[i + 1] += overlap / 2.0;
            }
        }
    }
    adjusted
}

pub fn compute_casings_layout(
    well: &WellData,
    mapper: &DepthMapper<'_>,
    layout: &SchematicLayout,
) -> (Vec<usize>, Vec<CasingDrawData>) {
    let sorted_indices = sort_casing_indices(&well.casings);
    let factor = layout.casing_radius_factor;

    let mut base: Vec<CasingDrawData> = sorted_indices
        .iter()
        .enumerate()
        .map(|(_draw_index, &casing_index)| {
            let casing = &well.casings[casing_index];
            let casing_r = parse_size_to_number(&casing.casing_size) * factor;
            let borehole_r = parse_size_to_number(&casing.borehole_size) * factor;
            let has_liner = is_valid_optional_depth(casing.top_of_liner);
            let tol_val = if has_liner {
                casing.top_of_liner
            } else {
                None
            };
            let y_tol = if has_liner {
                Some(mapper.map(tol_val.unwrap_or(0.0)))
            } else {
                None
            };

            let effective_top_depth = get_casing_top_depth(casing);
            let y_top = mapper.map(effective_top_depth);
            let y_shoe = mapper.map(casing.shoe_depth);
            let y_drilled = mapper.map(casing.drilled_depth);

            let has_cement = is_valid_optional_depth(casing.top_of_cement);
            let toc_val = if has_cement {
                casing.top_of_cement
            } else {
                None
            };
            let y_toc = if has_cement {
                mapper.map(toc_val.unwrap_or(0.0))
            } else {
                y_top
            };

            let has_tf = is_valid_optional_depth(casing.top_of_fonde);
            let tf_val = if has_tf { casing.top_of_fonde } else { None };
            let y_tf = if has_tf { Some(mapper.map(tf_val.unwrap_or(0.0))) } else { None };

            CasingDrawData {
                casing_index,
                casing_id: casing.id.clone(),
                casing_r,
                borehole_r,
                y_top,
                y_shoe,
                y_drilled,
                y_toc,
                has_cement,
                toc_val,
                has_liner,
                tol_val,
                y_tol,
                has_tf,
                tf_val,
                y_tf,
                block_y: 0.0,
                prev_casing_r: 0.0,
                prev_shoe_y: 0.0,
                prev_drilled_y: 0.0,
                prev_borehole_r: 0.0,
            }
        })
        .collect();

    let block_targets: Vec<f64> = base.iter().map(|cd| cd.y_shoe - 25.0).collect();
    let block_ys = resolve_block_labels(&block_targets, layout.min_block_spacing);

    let snapshot: Vec<(f64, f64, f64, f64)> = base
        .iter()
        .map(|cd| (cd.casing_r, cd.y_shoe, cd.y_drilled, cd.borehole_r))
        .collect();

    for (i, cd) in base.iter_mut().enumerate() {
        cd.block_y = block_ys[i];
        if i > 0 {
            cd.prev_casing_r = snapshot[i - 1].0;
            cd.prev_shoe_y = snapshot[i - 1].1;
            cd.prev_drilled_y = snapshot[i - 1].2;
            cd.prev_borehole_r = snapshot[i - 1].3;
        } else {
            cd.prev_casing_r = cd.borehole_r;
            cd.prev_shoe_y = cd.y_top;
            cd.prev_drilled_y = cd.y_top;
            cd.prev_borehole_r = cd.borehole_r;
        }
    }

    (sorted_indices, base)
}

pub fn compute_formation_layout(
    well: &WellData,
    mapper: &DepthMapper<'_>,
    _svg_width: f64,
) -> Option<FormationLayout> {
    if well.perforations.is_empty() {
        return None;
    }

    let min_top = well
        .perforations
        .iter()
        .map(|p| p.top_depth)
        .fold(f64::INFINITY, f64::min);
    let max_bottom = well
        .perforations
        .iter()
        .map(|p| p.bottom_depth)
        .fold(f64::NEG_INFINITY, f64::max);

    let y_top = mapper.map(min_top);
    let y_bot = mapper.map(max_bottom);

    let deepest_shoe = well
        .casings
        .iter()
        .max_by(|a, b| {
            a.shoe_depth
                .partial_cmp(&b.shoe_depth)
                .unwrap_or(std::cmp::Ordering::Equal)
        })
        .map(|c| c.shoe_depth);

    let mut y_bot_dotted = y_bot + 35.0;
    if let Some(shoe) = deepest_shoe {
        let y_casing_shoe = mapper.map(shoe);
        if y_bot_dotted >= y_casing_shoe - 5.0 {
            y_bot_dotted = y_casing_shoe - 5.0;
        }
    }

    let res_name = well.reservoir.trim();
    let formation_label = if res_name.to_uppercase().contains("GRS")
        || res_name.to_uppercase().contains("SAND")
    {
        res_name.to_string()
    } else {
        format!("GRS {res_name} SANDSTONE")
    };

    Some(FormationLayout {
        y_top,
        y_bot_dotted,
        rect_height: y_bot_dotted - (y_top - 15.0),
        formation_label,
    })
}

pub fn compute_tubing_segments(
    computed_tools: &[VisualTool],
    y_start: f64,
    y_end_total: f64,
) -> Vec<YRange> {
    let mut excluded: Vec<YRange> = computed_tools
        .iter()
        .filter(|tool| crate::tubing::breaks_tubing_string(&tool.effective_type))
        .map(|tool| YRange {
            y_start: tool.visual_y_top,
            y_end: tool.visual_y_bottom,
        })
        .collect();

    excluded.sort_by(|a, b| {
        a.y_start
            .partial_cmp(&b.y_start)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut segments = Vec::new();
    let mut current_y = y_start;
    for range in excluded {
        if range.y_start > current_y + 1.0 {
            segments.push(YRange {
                y_start: current_y,
                y_end: range.y_start,
            });
        }
        current_y = range.y_end;
    }
    if current_y < y_end_total {
        segments.push(YRange {
            y_start: current_y,
            y_end: y_end_total,
        });
    }
    segments
}

pub fn active_casing_radius_at_depth_with_tool_od(
    well: &WellData,
    casings: &[CasingDrawData],
    depth: f64,
    tool_od: Option<&str>,
) -> f64 {
    if casings.is_empty() {
        return 24.5;
    }

    // 1. If tool_od is provided, try to match by OD size against casing strings
    if let Some(od_str) = tool_od {
        let od_val = parse_size_str(od_str);
        if od_val > 0.0 {
            let matching: Vec<&CasingDrawData> = casings
                .iter()
                .filter(|cd| {
                    if let Some(casing) = well.casings.get(cd.casing_index) {
                        let csg_size = parse_size_to_number(&casing.casing_size);
                        (csg_size - od_val).abs() < 0.25
                    } else {
                        false
                    }
                })
                .collect();

            if !matching.is_empty() {
                let best = matching.into_iter().min_by(|a, b| {
                    let c_a = &well.casings[a.casing_index];
                    let c_b = &well.casings[b.casing_index];
                    let top_a = get_casing_top_depth(c_a);
                    let top_b = get_casing_top_depth(c_b);
                    let dist_a = if depth < top_a { top_a - depth } else if depth > c_a.shoe_depth { depth - c_a.shoe_depth } else { 0.0 };
                    let dist_b = if depth < top_b { top_b - depth } else if depth > c_b.shoe_depth { depth - c_b.shoe_depth } else { 0.0 };
                    dist_a.partial_cmp(&dist_b).unwrap_or(std::cmp::Ordering::Equal)
                });
                if let Some(cd) = best {
                    return cd.casing_r;
                }
            }
        }
    }

    // 2. Otherwise check casings covering depth
    let mut covering: Vec<(f64, &CasingDrawData)> = casings
        .iter()
        .filter_map(|cd| {
            let casing = well.casings.get(cd.casing_index)?;
            let top = get_casing_top_depth(casing);
            if depth >= top && depth <= casing.shoe_depth {
                Some((cd.casing_r, cd))
            } else {
                None
            }
        })
        .collect();

    if !covering.is_empty() {
        covering.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal));
        return covering[0].0;
    }

    // 3. Fallback to closest casing string by depth distance
    let best = casings.iter().min_by(|a, b| {
        let c_a = &well.casings[a.casing_index];
        let c_b = &well.casings[b.casing_index];
        let top_a = get_casing_top_depth(c_a);
        let top_b = get_casing_top_depth(c_b);
        let dist_a = if depth < top_a { top_a - depth } else if depth > c_a.shoe_depth { depth - c_a.shoe_depth } else { 0.0 };
        let dist_b = if depth < top_b { top_b - depth } else if depth > c_b.shoe_depth { depth - c_b.shoe_depth } else { 0.0 };
        dist_a.partial_cmp(&dist_b).unwrap_or(std::cmp::Ordering::Equal)
    });

    best.map(|cd| cd.casing_r).unwrap_or(24.5)
}

pub fn active_casing_radius_at_depth(
    well: &WellData,
    casings: &[CasingDrawData],
    depth: f64,
) -> f64 {
    active_casing_radius_at_depth_with_tool_od(well, casings, depth, None)
}

pub fn compute_perforation_layout(
    perforations: &[PerforationZone],
    mapper: &DepthMapper<'_>,
) -> Option<PerforationDrawLayout> {
    if perforations.is_empty() {
        return None;
    }

    let top_depth = perforations
        .iter()
        .map(|p| p.top_depth)
        .fold(f64::INFINITY, f64::min);
    let bottom_depth = perforations
        .iter()
        .map(|p| p.bottom_depth)
        .fold(f64::NEG_INFINITY, f64::max);

    let y_top = mapper.map(top_depth);
    let y_bottom = mapper.map(bottom_depth);
    let height = y_bottom - y_top;
    let step = (height / 10.0).max(8.0);

    let mut shot_rows = Vec::new();
    let mut y = y_top;
    while y <= y_bottom {
        shot_rows.push(y);
        y += step;
    }

    Some(PerforationDrawLayout {
        top_depth,
        bottom_depth,
        y_top,
        y_bottom,
        shot_rows,
    })
}

pub fn compute_left_casing_labels(
    well: &WellData,
    casings: &[CasingDrawData],
    x_center: f64,
    spacing_y: f64,
    min_y: f64,
    max_y: f64,
    iterations: u32,
) -> Vec<ResolvedLeftLabel> {
    let mut raw: Vec<ResolvedLeftLabel> = Vec::new();

    for (index, cd) in casings.iter().enumerate() {
        let casing = &well.casings[cd.casing_index];
        let csg_size = format_casing_size(&casing.casing_size);
        let top_val = get_casing_top_depth(casing);

        if index == 0 {
            raw.push(ResolvedLeftLabel {
                text: format!("Ø tubage : {csg_size}"),
                target_y: cd.y_top + 15.0,
                target_x: x_center - cd.casing_r,
                resolved_y: 0.0,
                label_type: "Casing String".to_string(),
                depth_str: format!("{top_val} m"),
            });
            if cd.has_cement {
                raw.push(ResolvedLeftLabel {
                    text: "ciment".to_string(),
                    target_y: (cd.y_toc + cd.y_shoe) / 2.0 + 8.0,
                    target_x: x_center - (cd.borehole_r + cd.casing_r) / 2.0,
                    resolved_y: 0.0,
                    label_type: "Cement Fill".to_string(),
                    depth_str: if let Some(toc) = cd.toc_val {
                        format!("{} m - {} m", format_depth(Some(toc)), format_depth(Some(casing.shoe_depth)))
                    } else {
                        format!("0 m - {} m", format_depth(Some(casing.shoe_depth)))
                    },
                });
            }
            raw.push(ResolvedLeftLabel {
                text: format!("Sbt: {} m", format_depth(Some(casing.shoe_depth))),
                target_y: cd.y_shoe,
                target_x: x_center - cd.casing_r,
                resolved_y: 0.0,
                label_type: "Casing Shoe (Sabot)".to_string(),
                depth_str: format!("{} m", format_depth(Some(casing.shoe_depth))),
            });
        } else {
            raw.push(ResolvedLeftLabel {
                text: format!("Ø tubage : {csg_size}"),
                target_y: cd.y_shoe - 30.0,
                target_x: x_center - cd.casing_r,
                resolved_y: 0.0,
                label_type: "Casing String".to_string(),
                depth_str: format!("{top_val} m"),
            });
            raw.push(ResolvedLeftLabel {
                text: format!("Sbt: {} m", format_depth(Some(casing.shoe_depth))),
                target_y: cd.y_shoe,
                target_x: x_center - cd.casing_r,
                resolved_y: 0.0,
                label_type: "Casing Shoe (Sabot)".to_string(),
                depth_str: format!("{} m", format_depth(Some(casing.shoe_depth))),
            });
            if cd.has_cement {
                if let Some(toc) = cd.toc_val {
                    raw.push(ResolvedLeftLabel {
                        text: format!("TOC {csg_size} : {} m", format_depth(Some(toc))),
                        target_y: cd.y_toc,
                        target_x: x_center - (cd.borehole_r + cd.casing_r) / 2.0,
                        resolved_y: 0.0,
                        label_type: "Cement Fill".to_string(),
                        depth_str: format!("{} m", format_depth(Some(toc))),
                    });
                }
            }
            if cd.has_liner {
                if let (Some(tol), Some(y_tol)) = (cd.tol_val, cd.y_tol) {
                    raw.push(ResolvedLeftLabel {
                        text: format!("TOL {csg_size} : {} m", format_depth(Some(tol))),
                        target_y: y_tol,
                        target_x: x_center - (cd.borehole_r + cd.casing_r) / 2.0,
                        resolved_y: 0.0,
                        label_type: "Liner Hanger".to_string(),
                        depth_str: format!("{} m", format_depth(Some(tol))),
                    });
                }
            }
            if cd.has_tf {
                if let (Some(tf), Some(y_tf)) = (cd.tf_val, cd.y_tf) {
                    raw.push(ResolvedLeftLabel {
                        text: format!("TF {csg_size} : {} m", format_depth(Some(tf))),
                        target_y: y_tf,
                        target_x: x_center - (cd.borehole_r + cd.casing_r) / 2.0,
                        resolved_y: 0.0,
                        label_type: "Top Fonde".to_string(),
                        depth_str: format!("{} m", format_depth(Some(tf))),
                    });
                }
            }
            if cd.y_drilled > cd.y_shoe + 1.0 {
                raw.push(ResolvedLeftLabel {
                    text: format!(
                        "foré jusqu' à {} m",
                        format_depth(Some(casing.drilled_depth))
                    ),
                    target_y: cd.y_drilled,
                    target_x: x_center - cd.borehole_r,
                    resolved_y: 0.0,
                    label_type: "Drilled Borehole".to_string(),
                    depth_str: format!("{} m", format_depth(Some(casing.drilled_depth))),
                });
            }
        }
    }

    raw.sort_by(|a, b| {
        a.target_y
            .partial_cmp(&b.target_y)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    let resolved = resolve_spacing_labels(
        raw.iter().map(|l| l.target_y).collect(),
        spacing_y,
        min_y,
        max_y,
        iterations,
    );

    raw.into_iter()
        .zip(resolved)
        .map(|(mut label, y)| {
            label.resolved_y = y;
            label
        })
        .collect()
}

pub fn compute_right_tool_labels(
    computed_tools: &[VisualTool],
    x_center: f64,
    min_y: f64,
    max_y: f64,
    iterations: u32,
) -> Vec<ResolvedRightLabel> {
    const LABEL_HEIGHT: f64 = 28.0;
    const LABEL_PADDING: f64 = 8.0;

    let items: Vec<(String, f64, f64, f64)> = computed_tools
        .iter()
        .filter_map(|tool| {
            let effective = tool.effective_type.to_lowercase();
            let y_top = tool.visual_y_top;
            let y_bottom = tool.visual_y_bottom;
            let y_mid = (y_top + y_bottom) / 2.0;
            let mut target_y = y_mid + 12.0;
            let mut start_x = x_center + 5.0;

            if effective.contains("packer") {
                let draw_height = tool.visual_height.max(35.0);
                target_y = y_top + (277.0 / 635.0) * draw_height;
                start_x = x_center + 15.0;
            } else if effective.contains("mandrel") || effective.contains("mandrin") {
                target_y = y_mid - 20.0;
                start_x = x_center + 15.0;
            } else if effective.contains("nipple")
                || effective.contains("siège")
                || effective.contains("siege")
                || effective.contains("seating")
            {
                target_y = y_mid + 15.0;
                start_x = x_center + 10.0;
            } else if effective.contains("shoe") || effective.contains("sabot") {
                target_y = y_mid - 20.0;
            }

            Some((
                format!("tool-{}", tool.component.id),
                target_y,
                LABEL_HEIGHT,
                start_x,
            ))
        })
        .collect();

    let mut sorted = items;
    sorted.sort_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal));

    let mut resolved = resolve_height_labels(
        sorted.iter().map(|(_, y, h, _)| (*y, *h)).collect(),
        LABEL_PADDING,
        iterations,
    );
    resolved = resolve_spacing_labels(
        resolved,
        LABEL_HEIGHT + LABEL_PADDING,
        min_y,
        max_y,
        iterations,
    );

    sorted
        .into_iter()
        .zip(resolved)
        .map(|((id, target_y, height, start_x), resolved_y)| ResolvedRightLabel {
            id,
            target_y,
            resolved_y,
            height,
            start_x,
        })
        .collect()
}

pub fn estimate_joint_count(tool: &TubingComponent) -> String {
    if let Some(qty) = &tool.qty {
        if !qty.is_empty() {
            return qty.clone();
        }
    }
    if tool.r#type == "Tubing" && tool.length > 30.0 {
        return ((tool.length / 9.6).round() as i64).to_string();
    }
    "01".to_string()
}

pub fn compute_print_table_rows(tubings: &[TubingComponent]) -> Vec<PrintTableRowMeta> {
    let matrix = active_tubing_component_matrix();
    tubings
        .iter()
        .enumerate()
        .map(|(idx, tool)| {
            let is_blank = tool.name.is_empty();
            let mut display_od = tool.od.clone();
            if !is_blank && idx > 0 {
                let prev = &tubings[idx - 1];
                if prev.od == tool.od {
                    display_od = "//".to_string();
                }
            }

            let mut display_type = get_french_type(&tool.r#type, &tool.name, &matrix);
            if !is_blank && idx > 0 {
                let prev_fr = get_french_type(&tubings[idx - 1].r#type, &tubings[idx - 1].name, &matrix);
                if prev_fr == display_type && (display_type == "EU" || display_type == "D") {
                    display_type = "//".to_string();
                }
            }

            PrintTableRowMeta {
                tool_id: tool.id.clone(),
                qty: if is_blank {
                    String::new()
                } else {
                    estimate_joint_count(tool)
                },
                display_od: if is_blank {
                    String::new()
                } else {
                    display_od
                },
                display_type: if is_blank {
                    String::new()
                } else {
                    tool.custom_type.clone().unwrap_or(display_type)
                },
                shows_cote: !is_blank && tool.is_cote_product_added,
            }
        })
        .collect()
}

pub fn compute_schematic_geometry(
    well: &WellData,
    schematic: &SchematicComputeOutput,
    layout: &SchematicLayout,
    scale_mode: ScaleMode,
) -> SchematicGeometryOutput {
    let deepest_tool = schematic.computed_tools.last();
    let tbg_bottom_depth = deepest_tool.map(|t| t.component.bottom_depth).unwrap_or(0.0);
    let tbg_visual_y_bottom = deepest_tool
        .map(|t| t.visual_y_bottom)
        .unwrap_or(layout.y_start);

    let mapper = DepthMapper {
        scale_mode,
        max_depth: schematic.max_depth,
        key_anchors: &schematic.key_anchors,
        y_start: layout.y_start,
        y_end: layout.y_end,
        tbg_bottom_depth,
        tbg_visual_y_bottom,
        svg_height: layout.svg_height,
    };

    let (_sorted_indices, casings) = compute_casings_layout(well, &mapper, layout);

    let formation = compute_formation_layout(well, &mapper, layout.svg_width);

    let y_end_total = if schematic.computed_tools.is_empty() {
        layout.y_start
    } else {
        schematic
            .computed_tools
            .iter()
            .map(|t| t.visual_y_bottom)
            .fold(layout.y_start, f64::max)
    };

    let tubing_segments = compute_tubing_segments(&schematic.computed_tools, layout.y_start, y_end_total);
    let perforation = compute_perforation_layout(&well.perforations, &mapper);

    let (left_spacing, left_min_y, left_max_y, left_iters) = if layout.svg_height > 1000.0 {
        (15.0, 75.0, layout.svg_height - 25.0, 120)
    } else {
        (18.5, 50.0, layout.svg_height - 20.0, 100)
    };

    let left_labels = compute_left_casing_labels(
        well,
        &casings,
        layout.x_center,
        left_spacing,
        left_min_y,
        left_max_y,
        left_iters,
    );

    let right_min_y = if layout.svg_height > 1000.0 { 60.0 } else { 50.0 };
    let right_max_y = if layout.svg_height > 1000.0 {
        layout.svg_height - 30.0
    } else {
        layout.svg_height - 20.0
    };
    let right_iters = if layout.svg_height > 1000.0 { 150 } else { 120 };

    let right_labels = compute_right_tool_labels(
        &schematic.computed_tools,
        layout.x_center,
        right_min_y,
        right_max_y,
        right_iters,
    );
    let print_table_rows = compute_print_table_rows(&well.tubings);

    SchematicGeometryOutput {
        sorted_casing_indices: sort_casing_indices(&well.casings),
        casings,
        formation,
        tubing_segments,
        perforation,
        left_labels,
        right_labels,
        print_table_rows,
        tbg_bottom_depth,
        tbg_visual_y_bottom,
    }
}

pub fn compute_schematic_full(input: &SchematicLayoutInput) -> SchematicFullOutput {
    let schematic_input = crate::SchematicComputeInput {
        well: input.well.clone(),
        layout: input.layout.clone(),
        scale_mode: input.scale_mode,
    };
    let schematic = crate::compute_schematic(&schematic_input);
    let layout = compute_schematic_geometry(
        &input.well,
        &schematic,
        &input.layout,
        input.scale_mode,
    );
    SchematicFullOutput { schematic, layout }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn block_labels_do_not_overlap() {
        let targets = vec![100.0, 110.0, 115.0, 200.0];
        let resolved = resolve_block_labels(&targets, 42.0);
        for i in 1..resolved.len() {
            assert!(resolved[i] >= resolved[i - 1] + 42.0 - 0.001);
        }
    }

    #[test]
    fn joint_count_for_long_tubing() {
        let tool = TubingComponent {
            r#type: "Tubing".to_string(),
            length: 96.0,
            ..Default::default()
        };
        assert_eq!(estimate_joint_count(&tool), "10");
    }

    #[test]
    fn tubing_segments_only_break_at_packer() {
        let tools = vec![
            VisualTool {
                component: TubingComponent::default(),
                visual_y_top: 700.0,
                visual_y_bottom: 745.0,
                visual_height: 45.0,
                effective_type: "Side-pocket Mandrel".to_string(),
            },
            VisualTool {
                component: TubingComponent::default(),
                visual_y_top: 800.0,
                visual_y_bottom: 825.0,
                visual_height: 25.0,
                effective_type: "Seating Nipple".to_string(),
            },
            VisualTool {
                component: TubingComponent::default(),
                visual_y_top: 825.0,
                visual_y_bottom: 870.0,
                visual_height: 45.0,
                effective_type: "Packer".to_string(),
            },
            VisualTool {
                component: TubingComponent::default(),
                visual_y_top: 870.0,
                visual_y_bottom: 895.0,
                visual_height: 25.0,
                effective_type: "Seating Nipple".to_string(),
            },
        ];
        let segments = compute_tubing_segments(&tools, 50.0, 900.0);
        // Mandrel + nipple: tubing continuous; only packer breaks the string
        assert_eq!(segments.len(), 2);
        assert!((segments[0].y_start - 50.0).abs() < 0.001);
        assert!((segments[0].y_end - 825.0).abs() < 0.001);
        assert!((segments[1].y_start - 870.0).abs() < 0.001);
        assert!((segments[1].y_end - 900.0).abs() < 0.001);
    }
}
