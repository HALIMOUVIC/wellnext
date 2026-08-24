use crate::types::{CrepineZone, PerforationZone, WellData};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PerforationFields {
    pub height: f64,
    pub shots: Option<f64>,
}

pub fn calculate_perforation_fields(
    top: f64,
    bottom: f64,
    manual_height: Option<f64>,
    density: Option<f64>,
    manual_shots: Option<f64>,
) -> PerforationFields {
    let height = if let Some(h) = manual_height {
        if h > 0.0 {
            (h * 100.0).round() / 100.0
        } else {
            ((bottom - top).abs() * 100.0).round() / 100.0
        }
    } else {
        ((bottom - top).abs() * 100.0).round() / 100.0
    };

    let shots = manual_shots.or_else(|| density.map(|d| ((height * d) * 100.0).round() / 100.0));

    PerforationFields { height, shots }
}

pub fn save_perforation(
    well: &WellData,
    new_perf: &PerforationZone,
    editing_perf_id: Option<&str>,
) -> WellData {
    let top = new_perf.top_depth;
    let bottom = new_perf.bottom_depth;
    let fields = calculate_perforation_fields(
        top,
        bottom,
        Some(new_perf.height),
        new_perf.density,
        new_perf.shots,
    );

    let mut updated = well.clone();
    if let Some(id) = editing_perf_id {
        updated.perforations = updated
            .perforations
            .iter()
            .map(|p| {
                if p.id == id {
                    PerforationZone {
                        id: p.id.clone(),
                        top_depth: top,
                        bottom_depth: bottom,
                        height: fields.height,
                        perfo_type: new_perf.perfo_type.clone(),
                        diameter: new_perf.diameter.clone(),
                        density: new_perf.density,
                        shots: fields.shots,
                        observations: new_perf.observations.clone(),
                        calage: new_perf.calage.clone(),
                        reservoir: new_perf.reservoir.clone(),
                        is_squeezed: new_perf.is_squeezed.or(p.is_squeezed),
                    }
                } else {
                    p.clone()
                }
            })
            .collect();
    } else {
        let entry = PerforationZone {
            id: format!("perf-{}", chrono_now_millis()),
            top_depth: top,
            bottom_depth: bottom,
            height: fields.height,
            perfo_type: new_perf.perfo_type.clone(),
            diameter: new_perf.diameter.clone(),
            density: new_perf.density,
            shots: fields.shots,
            observations: new_perf.observations.clone(),
            calage: new_perf.calage.clone(),
            reservoir: new_perf.reservoir.clone(),
            is_squeezed: new_perf.is_squeezed,
        };
        updated.perforations.push(entry);
    }
    updated.updated_at = chrono_now_iso();
    updated
}

pub fn remove_perforation_from_well(well: &WellData, id: &str) -> WellData {
    let mut updated = well.clone();
    updated.perforations.retain(|p| p.id != id);
    updated.updated_at = chrono_now_iso();
    updated
}

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CrepineZoneFields {
    pub top_depth: f64,
    pub bottom_depth: f64,
    pub height: f64,
}

pub fn calculate_liner_crepine_fields(
    top_input: f64,
    bottom_input: f64,
    manual_height: Option<f64>,
) -> CrepineZoneFields {
    let top_depth = top_input.min(bottom_input);
    let bottom_depth = top_input.max(bottom_input);
    let height = if let Some(h) = manual_height {
        if h > 0.0 {
            (h * 100.0).round() / 100.0
        } else {
            ((bottom_depth - top_depth).abs() * 100.0).round() / 100.0
        }
    } else {
        ((bottom_depth - top_depth).abs() * 100.0).round() / 100.0
    };

    CrepineZoneFields {
        top_depth,
        bottom_depth,
        height,
    }
}

pub fn save_liner_crepine(
    well: &WellData,
    new_lc: &CrepineZone,
    editing_lc_id: Option<&str>,
) -> WellData {
    let fields = calculate_liner_crepine_fields(new_lc.top_depth, new_lc.bottom_depth, Some(new_lc.height));
    let mut updated = well.clone();

    if let Some(id) = editing_lc_id {
        updated.liner_crepines = updated
            .liner_crepines
            .iter()
            .map(|lc| {
                if lc.id == id {
                    CrepineZone {
                        id: lc.id.clone(),
                        top_depth: fields.top_depth,
                        bottom_depth: fields.bottom_depth,
                        height: fields.height,
                        type_crepine: new_lc.type_crepine.clone(),
                        diameter: new_lc.diameter.clone(),
                        slot: new_lc.slot.clone(),
                        id_mi: new_lc.id_mi.clone(),
                        nbre_coups: new_lc.nbre_coups,
                        observations: new_lc.observations.clone(),
                    }
                } else {
                    lc.clone()
                }
            })
            .collect();
    } else {
        let entry = CrepineZone {
            id: format!("lc-{}", chrono_now_millis()),
            top_depth: fields.top_depth,
            bottom_depth: fields.bottom_depth,
            height: fields.height,
            type_crepine: new_lc.type_crepine.clone(),
            diameter: new_lc.diameter.clone(),
            slot: new_lc.slot.clone(),
            id_mi: new_lc.id_mi.clone(),
            nbre_coups: new_lc.nbre_coups,
            observations: new_lc.observations.clone(),
        };
        updated.liner_crepines.push(entry);
    }
    updated.updated_at = chrono_now_iso();
    updated
}

pub fn remove_liner_crepine_from_well(well: &WellData, id: &str) -> WellData {
    let mut updated = well.clone();
    updated.liner_crepines.retain(|lc| lc.id != id);
    updated.updated_at = chrono_now_iso();
    updated
}

pub fn calculate_liner_crepine_header_fields(
    top_of_liner: Option<f64>,
    shoe_depth: Option<f64>,
    tubing_sabot_depth: Option<f64>,
    spool_prod: Option<&str>,
) -> (Option<f64>, Option<f64>) {
    let liner_len = match (top_of_liner, shoe_depth) {
        (Some(tol), Some(shoe)) => Some(((shoe - tol).abs() * 100.0).round() / 100.0),
        _ => None,
    };
    let spool: f64 = spool_prod.and_then(|s| s.parse().ok()).unwrap_or(0.0);
    let tbg_len = tubing_sabot_depth.map(|sbt| ((sbt - spool).max(0.0) * 100.0).round() / 100.0);
    (liner_len, tbg_len)
}

pub fn save_liner_crepine_params(
    well: &WellData,
    params: &crate::types::CrepineZoneParams,
) -> WellData {
    let (liner_len, tbg_len) = calculate_liner_crepine_header_fields(
        params.top_of_liner,
        params.shoe_depth,
        params.tubing_sabot_depth,
        well.spool_prod.as_deref(),
    );
    let mut updated = well.clone();
    updated.liner_crepine_params = Some(crate::types::CrepineZoneParams {
        top_of_liner: params.top_of_liner,
        shoe_depth: params.shoe_depth,
        diameter: params.diameter.clone(),
        length: liner_len.or(params.length),
        tubing_sabot_depth: params.tubing_sabot_depth,
        tubing_diameter: params.tubing_diameter.clone(),
        tubing_length: tbg_len.or(params.tubing_length),
        observations: params.observations.clone(),
    });
    updated.updated_at = chrono_now_iso();
    updated
}

fn chrono_now_millis() -> u128 {
    use std::time::{SystemTime, UNIX_EPOCH};
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0)
}

fn chrono_now_iso() -> String {
    chrono_now_millis().to_string()
}
