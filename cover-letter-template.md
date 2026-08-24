# Generic cover letter — one AI slot, everything else fixed

Slots:
- `{{COMPANY}}` — company name, typed in.
- `{{WHY_THEM}}` — the ONLY AI-written part: first paragraph, why I want to work there.

---

Dear {{HIRING_NAME}},

{{WHY_THEM}}

I've been building custom AI apps for the last couple of years for clients who want fast ROI. My favourite is an assistant for a small realty company in Southern Bohemia — they wanted their own AI Pepper Potts. We iterated through email and calendar taming, then phone and WhatsApp, then taught it the "story of the deal" so a salesperson knows what actually matters today. We added lead generation and deal-loss reduction, and when the (non-technical) client saw the behavioural data we were capturing, we optimised how they work. In the first year after Phase One, exclusive sales deals were up 12% and closings up 18%. The ROI was the goal, not a pile of cool tech.

Building trust is the rest of the job. When I took over the eBay Berlin account it was a slow, single-dev project. I spent my own time and money to go to Berlin and meet my SPOC and his boss, then kept going a couple of times a month to work side by side in their space. Inside a year we had a dozen people on four concurrent projects. As a long-time product and UX guy, I see it all as discovery, design, testing, delivery — whether that's an agent or a business relationship.

Discovery workshops, business impact, projections and working with the devs are the daily nuts and bolts.

I'd love to buy you a coffee and introduce myself. My CV is attached for the rest.

Nik Page

---

## The AI prompt for `{{WHY_THEM}}`

Input: the full ad text. The read is SOFT DATA — what the ad reveals without
saying it — never the product pitch.

> You are given a job ad. First, read what it gives away that it does not state:
> what this company VALUES (quote the wording that shows it), what it is quietly
> worried about, what its goal is, and what its own writing says about how it
> works — how detailed the ad is, what it repeats, what it puts first, what it
> phrases in the negative, how formal or loose the language is.
>
> Then write ONE paragraph, 50-80 words, to open a cover letter. It opens on
> THAT inference — the thing they care about underneath the vacancy — and on why
> the candidate recognises it and shares it. Do not describe, praise or explain
> their product. Do not compliment the company. Do not quote the ad back.
>
> Rules: no job title, no "I am writing to apply", no credo sentence ("To me, X
> isn't about Y"), no adjectives about their success. Plain spoken, contractions
> fine, must survive being said out loud across a table. Invent nothing about
> the candidate. End on a line that leads into him talking about his own work.
>
> Return the paragraph only.
