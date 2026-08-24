use std::collections::HashMap;
use std::sync::{OnceLock, RwLock};

use crate::tubing::get_effective_type;
use crate::types::{CustomToolTypeRow, TubingComponentConfig, TubingPreset};

fn matrix_store() -> &'static RwLock<HashMap<String, TubingComponentConfig>> {
    static STORE: OnceLock<RwLock<HashMap<String, TubingComponentConfig>>> = OnceLock::new();
    STORE.get_or_init(|| RwLock::new(minimal_fallback_matrix()))
}

/// Last-resort entries when the database catalogue is empty or offline.
pub fn minimal_fallback_matrix() -> HashMap<String, TubingComponentConfig> {
    let mut m = HashMap::new();
    m.insert(
        "Tubing".to_string(),
        TubingComponentConfig {
            r#type: "Tubing".to_string(),
            default_name: "Tubing 2''7/8".to_string(),
            default_od: "2''7/8".to_string(),
            default_custom_type: "EU".to_string(),
            default_min_id: String::new(),
            french_designation: "Tubing".to_string(),
            french_type: "EU".to_string(),
            render_type: "vector".to_string(),
            vector_type: Some("default".to_string()),
            fill_color: Some("#cbd5e1".to_string()),
            stroke_color: Some("#0f172a".to_string()),
            stroke_width: Some(1.5),
            image_url: None,
            view_box: None,
            main_scale: None,
            print_scale: None,
            min_height: Some(15.0),
        },
    );
    m.insert(
        "Other".to_string(),
        TubingComponentConfig {
            r#type: "Other".to_string(),
            default_name: "Other".to_string(),
            default_od: "2''7/8".to_string(),
            default_custom_type: "EU".to_string(),
            default_min_id: String::new(),
            french_designation: "Other".to_string(),
            french_type: "EU".to_string(),
            render_type: "vector".to_string(),
            vector_type: Some("default".to_string()),
            fill_color: Some("#cbd5e1".to_string()),
            stroke_color: Some("#0f172a".to_string()),
            stroke_width: Some(1.5),
            image_url: None,
            view_box: None,
            main_scale: None,
            print_scale: None,
            min_height: Some(15.0),
        },
    );
    m
}

pub fn image_slug_for_type(type_name: &str, designation: Option<&str>) -> String {
    let t = type_name.to_lowercase();
    let d = designation.unwrap_or("").to_lowercase();
    if t.contains("nipple") || t.contains("seating") || t.contains("siège") || t.contains("siége") || t.contains("siege") || d.contains("siège") || d.contains("siége") || d.contains("siege") {
        return "siege".to_string();
    }
    if t.contains("shoe") || t.contains("sabot") || d.contains("sabot") {
        return "sabot".to_string();
    }
    if t.contains("mandrel") || t.contains("mandrin") || d.contains("mandrin") {
        return "mandrin".to_string();
    }
    if t.contains("packer") || d.contains("packer") {
        return "packer".to_string();
    }
    if t.contains("drill") || d.contains("drill") {
        return "drill".to_string();
    }
    if t.contains("pompe") || t.contains("pump") || d.contains("pompe") || d.contains("pump") {
        return "pompe".to_string();
    }
    if t.contains("moteur") || t.contains("motor") || d.contains("moteur") || d.contains("motor") {
        return "moteur".to_string();
    }
    if t.contains("crépine") || t.contains("crepine") || d.contains("crépine") || d.contains("crepine") || t.contains("screen") || d.contains("screen") {
        return "crépines".to_string();
    }
    if t.contains("sliding") {
        return "sliding-sleeve".to_string();
    }
    if t.contains("fonde") || t.contains("tf") || t.contains("liner") || d.contains("fonde") || d.contains("tf") || d.contains("liner") {
        return "liner".to_string();
    }
    type_name.trim().to_lowercase()
}

pub fn tool_svg_url(type_or_designation: &str) -> String {
    let slug = type_or_designation.trim().to_lowercase();
    if slug.is_empty() {
        return String::new();
    }
    format!("/img/{}.svg", slug)
}

