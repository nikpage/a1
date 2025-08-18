// prompts/analysis.js
// Purpose: Build a tightly-scoped prompt that pairs cleanly with utils/formatting-util.js
// Exports: buildAnalysisPrompt(cvText, jobText, hasJobText)
// Notes:
// - Produces a system + user message with a compact, JSON-only schema.
// - Keeps language fidelity: detect CV language and respond ONLY in that language.
// - No markdown, no bullet symbols. Plain text paragraphs only.

export function buildAnalysisPrompt(cvText, jobText = "", hasJobText = false) {
  const systemMessage = {
    role: "system",
    content:
      [
        "You are an expert HR strategist and CV analyst.",
        "Your job is to produce a precise, professional evaluation of a candidate's CV",
        "against an optional job advertisement. Quality first. No fluff.",
        "",
        "STRICT OUTPUT RULES:",
        "1) Detect the CV language and write ALL output in that language (default English if unclear).",
        "2) Output MUST be valid JSON. No preamble, no code fences, no commentary.",
        "3) No markdown, no bullet symbols (•, -, *, #). Use plain sentences/lines.",
        "4) Keep content concise and factual. Avoid generic filler.",
        "",
        "SCHEMA (keys must exist; empty arrays/objects allowed):",
        "{",
        '  "summary": string,',
        '  "analysis": {',
        '    "overall_commentary": string,',
        '    "red_flags": string[],',
        '    "suitable_positions": string[]',
        "  },",
        '  "action_items": {',
        '    "cv_changes": {',
        '      "critical": string[],',
        '      "recommended": string[]',
        "    }",
        "  },",
        '  "job_match": {',
        '    "fit_summary": string,',
        '    "key_gaps": string[]',
        "  },",
        '  "generation_framework": {',
        '    "language": string,',
        '    "version": "v1"',
        "  },",
        '  "job_data": {',
        '    "title": string,',
        '    "company": string,',
        '    "location": string,',
        '    "seniority": string',
        "  }",
        "}",
        "",
        "CONSTRAINTS:",
        "- Keep lists focused (max ~6 items per list).",
        "- Avoid repeating the same sentence with different wording.",
        "- Dates: prefer YYYY or YYYY-MM if you must mention them.",
      ].join("\n"),
  };

  const jobBlock = hasJobText
    ? [
        "Job Advertisement (verbatim):",
        jobText,
        "",
        "If the job ad is weak/missing data, set unknown fields in job_data to \"n/a\".",
      ].join("\n")
    : "No job ad provided. Fill job_data fields with \"n/a\".";

  const userMessage = {
    role: "user",
    content:
      [
        "// STEP 0: DETECT LANGUAGE",
        "Detect the CV's language and produce ALL output in that language.",
        "",
        "// STEP 1: ANALYSE & RESPOND IN STRICT JSON (no markdown, no bullets, no code fences), using the schema above.",
        "",
        "CV (verbatim):",
        cvText,
        "",
        jobBlock,
      ].join("\n"),
  };

  return [systemMessage, userMessage];
}
