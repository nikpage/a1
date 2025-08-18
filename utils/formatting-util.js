// utils/formatting-util.js
//
// Purpose: Make the LLM's analysis JSON safe to consume without changing its meaning.
// Priorities (strict): 1) preserve output quality, 2) be fast, 3) avoid extra tokens.
// Scope: formatting + light validation only. No content rewrites, no bullet injection.

function isObject(x) {
  return x !== null && typeof x === "object" && !Array.isArray(x);
}

const hasMarkdownChars = (s) => /[*_\[\]`>#]/.test(s);

function stripCodeFences(input) {
  // Removes ```json ... ``` or ``` ... ``` fences and leading/trailing backticks
  let s = String(input).trim();
  // Triple backtick fences
  const fenceMatch = s.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fenceMatch) return fenceMatch[1].trim();
  // Single backticks around the whole payload (rare but seen)
  const tickMatch = s.match(/^`([\s\S]*?)`$/);
  if (tickMatch) return tickMatch[1].trim();
  return s;
}

function removeMarkdownSyntax(s) {
  // Conservative: only strip obvious leading markers; preserve newlines and spacing.
  // Do NOT collapse whitespace or inject bullets. Keep the author's original flow.
  let out = s;

  // Strip leading list markers at line starts: -, *, •, digits.
  out = out.replace(/^[\s]*([-*•]|\d+\.)\s+/gm, "");
  // Strip leading blockquote markers
  out = out.replace(/^[\s]*>\s?/gm, "");
  // Strip heading markers
  out = out.replace(/^[\s]*#{1,6}\s+/gm, "");
  // Remove inline code backticks (keep content)
  out = out.replace(/`([^`]+)`/g, "$1");
  // Remove remaining stray markdown emphasis markers when they wrap words
  out = out.replace(/\*([^\*\n]+)\*/g, "$1");
  out = out.replace(/_([^_\n]+)_/g, "$1");
  // Preserve newlines; no global whitespace collapsing.
  return out;
}

function cleanStringMaybe(s) {
  if (typeof s !== "string") return s;
  if (!hasMarkdownChars(s)) return s; // fast path
  return removeMarkdownSyntax(s);
}

function deepCleanAndValidate(node, path = [], issues = []) {
  // Returns { value, issues } where value is cleaned clone of node.
  if (typeof node === "string") {
    return { value: cleanStringMaybe(node), issues };
  }

  if (Array.isArray(node)) {
    const arr = new Array(node.length);
    for (let i = 0; i < node.length; i++) {
      const { value } = deepCleanAndValidate(node[i], path.concat(i), issues);
      arr[i] = value;
    }
    return { value: arr, issues };
  }

  if (isObject(node)) {
    const out = {};
    for (const [k, v] of Object.entries(node)) {
      const { value } = deepCleanAndValidate(v, path.concat(k), issues);
      out[k] = value;
    }
    return { value: out, issues };
  }

  // Primitives other than string
  return { value: node, issues };
}

function parseMaybe(raw) {
  if (isObject(raw)) return { obj: raw, error: null };

  if (typeof raw === "string") {
    const unwrapped = stripCodeFences(raw);
    try {
      const obj = JSON.parse(unwrapped);
      return { obj, error: null };
    } catch (e) {
      return {
        obj: { _error: "Invalid JSON from model", _raw: unwrapped.slice(0, 2000) },
        error: e,
      };
    }
  }

  return {
    obj: { _error: "Unsupported input type", _raw_type: typeof raw },
    error: new Error("Unsupported input type"),
  };
}

// Light structural validator tailored to the prompt schema
function validateJSONStructure(analysis) {
  const issues = [];

  const expectString = (val, keyPath) => {
    if (typeof val !== "string") issues.push(`${keyPath} should be a string`);
    else if (!val.trim()) issues.push(`${keyPath} is empty`);
  };
  const expectArray = (val, keyPath) => {
    if (!Array.isArray(val)) issues.push(`${keyPath} should be an array`);
  };
  const expectObject = (val, keyPath) => {
    if (!isObject(val)) issues.push(`${keyPath} should be an object`);
  };

  // Root keys
  if (!("summary" in analysis)) issues.push("summary is missing");
  if (!("analysis" in analysis)) issues.push("analysis is missing");
  if (!("action_items" in analysis)) issues.push("action_items is missing");
  if (!("job_match" in analysis)) issues.push("job_match is missing");
  if (!("generation_framework" in analysis)) issues.push("generation_framework is missing");
  if (!("job_data" in analysis)) issues.push("job_data is missing");

  if ("summary" in analysis) expectString(analysis.summary, "summary");

  if ("analysis" in analysis) {
    expectObject(analysis.analysis, "analysis");
    if (isObject(analysis.analysis)) {
      if (!("overall_commentary" in analysis.analysis))
        issues.push("analysis.overall_commentary is missing");
      else expectString(analysis.analysis.overall_commentary, "analysis.overall_commentary");

      if (!("red_flags" in analysis.analysis)) issues.push("analysis.red_flags is missing");
      else expectArray(analysis.analysis.red_flags, "analysis.red_flags");

      if (!("suitable_positions" in analysis.analysis))
        issues.push("analysis.suitable_positions is missing");
      else expectArray(analysis.analysis.suitable_positions, "analysis.suitable_positions");
    }
  }

  if ("action_items" in analysis) {
    expectObject(analysis.action_items, "action_items");
    if (isObject(analysis.action_items)) {
      if (!("cv_changes" in analysis.action_items))
        issues.push("action_items.cv_changes is missing");
      else if (!isObject(analysis.action_items.cv_changes))
        issues.push("action_items.cv_changes should be an object");
      else {
        const cc = analysis.action_items.cv_changes;
        if (!("critical" in cc)) issues.push("action_items.cv_changes.critical is missing");
        else expectArray(cc.critical, "action_items.cv_changes.critical");
        if (!("recommended" in cc)) issues.push("action_items.cv_changes.recommended is missing");
        else expectArray(cc.recommended, "action_items.cv_changes.recommended");
      }
    }
  }

  if ("job_match" in analysis) {
    expectObject(analysis.job_match, "job_match");
    if (isObject(analysis.job_match)) {
      if (!("fit_summary" in analysis.job_match)) issues.push("job_match.fit_summary is missing");
      else expectString(analysis.job_match.fit_summary, "job_match.fit_summary");
      if (!("key_gaps" in analysis.job_match)) issues.push("job_match.key_gaps is missing");
      else expectArray(analysis.job_match.key_gaps, "job_match.key_gaps");
    }
  }

  if ("generation_framework" in analysis) {
    expectObject(analysis.generation_framework, "generation_framework");
    if (isObject(analysis.generation_framework)) {
      if (!("language" in analysis.generation_framework))
        issues.push("generation_framework.language is missing");
      else expectString(analysis.generation_framework.language, "generation_framework.language");

      if (!("version" in analysis.generation_framework))
        issues.push("generation_framework.version is missing");
      else if (analysis.generation_framework.version !== "v1")
        issues.push("generation_framework.version should be \"v1\"");
    }
  }

  if ("job_data" in analysis) {
    expectObject(analysis.job_data, "job_data");
    if (isObject(analysis.job_data)) {
      ["title", "company", "location", "seniority"].forEach((k) => {
        if (!(k in analysis.job_data)) issues.push(`job_data.${k} is missing`);
        else expectString(analysis.job_data[k], `job_data.${k}`);
      });
    }
  }

  return { issues };
}

export function formatAnalysisOutput(raw) {
  const { obj } = parseMaybe(raw);

  // If we failed to parse, return the error object as-is (non-throwing behavior)
  if (obj && obj._error) return obj;

  // Single-pass clean
  const { value: cleaned, issues: _ } = deepCleanAndValidate(obj);

  // Attach structural issues for the caller to inspect (non-destructive)
  const { issues } = validateJSONStructure(cleaned);
  if (issues.length) {
    return { ...cleaned, _issues: issues };
  }
  return cleaned;
}

export function validateOutput(analysis) {
  const issues = [];

  // Basic expectations beyond structure (kept minimal; no rewriting)
  if (typeof analysis !== "object" || analysis === null) {
    return { isValid: false, issues: ["Output is not an object"] };
  }

  // No markdown/bullets check on key strings (spot check to avoid O(n) scans)
  const suspect = [];
  const checkString = (val, key) => {
    if (typeof val === "string" && /[*•`#>-]/.test(val)) suspect.push(key);
  };
  checkString(analysis.summary, "summary");
  if (analysis.analysis && typeof analysis.analysis === "object") {
    checkString(analysis.analysis.overall_commentary, "analysis.overall_commentary");
  }
  if (suspect.length) {
    issues.push(`Possible markdown/bullets detected in: ${suspect.join(", ")}`);
  }

  // Structural validation
  const structural = validateJSONStructure(analysis);
  issues.push(...structural.issues);

  return { isValid: issues.length === 0, issues };
}
