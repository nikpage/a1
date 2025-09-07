// utils/formatAnalysis.js

const REQUIRED_SCHEMA = {
  summary: "",
  cv_data: {
    Name: "",
    Seniority: "",
    Industry: "",
    Country: ""
  },
  job_data: {
    Position: "n/a",
    Seniority: "n/a",
    Company: "n/a",
    Industry: "n/a",
    Country: "n/a",
    "HR Contact": "n/a"
  },
  jobs_extracted: [],
  analysis: {
    overall_score: "0-10",
    ats_score: "0-10",
    scenario_tags: [],
    cv_format_analysis: "",
    cultural_fit: "",
    red_flags: "",
    overall_commentary: "",
    suitable_positions: "",
    career_arc: "",
    parallel_experience: "",
    transferable_skills: "",
    style_wording: "",
    ats_keywords: "",
    action_items: {
      cv_changes: {
        critical: [],
        advised: [],
        optional: []
      },
      "Cover Letter": {
        "Points to Address": [],
        "Narrative Flow": [],
        "Tone and Style": []
      }
    }
  },
  job_match: {
    keyword_match: "n/a",
    inferred_keywords: "n/a",
    career_scenario: "n/a",
    positioning_strategy: "n/a"
  },
  final_thought: ""
};

function extractFirstJsonObject(text) {
  const str = String(text ?? "");
  const start = str.indexOf("{");
  if (start < 0) return null;

  let depth = 0, inString = false, escape = false;
  for (let i = start; i < str.length; i++) {
    const ch = str[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (ch === "\\") {
        escape = true;
      } else if (ch === "\"") {
        inString = false;
      }
    } else {
      if (ch === "\"") {
        inString = true;
      } else if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth === 0) return str.slice(start, i + 1);
      }
    }
  }
  return null;
}

function safeParse(raw) {
  try { return JSON.parse(raw); } catch {}
  const candidate = extractFirstJsonObject(raw);
  if (candidate) {
    try { return JSON.parse(candidate); } catch {}
  }
  throw new Error("Invalid JSON input");
}

function normalizeString(s) {
  return String(s ?? "").trim().replace(/^•\s*•\s*/gm, "• ");
}

function deepNormalize(value) {
  if (Array.isArray(value)) return value.map(deepNormalize);
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = deepNormalize(v);
    return out;
  }
  if (typeof value === "string") return normalizeString(value);
  if (value === null || value === undefined) return "";
  return value;
}

// Map model outputs into our strict schema
function remapFields(parsed) {
  const out = { ...parsed };

  // Handle employment history → jobs_extracted
  if (Array.isArray(parsed.employment_experiences)) {
    out.jobs_extracted = parsed.employment_experiences;
  } else if (Array.isArray(parsed.employment_history)) {
    out.jobs_extracted = parsed.employment_history;
  } else if (Array.isArray(parsed.jobs)) {
    out.jobs_extracted = parsed.jobs;
  }

  // Handle CV basics
  if (parsed.name || parsed.full_name) {
    out.cv_data = out.cv_data || {};
    out.cv_data.Name = parsed.name || parsed.full_name;
  }
  if (parsed.seniority || parsed.level) {
    out.cv_data = out.cv_data || {};
    out.cv_data.Seniority = parsed.seniority || parsed.level;
  }
  if (parsed.industry) {
    out.cv_data = out.cv_data || {};
    out.cv_data.Industry = parsed.industry;
  }
  if (parsed.country) {
    out.cv_data = out.cv_data || {};
    out.cv_data.Country = parsed.country;
  }

  // Handle job ad
  if (parsed.job_ad) {
    out.job_data = out.job_data || {};
    out.job_data.Position = parsed.job_ad.position || out.job_data.Position;
    out.job_data.Company = parsed.job_ad.company || out.job_data.Company;
    out.job_data.Industry = parsed.job_ad.industry || out.job_data.Industry;
    out.job_data.Country = parsed.job_ad.country || out.job_data.Country;
    out.job_data["HR Contact"] = parsed.job_ad.hr_contact || out.job_data["HR Contact"];
  }

  return out;
}

function applySchema(schema, data) {
  if (Array.isArray(schema)) {
    const arr = Array.isArray(data) ? data : [];
    return arr.map((item) => deepNormalize(item));
  }
  if (schema && typeof schema === "object") {
    const out = {};
    for (const key of Object.keys(schema)) {
      const val = data && Object.prototype.hasOwnProperty.call(data, key) ? data[key] : undefined;
      out[key] = applySchema(schema[key], val);
    }
    return out;
  }
  return data !== undefined ? deepNormalize(data) : schema;
}

export function formatAnalysis(rawJson) {
  const parsed = safeParse(rawJson);
  const remapped = remapFields(parsed);
  const normalized = applySchema(REQUIRED_SCHEMA, remapped);

  // Clean HR Contact
  if (normalized.job_data && normalized.job_data["HR Contact"]) {
    normalized.job_data["HR Contact"] =
      String(normalized.job_data["HR Contact"]).split(",")[0].trim();
  }

  // Normalize Czechia
  if (normalized.cv_data && typeof normalized.cv_data.Country === "string") {
    if (normalized.cv_data.Country.includes("Czechia")) {
      normalized.cv_data.Country = "Czechia";
    }
  }

  return JSON.stringify(normalized, null, 2);
}
