use crate::types::{DepthAnchor, ScaleMode, WellData};

pub fn calculate_max_depth(well: &WellData) -> f64 {
    let mut depths = Vec::new();
    for c in &well.casings {
        depths.push(c.drilled_depth);
        depths.push(c.shoe_depth);
    }
    for t in &well.tubings {
        depths.push(t.bottom_depth);
    }
    for p in &well.perforations {
        depths.push(p.bottom_depth);
    }
    for lc in &well.liner_crepines {
        depths.push(lc.bottom_depth);
        depths.push(lc.top_depth);
    }
    if let Some(lcp) = &well.liner_crepine_params {
        if let Some(tol) = lcp.top_of_liner { depths.push(tol); }
        if let Some(sbt) = lcp.shoe_depth { depths.push(sbt); }
        if let Some(ts) = lcp.tubing_sabot_depth { depths.push(ts); }
    }
    depths.push(well.elevation_forage);
    let valid: Vec<f64> = depths.into_iter().filter(|d| !d.is_nan()).collect();
    if valid.is_empty() {
        100.0
    } else {
        valid.into_iter().fold(100.0, f64::max)
    }
}

pub fn calculate_key_anchors(well: &WellData, max_depth: f64, y_start: f64, y_end: f64) -> Vec<DepthAnchor> {
    let mut depths = vec![0.0];
    for c in &well.casings {
        if !c.shoe_depth.is_nan() {
            depths.push(c.shoe_depth);
        }
        if !c.drilled_depth.is_nan() {
            depths.push(c.drilled_depth);
        }
        if let Some(toc) = c.top_of_cement {
            if !toc.is_nan() {
                depths.push(toc);
            }
        }
        if let Some(tol) = c.top_of_liner {
            if !tol.is_nan() {
                depths.push(tol);
            }
        }
        if let Some(tf) = c.top_of_fonde {
            if !tf.is_nan() {
                depths.push(tf);
            }
        }
    }
    for t in &well.tubings {
        if !t.bottom_depth.is_nan() {
            depths.push(t.bottom_depth);
        }
        if t.r#type == "Packer" && !t.bottom_depth.is_nan() {
            depths.push((t.bottom_depth - 10.0).max(0.0));
        }
    }
    for p in &well.perforations {
        if !p.top_depth.is_nan() {
            depths.push(p.top_depth);
        }
        if !p.bottom_depth.is_nan() {
            depths.push(p.bottom_depth);
        }
    }
    for lc in &well.liner_crepines {
        if !lc.top_depth.is_nan() {
            depths.push(lc.top_depth);
        }
        if !lc.bottom_depth.is_nan() {
            depths.push(lc.bottom_depth);
        }
    }
    if let Some(lcp) = &well.liner_crepine_params {
        if let Some(tol) = lcp.top_of_liner {
            if !tol.is_nan() { depths.push(tol); }
        }
        if let Some(sbt) = lcp.shoe_depth {
            if !sbt.is_nan() { depths.push(sbt); }
        }
        if let Some(ts) = lcp.tubing_sabot_depth {
            if !ts.is_nan() { depths.push(ts); }
        }
    }

    depths.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
    depths.dedup_by(|a, b| (*a - *b).abs() < f64::EPSILON);
    depths.retain(|d| *d >= 0.0 && !d.is_nan());

    if depths.len() <= 1 {
        return vec![
            DepthAnchor { depth: 0.0, y: y_start },
            DepthAnchor {
                depth: max_depth.max(100.0),
                y: y_end,
            },
        ];
    }

    let usable_height = y_end - y_start;
    let n = depths.len();
    let max_d = depths[n - 1].max(100.0);

    depths
        .into_iter()
        .enumerate()
        .map(|(i, depth)| {
            let y_linear = y_start + (depth / max_d) * usable_height;
            let y_even = y_start + (i as f64 / (n as f64 - 1.0)) * usable_height;
            let y = 0.6 * y_even + 0.4 * y_linear;
            DepthAnchor { depth, y }
        })
        .collect()
}

pub fn map_depth_to_y_raw(
    depth: f64,
    scale_mode: ScaleMode,
    max_depth: f64,
    key_anchors: &[DepthAnchor],
    y_start: f64,
    y_end: f64,
) -> f64 {
    if depth.is_nan() {
        return y_start;
    }
    if scale_mode == ScaleMode::Linear {
        let usable_height = y_end - y_start;
        return y_start + (depth / max_depth) * usable_height;
    }
    if key_anchors.is_empty() {
        return y_start;
    }
    if depth <= key_anchors[0].depth {
        return key_anchors[0].y;
    }
    let last = key_anchors.len() - 1;
    if depth >= key_anchors[last].depth {
        return key_anchors[last].y;
    }
    for window in key_anchors.windows(2) {
        let start = &window[0];
        let end = &window[1];
        if depth >= start.depth && depth <= end.depth {
            let ratio = (depth - start.depth) / (end.depth - start.depth);
            return start.y + ratio * (end.y - start.y);
        }
    }
    y_start
}

pub fn map_depth_to_y(
    depth: f64,
    scale_mode: ScaleMode,
    max_depth: f64,
    key_anchors: &[DepthAnchor],
    y_start: f64,
    y_end: f64,
    tbg_bottom_depth: f64,
    tbg_visual_y_bottom: f64,
    svg_height: f64,
) -> f64 {
    let raw_y = map_depth_to_y_raw(depth, scale_mode, max_depth, key_anchors, y_start, y_end);
    if depth.is_nan() {
        return raw_y;
    }
    if tbg_bottom_depth > 0.0 && depth > tbg_bottom_depth {
        let raw_tbg_bottom_y =
            map_depth_to_y_raw(tbg_bottom_depth, scale_mode, max_depth, key_anchors, y_start, y_end);
        let bottom_y = svg_height - 50.0;
        if raw_y > raw_tbg_bottom_y && bottom_y > raw_tbg_bottom_y {
            let ratio = (raw_y - raw_tbg_bottom_y) / (bottom_y - raw_tbg_bottom_y);
            let available_height = (bottom_y - tbg_visual_y_bottom).max(50.0);
            return tbg_visual_y_bottom + ratio * available_height;
        }
        return tbg_visual_y_bottom + 5.0;
    }
    raw_y
}
