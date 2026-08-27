// utils/cv-chunks.js
//
// THE RECORD, CUT INTO RETRIEVABLE PIECES.
//
// Why this exists: every letter and every CV is currently written from the WHOLE
// master, JSON.stringify'd — the same ~10,000 characters handed to the writer for
// every job. The ad is a few hundred characters buried inside it. That is the
// mechanical cause of every letter reading the same, and no prompt change fixes
// an input that does not vary.
//
// So the record is cut into pieces that can be SEARCHED, and the writer is handed
// only the pieces this ad's requirements actually match. The analogue is the RFP
// content library — a firm's approved answer text, retrieved per incoming
// requirement rather than pasted whole — which is how that industry works and
// where its 60-80% content reuse comes from.
//
// TWO RULES GOVERN THE CUT:
//
// 1. A CHUNK STANDS ALONE. A bullet retrieved without its employer and dates is
//    an orphan fact: the writer cannot say where it happened, and T2 forbids
//    guessing. So every bullet chunk carries its own role header. This is the
//    standard "contextual chunk" shape and it is not optional here — the
//    provenance rules downstream depend on it.
//
// 2. A CHUNK IS VERBATIM RECORD. Nothing here summarises, rephrases or merges.
//    The chunker is pure string assembly over normaliseMaster's output, so a
//    chunk cannot contain a fact the master does not, and `source` names exactly
//    where each came from. No AI call happens in this file.
//
// The output feeds utils/cv-chunks-store.js (embedding + Supabase) and is
// testable on its own: __tests__/cv-chunks.test.js.

const str = (v) => (typeof v === 'string' ? v.trim() : '');
const arr = (v) => (Array.isArray(v) ? v : []);

// "Head of Product at Salsita (03/2019 - 06/2022, Prague)" — the header every
// bullet from that role carries. Dates and employer are verbatim from the
// master; a missing piece is omitted rather than filled in.
export function roleHeader(role) {
  const title = str(role?.title);
  const company = str(role?.company) || str(role?.organization);
  const dates = [str(role?.start_date), str(role?.end_date)].filter(Boolean).join(' - ');
  const where = [dates, str(role?.location)].filter(Boolean).join(', ');

  const who = [title, company].filter(Boolean).join(' at ');
  return where ? `${who} (${where})` : who;
}

// A stable id for a chunk, so a re-chunk of an unchanged record produces the
// same rows and the store can tell what actually changed. Deliberately built
// from the record's own content, not from array position: inserting a role
// must not renumber every chunk after it.
const slug = (s) =>
  str(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);

function push(out, { kind, source, header, body }) {
  const text = [str(header), str(body)].filter(Boolean).join(' — ');
  if (!text) return;
  out.push({
    kind,
    source,
    id: `${kind}:${slug(source)}:${slug(body).slice(0, 40)}`,
    header: str(header),
    text
  });
}

// One role's chunks: a summary chunk naming the role and what it was, plus one
// chunk per bullet. Both kinds are wanted — a requirement about a KIND of job
// matches the summary, a requirement about a specific piece of work matches its
// bullet, and retrieving only one granularity misses half the record.
function chunkRole(out, role, { kind = 'role', parent = '' } = {}) {
  const header = roleHeader(role);
  if (!header) return;
  const source = parent ? `${parent} > ${header}` : header;

  const bullets = arr(role?.bullets).map(str).filter(Boolean);

  // The summary chunk answers "have they done this KIND of work" — it is the
  // role itself, not its first bullet. It must NOT reuse bullets[0]: that made
  // its text byte-identical to that bullet's own chunk, and the dedup below then
  // dropped the bullet, silently costing the record its first achievement in
  // every role. Caught by __tests__/cv-chunks.test.js.
  push(out, { kind: `${kind}-summary`, source, header, body: '' });

  for (const b of bullets) {
    push(out, { kind, source, header, body: b });
  }

  // A client engagement under the candidate's own practice. It is chunked in its
  // OWN right and names its parent: the log records a CV generated for a Bitcoin
  // company that carried no crypto work at all, because three crypto engagements
  // sat nested under an umbrella and the writer collapsed the entry. A nested
  // engagement that cannot be retrieved on its own repeats exactly that defect.
  for (const child of arr(role?.fractional_engagements)) {
    chunkRole(out, child, { kind: 'engagement', parent: header });
  }
}

// One talk. Subject-bearing and often the strongest evidence the record holds
// for a job about presenting, teaching or advocating — the 2017 lectureship the
// log records as the right proof for a job about presenting to teachers.
function chunkTalk(out, talk) {
  const event = str(talk?.event);
  const topic = str(talk?.topic);
  const header = [str(talk?.role), event].filter(Boolean).join(', ');
  const where = [str(talk?.location), str(talk?.year)].filter(Boolean).join(' ');

  push(out, {
    kind: 'speaking',
    source: [event, where].filter(Boolean).join(' ') || event || topic,
    header: [header, where].filter(Boolean).join(', '),
    body: topic
  });
}

/**
 * Cut a normalised master CV into retrievable chunks.
 *
 * Pure: no AI, no network, no DB. Same master in, same chunks out.
 *
 * @param {object} master - normaliseMaster() output
 * @returns {Array<{id,kind,source,header,text}>}
 */
export function chunkMaster(master) {
  const out = [];
  if (!master || typeof master !== 'object') return out;

  for (const role of arr(master.work_experience)) chunkRole(out, role);
  for (const role of arr(master.advisory_and_community)) {
    chunkRole(out, role, { kind: 'advisory' });
  }
  for (const talk of arr(master.speaking_and_lecturing)) chunkTalk(out, talk);

  for (const pub of arr(master.publications_and_patents).map(str).filter(Boolean)) {
    push(out, { kind: 'publication', source: pub, header: 'Publication', body: pub });
  }

  // De-duplicate: two roles at one employer can restate a bullet, and an
  // identical chunk retrieved twice wastes a slot the writer needed for a
  // different piece of evidence.
  const seen = new Set();
  return out.filter((c) => {
    const k = c.text.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
