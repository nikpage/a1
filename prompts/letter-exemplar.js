// prompts/letter-exemplar.js
//
// THE REGISTER EXEMPLARS — three letters, written by hand, that clear the bar.
//
// Every other lever in this repo describes what a good letter is. Six runs on
// 2026-08-23 showed the description is not enough: the pipeline produced clean,
// accurate, well-evidenced letters that still read as résumé prose — "I pair
// that technical work with years spent inside regulated finance" — because a
// model that is TOLD to sound like a person writes the sentence a model writes.
// Shown one, it has something to measure itself against.
//
// THREE, not one (2026-08-24). A single exemplar is copied as a mould: the
// pipeline reproduced its opening move — name the employer's product, say why
// that problem matters — because it was the only opening it had ever seen. Two
// of Nik's later hand-written letters open nowhere near there: one on what he
// has spent the last two years building, one on what he believes about work and
// why he left banking. Three different shapes say "this range", not "this
// template". The pairs they came from (scripts/fixtures/ad-read_*/) hold the
// pipeline's draft beside Nik's rewrite; the differences those diffs showed are
// what the commentary below now states.
//
// They are fenced hard: MANNER ONLY. Not a fact, not a name, not a phrase. The
// facts belong to the person who wrote them; another candidate's letter takes
// only its shape.
//
// Sources, kept as files so the run harness can measure against them:
// scripts/fixtures/golden/target-invity-cover.md,
// scripts/fixtures/ad-read_Faceup/good-cover.md,
// scripts/fixtures/ad-read_Sudolabs/good-cover.md. They live here as text
// rather than a file read so the prompt builder stays pure and testable.

// Opens on the employer's product and the problem behind it.
const EXEMPLAR_PRODUCT = `Invity caught my eye because you are actually fixing Bitcoin's usability problem rather than just talking about it. Turning crypto into a simple, automated habit for everyday people is the exact product challenge I care about.

The +invity app reflects people's needs and wants, it doesn't lecture them about why they should want the tech. I've pushed this message at Dezentrum in Zurich and worked to build it in projects like Blockchain4Humanity. Through my career the core issue was always the same: complex tech fails unless the user experience feels effortless and the user immediately sees why she wants it. +invity's approach; combining trust and strong execution hits that sweet spot exactly.

On the ground, I am a hands-on product manager who stays close to the details. To me, users are the core, it's their needs we need to build into specs, working closely with other realization teams to make those needs real. I build custom AI systems and run fast discovery loops in my daily work today, fitting into an agile, AI-first product team is cake.

I'd love to buy you a coffee and talk. My CV is attached for the full picture.`;

// Opens on what the candidate believes, and what it cost him.
const EXEMPLAR_BELIEF = `Two aspects of work-life are vital: the collective, and a meaning to the work deeper than profits & growth. That's one reason I left banking. I didn't find that there. Today's world desperately needs strong values actually lived by.

When I still believed banks could be positively transformative, I built the UX practice inside Česká spořitelna from nothing, not by winning an argument about design, but by getting the business and product teams to watch their own users struggle in testing. For me, users were the key, but in real banking life, legal, compliance, and security are vital, so working with those teams was indispensable. I learned to treat that as the shape of the product rather than the thing slowing it down, including on the API side, where the integrator is the user and developer experience is the product.

At Salsita, I ran product and delivery for accounts including eBay. I took over an underperforming account and made them our biggest ambassadors while increasing billing over fivefold in under one year. Again, though, it was about understanding their issues and needs and working together with them to invent new ways to get there, usually having a lot of fun along the way.

I've owned the end-to-end product process and find having the authority to make the decisions needed, and of course the accountability that goes with that, is the only way to move at today's business pace. I'd love to chat about how our approaches might complement each other. My CV is attached for the rest.`;

// Opens on the work itself, then tells ONE project at length.
const EXEMPLAR_STORY = `I've been building custom AI apps for the last couple of years for clients that want fast ROI. Sometimes that means making a call and getting it wrong, but it always means getting the solution running well and fast. My favorite is probably an assistant for a small realty company in Southern Bohemia. They wanted their own AI Pepper Potts. We iterated our way through email and calendar taming, through phone and WhatsApp. Making the AI understand the "story of the deal" to help prioritize what is really important for the salesperson to focus on today. We built lead generation help and deal-loss reduction. And finally, when the (non-technical) client saw that data we were capturing on the behavior, we added optimizations for how they work. In the 1st year after Phase One, they had increased new exclusive sales deals (their gold) by 12% and overall closings by 18%. The ROI was the goal, not a bunch of cool tech.

Building trust with the client is key. When I took over the eBay Berlin account, it was a slow, single-dev project. I spent my own time and money to go to Berlin to meet with my SPOC and his boss. I ended up going there a couple of times a month to work side by side in their space. In under a year, we had a dozen FTE people doing four concurrent projects. I learned what the main decision-makers wanted and how to make them look good to their bosses. As a long-time product and UX guy, I see it all as discovery, design, testing, delivery, whether that's an agent or a business relationship.

Discovery workshops, business impact, projections, and working with the devs is the daily nuts & bolts work.

I would love to buy you a coffee and introduce myself.`;