fn infer_render_type(type_name: &str) -> &'static str {
    let t = type_name.to_lowercase();
    if t == "tubing" || t == "other" {
        return "vector";
    }
    if t.contains("reduction") || t.contains("réduction") {
        return "vector";
    }
    if t.contains("anchor-seal") || (t.contains("anchor") && t.contains("seal")) {
        return "vector";
    }
    if t.contains("tailpipe") || t.contains("queue") {
        return "vector";
    }
    if t.contains("tubing court") || t.contains("joint court") || t == "tubing court" {
        return "vector";
    }
    "image"
}

fn infer_vector_type(type_name: &str) -> String {
    let t = type_name.to_lowercase();
    if t.contains("reduction") || t.contains("réduction") {
        return "reduction".to_string();
    }
    if t.contains("anchor") || t.contains("seal") {
        return "anchor-seal".to_string();
    }
    if t.contains("sliding") {
        return "sliding-sleeve".to_string();
    }
    if t.contains("tailpipe") || t.contains("queue") {
        return "tailpipe".to_string();
    }
    if t.contains("court") || t.contains("pup") {
        return "tubing-court".to_string();
    }
    "default".to_string()
}

fn infer_view_box(type_name: &str) -> String {
    let _t = type_name.to_lowercase();
    "0 0 300 220".to_string()
}

fn infer_min_height(type_name: &str, render_type: &str) -> f64 {
    let t = type_name.to_lowercase();
    if t.contains("packer") || t.contains("mandrel") || t.contains("pompe") || t.contains("moteur") {
        return 35.0;
    }
    if t.contains("sliding") || t.contains("crépine") || t.contains("crepine") {
        return 30.0;
    }
    if t.contains("nipple") || t.contains("shoe") || t.contains("drill") || t.contains("anchor") {
        return 25.0;
    }
    if t.contains("reduction") {
        return 20.0;
    }
    if render_type == "image" {
        20.0
    } else {
        15.0
    }
}

/// Build one schematic config from a `custom_tool_types` database row.
pub fn config_from_db_row(row: &CustomToolTypeRow) -> TubingComponentConfig {
    let type_name = row.r#type.trim().to_string();
    let designation = row
        .french_designation
        .clone()
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| row.default_name.clone().unwrap_or_else(|| type_name.clone()));
    let render_type = infer_render_type(&type_name);
    let is_image = render_type == "image";
    let image_slug = image_slug_for_type(&type_name, Some(designation.as_str()));

    TubingComponentConfig {
        r#type: type_name.clone(),
        default_name: row
            .default_name
            .clone()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| type_name.clone()),
        default_od: row
            .default_od
            .clone()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "2''7/8".to_string()),
        default_custom_type: row
            .default_custom_type
            .clone()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "EU".to_string()),
        default_min_id: row.default_min_id.clone().unwrap_or_default(),
        french_designation: designation,
        french_type: row
            .default_custom_type
            .clone()
            .filter(|s| !s.trim().is_empty())
            .unwrap_or_else(|| "EU".to_string()),
        render_type: render_type.to_string(),
        vector_type: Some(infer_vector_type(&type_name)),
        fill_color: Some(if is_image {
            "#cbd5e1".to_string()
        } else if type_name.to_lowercase().contains("reduction") {
            "#64748b".to_string()
        } else {
            "#cbd5e1".to_string()
        }),
        stroke_color: Some("#0f172a".to_string()),
        stroke_width: Some(1.5),
        image_url: if is_image {
            Some(tool_svg_url(&image_slug))
        } else {
            None
        },
        view_box: if is_image {
            Some(infer_view_box(&type_name))
        } else {
            None
        },
        main_scale: if is_image { Some(0.25) } else { None },
        print_scale: if is_image { Some(0.25) } else { None },
        min_height: Some(infer_min_height(&type_name, render_type)),
    }
}

/// Build the full matrix from database catalogue rows (+ minimal fallbacks).
pub fn build_matrix_from_db(rows: &[CustomToolTypeRow]) -> HashMap<String, TubingComponentConfig> {
    let mut matrix = minimal_fallback_matrix();
    for row in rows {
        if row.r#type.trim().is_empty() {
            continue;
        }
        let config = config_from_db_row(row);
        matrix.insert(row.r#type.clone(), config);
    }
    matrix
}

/// Active matrix loaded from Supabase (updated on app start / catalogue changes).
pub fn active_tubing_component_matrix() -> HashMap<String, TubingComponentConfig> {
    matrix_store()
        .read()
        .map(|g| g.clone())
        .unwrap_or_else(|_| minimal_fallback_matrix())
}

