pub fn parse_size_to_number(size: &serde_json::Value) -> f64 {
    match size {
        serde_json::Value::Number(n) => n.as_f64().unwrap_or(0.0),
        serde_json::Value::String(s) => parse_size_str(s),
        _ => 0.0,
    }
}

pub fn parse_size_str(size_str: &str) -> f64 {
    let s = size_str.replace(['"', '\''], " ").trim().to_string();
    let mut total = 0.0;
    for part in s.split_whitespace() {
        if part.contains('/') {
            let mut split = part.split('/');
            let num: f64 = split.next().and_then(|v| v.replace(',', ".").parse().ok()).unwrap_or(0.0);
            let den: f64 = split.next().and_then(|v| v.replace(',', ".").parse().ok()).unwrap_or(1.0);
            if den != 0.0 {
                total += num / den;
            }
        } else {
            total += part.replace(',', ".").parse::<f64>().unwrap_or(0.0);
        }
    }
    total
}

pub fn format_depth(val: Option<f64>) -> String {
    let Some(num) = val else {
        return String::new();
    };
    if num.is_nan() {
        return String::new();
    }
    let formatted = format!("{:.2}", num);
    formatted.trim_end_matches(".00").to_string()
}

pub fn format_casing_size(size: &serde_json::Value) -> String {
    let num = match size {
        serde_json::Value::Number(n) => n.as_f64().unwrap_or(f64::NAN),
        serde_json::Value::String(s) => s.parse::<f64>().unwrap_or(f64::NAN),
        _ => f64::NAN,
    };
    if num.is_nan() {
        return size.to_string();
    }
    let integer_part = num.floor();
    let decimal_part = ((num - integer_part) * 1000.0).round() / 1000.0;
    if decimal_part == 0.0 {
        return format!("{}\"", integer_part as i64);
    }
    let fractions = [
        (0.125, "1/8"),
        (0.25, "1/4"),
        (0.375, "3/8"),
        (0.5, "1/2"),
        (0.625, "5/8"),
        (0.75, "3/4"),
        (0.875, "7/8"),
    ];
    for (value, label) in fractions {
        if (decimal_part - value).abs() < 0.001 {
            return format!("{}\"{}", integer_part as i64, label);
        }
    }
    format!("{}\"", num)
}
