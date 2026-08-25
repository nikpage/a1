// prompts/letter-library.js
//
// THE LETTER IS A TEMPLATE: Nik's own paragraphs, hardcoded, plus one written
// bit per job.
//
// Why this exists (owner decision, 2026-08-25): five weeks were spent trying to
// get a model to WRITE a letter at his standard — rule stacks, a minimal prompt,
// a plan pass, three hand-written exemplars shown as register targets. Every one
// of them produced accurate, well-evidenced letters that still read as a
// machine's. So the model stops writing the letter. It picks which of his
// paragraphs answer this ad, and writes only the opening stance.
//
// EVERY TEXT BELOW IS HIS, TYPED BY HIM, COPIED VERBATIM from the three letters
// he wrote by hand:
//   scripts/fixtures/golden/target-invity-cover.md
//   scripts/fixtures/ad-read_Faceup/good-cover.md
//   scripts/fixtures/ad-read_Sudolabs/good-cover.md
//
// Two edits were made and they are the only two: "intruduce" → "introduce" (a
// typo, not a voice), and one pronoun in CRYPTO_UX ("this message" → "that")
// so the block stands without the Invity-specific sentence that preceded it.
// NOTHING ELSE MAY BE SMOOTHED. An earlier session rewrote his Invity letter's
// body — "is cake" became "second nature" — and the smoothed copy then sat in
// the repo labelled as the bar. If a block reads rough, that is the point.
//
// The library grows when HE writes another paragraph. It never grows by a model
// generating one: a generated paragraph is the thing this file replaced.

// ── Instances: a real piece of work, told with its mechanism ──────────────────
// These carry the letter. Both picked instances are printed whole — his letters
// tell BOTH out in stages, and the production prompt's "one carries, the other
// is a few sentences" is what made ours read like a good paragraph stapled to
// filler.
export const INSTANCES = [
  {
    id: 'ai-realty-assistant',
    evidences: 'building custom AI products end to end for a non-technical client; iterating to measurable ROI; AI that serves the business rather than the tech',
    text: `My favorite is probably an assistant for a small realty company in Southern Bohemia. They wanted their own AI Pepper Potts. We iterated our way through email and calendar taming, through phone and WhatsApp. Making the AI understand the "story of the deal" to help prioritize what is really important for the salesperson to focus on today. We built lead generation help and deal-loss reduction. And finally, when the (non-technical) client saw that data we were capturing on the behavior, we added optimizations for how they work. In the 1st year after Phase One, they had increased new exclusive sales deals (their gold) by 12% and overall closings by 18%. The ROI was the goal, not a bunch of cool tech.`
  },
  {
    id: 'ebay-berlin-trust',
    evidences: 'account management and client trust; growing an account from one developer to a dozen FTE; going to the client in person; understanding decision-makers',
    text: `Building trust with the client is key. When I took over the eBay Berlin account, it was a slow, single-dev project. I spent my own time and money to go to Berlin to meet with my SPOC and his boss. I ended up going there a couple of times a month to work side by side in their space. In under a year, we had a dozen FTE people doing four concurrent projects. I learned what the main decision-makers wanted and how to make them look good to their bosses. As a long-time product and UX guy, I see it all as discovery, design, testing, delivery, whether that's an agent or a business relationship.`
  },
  {
    id: 'ebay-salsita-short',
    evidences: 'turning around an underperforming account; revenue growth; inventing the solution together with the client',
    text: `At Salsita, I ran product and delivery for accounts including eBay. I took over an underperforming account and made them our biggest ambassadors while increasing billing over fivefold in under one year. Again, though, it was about understanding their issues and needs and working together with them to invent new ways to get there, usually having a lot of fun along the way.`
  },
  {
    id: 'cs-ux-practice',
    evidences: 'building a practice from nothing inside a large regulated company; winning over business and product teams with evidence; working with legal, compliance and security; developer experience and API as product',
    text: `When I still believed banks could be positively transformative, I built the UX practice inside Česká spořitelna from nothing, not by winning an argument about design, but by getting the business and product teams to watch their own users struggle in testing. For me, users were the key, but in real banking life, legal, compliance, and security are vital, so working with those teams was indispensable. I learned to treat that as the shape of the product rather than the thing slowing it down, including on the API side, where the integrator is the user and developer experience is the product.`
  },
  {
    id: 'crypto-ux',
    evidences: 'crypto and blockchain work; public advocacy and speaking; the conviction that complex tech fails on user experience',
    text: `I've pushed that at Dezentrum in Zurich and worked to build it in projects like Blockchain4Humanity. Through my career the core issue was always the same: complex tech fails unless the user experience feels effortless and the user immediately sees why she wants it.`
  }
];

