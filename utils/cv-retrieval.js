// utils/cv-retrieval.js
//
// RETRIEVAL: which parts of this candidate's record answer THIS ad.
//
// The defect it exists to fix is mechanical, not stylistic. Every letter and CV
// is written from the whole master — the same ~10,000 characters for every job,
// with the ad a few hundred characters buried inside. The writer's input barely
// varies between applications, so neither does its output. No prompt change
// fixes an input that does not change.
//
// So: the record is indexed once (utils/cv-chunks.js + cv_chunks), and at write
// time each of the ad's requirements retrieves the pieces of the record that
// actually answer it. The pattern is the RFP content library — approved answer
// text retrieved per incoming requirement — which is how that industry reaches
// 60-80% content reuse.
//
// TWO PROPERTIES ARE LOAD-BEARING:
//
// 1. IT NEVER FAILS A RUN. A missing index, an embedding error, a migration not
//    yet applied — all degrade to "no retrieval", and the caller falls back to
//    the whole master, which is exactly today's behaviour. Retrieval is an
//    improvement on the status quo and must never be a new way to lose a paid
//    generation.
//
// 2. IT ADDS NO FACT. Chunks are verbatim substrings of the master with their
//    role header attached. Retrieval SELECTS; it never rewrites. So every
//    downstream truth check (the verify pass, Layer 6) still holds against the
//    same record it always did.

import { embedTexts } from './openai.js';
import { chunkMaster } from './cv-chunks.js';
import { saveCvChunks, matchCvChunks } from './database.js';
import { logger } from '../lib/logger.js';

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const arr = (v) => (Array.isArray(v) ? v : []);

/**
 * Build (or rebuild) a user's retrieval index from their master CV.
 *
 * Called after the master is built or edited — the two moments the record
 * changes. One embedding call for the whole record; on the order of a hundred
 * chunks, so cents.
 *
 * @returns {Promise<{count:number, gemini_usage:object|null}>}
 */
export async function indexMaster(user_id, master) {
  const chunks = chunkMaster(master);
  if (!chunks.length) {
    logger.info('[retrieval] nothing to index for this record');
    return { count: 0, gemini_usage: null };
  }

  const { vectors, gemini_usage } = await embedTexts(
    chunks.map((c) => c.text),
    { label: 'embed record' }
  );

  // A chunk whose vector came back null is stored WITHOUT one rather than
  // dropped: the row stays visible in the index, and match_cv_chunks skips
  // null embeddings. A silently missing chunk is worse than an unsearchable one.
  const withVectors = chunks.map((c, i) => ({ ...c, embedding: vectors[i] || null }));

  await saveCvChunks(user_id, withVectors);

  const embedded = withVectors.filter((c) => c.embedding).length;
  logger.info(`[retrieval] indexed ${embedded}/${chunks.length} chunks`);
  return { count: embedded, gemini_usage };
}

/**
 * The parts of the record that answer this ad's requirements.
 *
 * One embedding call for all requirements together, then one cheap vector
 * search per requirement. Nothing about the ad is stored — it is a query.
 *
 * @param {string}   user_id
 * @param {string[]} requirements   - the ad's asks (job_extraction), in its own words
 * @param {object}   opts           - { perRequirement = 3, minSimilarity = 0.3 }
 * @returns {Promise<{groups: Array<{requirement:string, chunks:Array}>, chunks:Array, gemini_usage:object|null}>}
 */
export async function retrieveForRequirements(user_id, requirements, opts = {}) {
  const { perRequirement = 3, minSimilarity = 0.3 } = opts;
  const asks = arr(requirements).map(str).filter(Boolean);

  const empty = { groups: [], chunks: [], gemini_usage: null };
  if (!user_id || !asks.length) return empty;

  let vectors = [];
  let gemini_usage = null;
  try {
    ({ vectors, gemini_usage } = await embedTexts(asks, { label: 'embed requirements' }));
  } catch (e) {
    // Property 1: never fail the run. The caller falls back to the full master.
    logger.error('[retrieval] could not embed the requirements, falling back to the full record:', e.message);
    return empty;
  }

  const groups = [];
  // Every chunk retrieved, once, in best-match order — this is what the writer
  // is handed. The same piece of work often answers two requirements, and
  // handing it over twice wastes a slot that a different piece of evidence
  // needed.
  const bestById = new Map();

  for (let i = 0; i < asks.length; i++) {
    const vec = vectors[i];
    if (!vec) continue;

    const rows = await matchCvChunks(user_id, vec, perRequirement);
    const hits = rows
      .filter((r) => typeof r?.similarity !== 'number' || r.similarity >= minSimilarity)
      .map((r) => ({
        id: r.chunk_id,
        kind: r.kind,
        source: r.source,
        header: r.header,
        text: r.text,
        similarity: r.similarity
      }));

    // A requirement the record cannot answer returns NOTHING, and that is a
    // result, not a failure: an unanswered ask is honest, and the prompts
    // already say to stay silent on it. Never pad the group to a fixed size.
    if (hits.length) groups.push({ requirement: asks[i], chunks: hits });

    for (const h of hits) {
      const prev = bestById.get(h.id);
      if (!prev || (h.similarity || 0) > (prev.similarity || 0)) bestById.set(h.id, h);
    }
  }

  const chunks = [...bestById.values()].sort((a, b) => (b.similarity || 0) - (a.similarity || 0));
  return { groups, chunks, gemini_usage };
}

/**
 * The retrieved evidence, rendered for a prompt.
 *
 * Grouped BY REQUIREMENT, because that is the pairing the writer needs and the
 * thing the whole-master dump could never express: this is what they asked for,
 * and this is the real work that answers it. Provenance (`source`) rides along
 * so a claim can be traced back.
 */
export function retrievedEvidenceBlock(groups) {
  const list = arr(groups).filter((g) => str(g?.requirement) && arr(g?.chunks).length);
  if (!list.length) return '';

  const lines = list.map((g) => {
    const evidence = g.chunks.map((c) => `    - ${str(c.text)}`).join('\n');
    return `- THEY ASK: ${str(g.requirement)}\n  THE RECORD ANSWERS:\n${evidence}`;
  });

  return `
# What this employer asked for, and the real work in this candidate's record that answers it

These are pulled from the candidate's own record by matching it against this ad. They are VERBATIM record — facts, not phrasing to reuse. An ask that appears here with nothing under it, or that is missing entirely, is one the record does not answer: say nothing about it at all.

${lines.join('\n')}
`;
}