export function letterExemplarBlock() {
  return `
# WHAT A LETTER THAT WORKS SOUNDS LIKE

Read these before writing. They are three real letters, written by hand by one
person for three different applications, and they are the level this letter is
measured against.

TAKE THEIR MANNER, NEVER THEIR CONTENT. Not one fact, name, company, project or
phrase from them may appear in what you write — those belong to the person who
wrote them. What you take is how they move.

THEY ARE THREE BECAUSE THE SHAPE IS NOT FIXED. They open in three different
places and none of them is the correct one; the correct one is whichever this
letter's argument needs. Copying the moves of any single one of them is the
failure this section exists to prevent.

## ONE — opens on the employer's product
"""
${EXEMPLAR_PRODUCT}
"""

## TWO — opens on what the candidate believes, and what it cost him
"""
${EXEMPLAR_BELIEF}
"""

## THREE — opens on the work itself, then tells ONE project at length
"""
${EXEMPLAR_STORY}
"""

WHAT NONE OF THEM DOES, AND THIS IS THE ONE THING THAT KILLS EVERY LETTER:

None of them tries to get as much of the record into the letter as it will
hold. That instinct — cover the career, name the big employers, work in the
metrics, fit four achievements into a paragraph because they are all true and
all relevant — is what you will want to do, and it is the failure. It produces
a CV in sentences. The candidate already sent the CV.

Count what the third letter LEAVES OUT: twenty years of roles, every employer
but two, every number but two. It spends its whole length on one small client
in Southern Bohemia and one account, and it is better for it. The letter is not
a summary of the record. It is one or two things from the record, told properly,
and everything else deliberately unsaid.

So before you write: pick what you are leaving out, and leave it out. If a
sentence exists to make sure something on the record gets a mention, delete it.

What all three do, and what your letter must do too:

- THE OPENING IS ANCHORED TO THE CANDIDATE, wherever it starts. One starts on
  the employer's product and says in the same breath why that is the problem
  this candidate cares about. One starts on what the candidate holds to be true
  about work, and what acting on it cost him. One starts on what he has actually
  been doing. What none of them does is announce the application, name the job
  title back, or deliver a verdict on how the employer is doing.
- THE INSTANCE IS TOLD, NOT SUMMARISED, AND IT TAKES ROOM. The third letter
  spends half its words on one project and walks the reader through it — what
  the client wanted, what was tried, what was added when, what came of it. That
  is what makes it impossible to have been written for anyone else. Four
  achievements at one sentence each cover more and prove less. Where you have
  the words for one instance told properly and two mentioned, tell the one.
- THEIR VIEW IS VISIBLE IN WHAT THEY DID, never announced in a sentence of its
  own. Nik's letters read as opinionated because of the choices they report —
  going to Berlin at his own expense, leaving banking, refusing to hand over a
  spec and walk away. DO NOT WRITE A CREDO SENTENCE. "To me, X isn't about Y,
  it's about Z" is a template slot: every letter this pipeline produced on
  2026-08-24 contained one, all three built from this instruction when it asked
  for a stated belief. The belief belongs inside the story, as the reason
  something was done.
- THE COST IS IN THEM. "I spent my own time and money to go to Berlin." "That's
  one reason I left banking." A fact with what it cost attached is believed; the
  same fact as an outcome is not.
- Their evidence is chosen for what it PROVES ABOUT THE PERSON, not for how
  impressive the employer is. Advocacy work and small clients earn their place
  next to the big names, and the letter says what the instances have in common.
- THEY SOUND LIKE SPEECH. Contractions, dashes, asides, an ampersand, a plain
  "On the ground, I am a hands-on product manager who stays close to the
  details." No "multi-disciplinary delivery teams", no "functional
  specifications", no "I pair that work with". If you would not say it out loud
  to someone across a table, it is the wrong sentence.
- ONE OF THEM CARRIES NO NUMBERS AT ALL and loses nothing by it. A number is one
  kind of proof among several, never the target.
- Where two instances share a lesson, the lesson is said once, plainly, in the
  candidate's own words — "the core issue was always the same" — instead of
  leaving the reader to work out what the examples had in common.

BEFORE YOU RETURN THE LETTER, CHECK IT AGAINST THESE FIVE. Fix any that fail:
1. The opening says something about THIS candidate — what they noticed, believe,
   or have been doing — and connects it to this employer. It never announces the
   application, and the job title appears nowhere in the letter.
2. There is no credo sentence — no "To me…", no "X isn't about Y, it's about Z".
   What the candidate believes is visible in what they chose to do.
3. At least one instance is TOLD at length, with its specifics, rather than
   summarised into a claim.
4. Every sentence would still make sense said out loud across a table.
5. The last two lines are the ask — a specific human next step — and then the CV
   line where the letter carries one. "I look forward to discussing" and "I
   welcome the opportunity" are not asks; they are the stock ending every other
   applicant sends.
`;
}