// ── Openings: the stance the letter starts from ───────────────────────────────
// Two of his are job-agnostic and are kept as text. Where neither fits the ad,
// the model writes one — that is the ONE piece of prose it produces.
export const OPENINGS = [
  {
    id: 'belief-left-banking',
    fits: 'an employer whose ad leads on values, purpose, people or social impact',
    text: `Two aspects of work-life are vital: the collective, and a meaning to the work deeper than profits & growth. That's one reason I left banking. I didn't find that there. Today's world desperately needs strong values actually lived by.`
  },
  {
    id: 'ai-work-now',
    fits: 'an employer building AI products, or any ad where what he is doing right now is the point',
    text: `I've been building custom AI apps for the last couple of years for clients that want fast ROI. Sometimes that means making a call and getting it wrong, but it always means getting the solution running well and fast.`
  }
];

// ── The day-to-day line: how he works, in the present tense ───────────────────
// Every one of the three letters has one, just before the close.
export const DAY_TO_DAY = [
  {
    id: 'hands-on-pm',
    fits: 'a product management role, especially an agile or AI-first team',
    text: `On the ground, I am a hands-on product manager who stays close to the details. To me, users are the core, it's their needs we need to build into specs, working closely with other realization teams to make those needs real. I build custom AI systems and run fast discovery loops in my daily work today, fitting into an agile, AI-first product team is cake.`
  },
  {
    id: 'end-to-end-authority',
    fits: 'a senior role where ownership, decision rights and accountability are the question',
    text: `I've owned the end-to-end product process and find having the authority to make the decisions needed, and of course the accountability that goes with that, is the only way to move at today's business pace.`
  },
  {
    id: 'nuts-and-bolts',
    fits: 'a delivery or consulting role where the ad describes the daily work',
    text: `Discovery workshops, business impact, projections, and working with the devs is the daily nuts & bolts work.`
  }
];

// ── The close: an offer to meet, then the CV ──────────────────────────────────
export const CLOSES = [
  {
    id: 'coffee-talk',
    text: `I'd love to buy you a coffee and talk. My CV is attached for the full picture.`
  },
  {
    id: 'complement-approaches',
    text: `I'd love to chat about how our approaches might complement each other. My CV is attached for the rest.`
  },
  {
    id: 'coffee-introduce',
    text: `I would love to buy you a coffee and introduce myself. My CV is attached for the full picture.`
  }
];

// His own line about the language, for a Czech or Slovak employer advertising in
// English. Verbatim, ellipsis and all.
export const LANGUAGE_LINE = `Domluvím se česky, ale radši… in English natively.`;

const index = (rows, label) =>
  rows.map((r) => `  ${r.id} — ${r.evidences || r.fits || label}`).join('\n');

const byId = (rows, id) => rows.find((r) => r.id === id) || null;

export const instanceById = (id) => byId(INSTANCES, id);
export const openingById = (id) => byId(OPENINGS, id);
export const dayToDayById = (id) => byId(DAY_TO_DAY, id);
export const closeById = (id) => byId(CLOSES, id);

// What the picker reads. It sees what each block EVIDENCES and never its text
// for the instances it is choosing between — the choice is about fit to the ad,
// and showing five paragraphs of finished prose invites it to write a sixth.
export function libraryIndex() {
  return `Paragraphs available, by what each one evidences:

INSTANCES (pick TWO, in the order they should appear):
${index(INSTANCES)}

OPENINGS (pick ONE, or "custom" and write it yourself):
${index(OPENINGS)}

DAY-TO-DAY LINES (pick ONE):
${index(DAY_TO_DAY)}

CLOSES (pick ONE):
${CLOSES.map((c) => `  ${c.id} — "${c.text}"`).join('\n')}`;
}