/// @deprecated — use `active_tubing_component_matrix`
pub fn builtin_tubing_component_matrix() -> HashMap<String, TubingComponentConfig> {
    active_tubing_component_matrix()
}

pub fn update_tubing_component_matrix(rows: &[CustomToolTypeRow]) -> HashMap<String, TubingComponentConfig> {
    let matrix = build_matrix_from_db(rows);
    if let Ok(mut guard) = matrix_store().write() {
        *guard = matrix.clone();
    }
    matrix
}

pub fn get_tubing_type_defaults(
    type_name: &str,
    matrix: &HashMap<String, TubingComponentConfig>,
) -> TubingPreset {
    if let Some(config) = matrix.get(type_name) {
        return TubingPreset {
            default_name: config.default_name.clone(),
            default_od: config.default_od.clone(),
            default_custom_type: config.default_custom_type.clone(),
            default_min_id: config.default_min_id.clone(),
        };
    }
    TubingPreset {
        default_name: type_name.to_string(),
        default_od: "2''7/8".to_string(),
        default_custom_type: "EU".to_string(),
        default_min_id: String::new(),
    }
}

pub fn get_french_designation(
    type_name: &str,
    name: &str,
    matrix: &HashMap<String, TubingComponentConfig>,
) -> String {
    let effective = get_effective_type(type_name, name);
    if let Some(config) = matrix.get(&effective) {
        return config.french_designation.clone();
    }
    let key = matrix
        .keys()
        .find(|k| k.eq_ignore_ascii_case(&effective))
        .cloned();
    if let Some(k) = key {
        if let Some(config) = matrix.get(&k) {
            return config.french_designation.clone();
        }
    }
    fallback_french_designation(type_name, name)
}

pub fn get_french_type(
    type_name: &str,
    name: &str,
    matrix: &HashMap<String, TubingComponentConfig>,
) -> String {
    let effective = get_effective_type(type_name, name);
    if let Some(config) = matrix.get(&effective) {
        return config.french_type.clone();
    }
    let key = matrix
        .keys()
        .find(|k| k.eq_ignore_ascii_case(&effective))
        .cloned();
    if let Some(k) = key {
        if let Some(config) = matrix.get(&k) {
            return config.french_type.clone();
        }
    }
    fallback_french_type(type_name, name)
}

fn fallback_french_designation(type_name: &str, name: &str) -> String {
    let t = type_name.to_lowercase();
    let n = name.to_lowercase();
    if t.contains("shoe") || n.contains("sabot") {
        return "Sabot".into();
    }
    if t.contains("nipple") || n.contains("siege") || n.contains("siége") {
        return "Siège".into();
    }
    if t.contains("packer") || n.contains("packer") {
        return "Packer".into();
    }
    if t.contains("mandrel") || n.contains("mandrin") {
        return "Mandrin".into();
    }
    if t.contains("anchor") || n.contains("anchor") || n.contains("seal") {
        return "Anchor-seal".into();
    }
    if t.contains("reduction") || n.contains("reduc") || n.contains("réduction") {
        return "Réduction".into();
    }
    if n.contains("olive") {
        return "Olive".into();
    }
    if t.contains("tubing") {
        return "Tubing".into();
    }
    if t.contains("sliding sleeve") {
        return "Sliding Sleeve".into();
    }
    if name.is_empty() {
        "Tubing".into()
    } else {
        name.to_string()
    }
}

fn fallback_french_type(type_name: &str, name: &str) -> String {
    let t = type_name.to_lowercase();
    let n = name.to_lowercase();
    if t.contains("shoe") || n.contains("sabot") {
        return "EU".into();
    }
    if t.contains("nipple") || n.contains("siege") || n.contains("siége") {
        return "D".into();
    }
    if t.contains("packer") || n.contains("packer") {
        return "D".into();
    }
    if t.contains("mandrel") || n.contains("mandrin") {
        return "SMO-1".into();
    }
    if t.contains("anchor") || n.contains("anchor") || n.contains("seal") {
        return "E22".into();
    }
    if n.contains("olive") {
        return "CTC".into();
    }
    "EU".into()
}
