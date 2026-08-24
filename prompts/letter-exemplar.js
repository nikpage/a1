// prompts/letter-exemplar.js
//
// THE REGISTER EXEMPLAR — one letter, written by hand, that clears the bar.
//
// Every other lever in this repo describes what a good letter is. Six runs on
// 2026-08-23 showed the description is not enough: the pipeline produced clean,
// accurate, well-evidenced letters that still read as résumé prose — "I pair
// that technical work with years spent inside regulated finance" — because a
// model that is TOLD to sound like a person writes the sentence a model writes.
// Shown one, it has something to measure itself against.
//
// It is fenced hard: MANNER ONLY. Not a fact, not a name, not a phrase. The
// facts of this letter belong to the person who wrote it; another candidate's
// letter takes only its shape.
//
// The letter is `scripts/fixtures/golden/target-invity-cover.md`, kept there as
// the target the pipeline is measured against. It lives here as text rather
// than a file read so the prompt builder stays pure and testable.

const EXEMPLAR = `Invity caught my eye because you are actually fixing Bitcoin's usability problem rather than just talking about it. Turning crypto into a simple, automated habit for everyday people is the exact product challenge I care about.

The +invity app reflects people's needs and wants, it doesn't lecture them about why they should want the tech. I've pushed this message at Dezentrum in Zurich and worked to build it in projects like Blockchain4Humanity. Through my career the core issue was always the same: complex tech fails unless the user experience feels effortless and the user immediately sees why she wants it. +invity's approach; combining trust and strong execution hits that sweet spot exactly.

On the ground, I am a hands-on product manager who stays close to the details. To me, users are the core, it's their needs we need to build into specs, working closely with other realization teams to make those needs real. I build custom AI systems and run fast discovery loops in my daily work today, fitting into an agile, AI-first product team is cake.

I'd love to buy you a coffee and talk. My CV is attached for the full picture.`;

export function letterExemplarBlock() {
  return `
# WHAT A LETTER THAT WORKS SOUNDS LIKE

Read this before writing. It is a real letter, written by hand for a different
application, and it is the level this letter is measured against.

TAKE ITS MANNER, NEVER ITS CONTENT. Not one fact, name, company, project or
phrase from it may appear in what you write — those belong to the person who
wrote it. What you take is how it moves.

"""
${EXEMPLAR}
"""

What it does, and what your letter must do too:

- It opens on THE EMPLOYER'S PRODUCT — the thing itself, named, and what it is
  doing that the writer rates — then says in the same breath why that is the
  problem this candidate cares about. Two sentences, and the reader already
  knows why this person wrote to THEM.
- It says what the candidate BELIEVES, plainly and in the first person ("To me,
  users are the core"), and then shows where they acted on it. A letter with no
  view in it is a CV in paragraphs.
- Its evidence is chosen for what it PROVES ABOUT THE PERSON, not for how
  impressive the employer is. Advocacy work and small projects earn their place
  next to the big names, and the letter says what the instances have in common.
- It sounds like speech. Contractions, dashes, a plain "On the ground, I am a
  hands-on product manager who stays close to the details." No "multi-
  disciplinary delivery teams", no "functional specifications", no "I pair that
  work with". If you would not say it out loud to someone across a table, it is
  the wrong sentence.
- It carries no numbers at all, and loses nothing by it.
- Where two instances share a lesson, it says the lesson once, plainly, in the
  candidate's own words — "the core issue was always the same" — instead of
  leaving the reader to work out what the examples had in common.
- Its instances are not the biggest names in the record. A small project, an
  advocacy talk, or unpaid work is the right instance when it is the one that
  shows the belief in action.

BEFORE YOU RETURN THE LETTER, CHECK IT AGAINST THESE FIVE. Fix any that fail:
1. The first two sentences name what this employer builds and why that problem
   is the one this candidate cares about. Not the job title — the job title
   appears nowhere in the letter.
2. There is one plain first-person line saying what the candidate believes.
3. Where two instances share a lesson, it is stated once, in plain words.
4. Every sentence would still make sense said out loud across a table.
5. The last two lines are the ask — a specific human next step — and then the CV
   line. Neither on its own is a close.
- It ends by asking for a real human next step and pointing at the attached CV.
  YOUR LETTER ENDS THAT WAY TOO, IN TWO PARTS AND BOTH ARE REQUIRED: first the
  ASK — a specific human next thing this person wants, named as they would say
  it out loud ("I'd love to buy you a coffee and talk", "let me walk you through
  your onboarding over coffee") — and then the CV line. The CV line alone is not
  a close: it tells the reader nothing about what happens next. "I look forward
  to discussing" and "I welcome the opportunity" are not asks; they are the
  stock ending every other applicant sends.
- It says what the candidate BELIEVES in one plain first-person line. Yours
  carries one too.
`;
}
