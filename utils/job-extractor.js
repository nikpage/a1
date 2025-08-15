// utils/job-extractor.js
const TOOLS = ['figma','adobe xd','sketch','invision','framer','photoshop','illustrator','miro','jira','confluence','notion','react','vue','angular','html','css','javascript','typescript'];
const TONE_MAP = [
  {tone:'Playful', rx:/(playful|fun|quirky|humor|witty|light-hearted)/i},
  {tone:'Formal', rx:/(formal|professional|strict|compliance|regulated|enterprise)/i},
  {tone:'Direct', rx:/(fast-paced|move fast|bias for action|hands-on|scrappy|ship|execute)/i},
  {tone:'Technical', rx:/(deep technical|engineering-heavy|complex systems|architecture|api|sdk|devtools)/i},
  {tone:'Creative', rx:/(creative|inventive|innovative|storyteller|brand|visual)/i}
];
const SOFT_QUALITIES = [
  {q:'Adaptability', rx:/(adaptab|ambiguity|change|dynamic)/i},
  {q:'Collaboration', rx:/(collaborat|cross[-\s]?functional|stakeholder|teamwork|pair)/i},
  {q:'Ownership', rx:/(ownership|accountab|autonom|self[-\s]?starter|proactive)/i},
  {q:'Communication', rx:/(communicat|present|storytell|writing|write|verbal)/i},
  {q:'Leadership', rx:/(lead|mentor|coach|manage|influenc)/i},
  {q:'Customer Focus', rx:/(customer[-\s]?centric|user[-\s]?centric|empathy|research)/i},
  {q:'Speed', rx:/(fast[-\s]?paced|deadline|quickly|rapid|iterate)/i}
];
function pickTone(text){
  const hits=TONE_MAP.filter(t=>t.rx.test(text)).map(t=>t.tone);
  if(!hits.length)return 'Neutral';
  const uniq=[...new Set(hits)];
  if(uniq.length>2)return uniq.slice(0,2).join(', ');
  return uniq.join(', ');
}
function findTools(text){
  const lower=text.toLowerCase();
  const found=[...new Set(TOOLS.filter(t=>lower.includes(t)))];
  const ordered=found.sort((a,b)=>lower.indexOf(a)-lower.indexOf(b));
  return ordered;
}
function inferPortfolioImportance(text){
  if(/portfolio|case study|behance|dribbble|drible|dribble/i.test(text))return 'High';
  if(/attach samples|work samples|examples of work/i.test(text))return 'Medium';
  return 'Unclear';
}
function inferUrgency(text){
  if(/immediate|asap|start now|urgent/i.test(text))return 'Immediate';
  if(/within\s+\d+\s*(weeks?|months?)/i.test(text))return 'Near-term';
  return 'Standard';
}
function findAtsKeywords(text){
  const toolz=findTools(text);
  const roleWords=(text.match(/\b(ux|ui|product design|service design|research|prototyping|wireframes?|design systems?|accessibility|wcag|usability|interaction design|visual design|typography|information architecture|saas|b2b|b2c|agile|scrum)\b/gi)||[]).map(s=>s.trim());
  return [...new Set([...toolz, ...roleWords])];
}
function detectCountry(text){
  const m=(text.match(/\b(UK|United Kingdom|England|Scotland|Wales|Ireland|USA|United States|Canada|Germany|France|Spain|Italy|Poland|Czech Republic|Czechia|Slovakia|Hungary|Romania|Ukraine|Netherlands|Belgium|Denmark|Sweden|Norway|Finland|Switzerland|Austria|Portugal|Greece|Australia|New Zealand)\b/i)||[])[0];
  return m||'Not specified';
}
function detectSeniority(text){
  if(/intern|junior|entry[-\s]?level/i.test(text))return 'Entry Level';
  if(/mid[-\s]?level|midweight|mid[-\s]?senior|2-5\s*years/i.test(text))return 'Mid';
  if(/senior|sr\.?|5\+?\s*years/i.test(text))return 'Senior';
  if(/lead|principal|head|director/i.test(text))return 'Lead/Principal';
  return 'Unspecified';
}
function extractField(rx,text){const m=text.match(rx);return m?m[1].trim():'Not specified'}
function extractRequirements(text){
  const lines=text.split('\n').map(l=>l.trim()).filter(Boolean);
  const bullets=lines.filter(l=>/^[-*•·]/.test(l) || /\brequire(d|ments?)\b|\bqualifications?\b|\bresponsibilit(y|ies)\b/i.test(l));
  if(bullets.length)return bullets.map(b=>b.replace(/^[-*•·]\s?/, '').trim());
  const sentences=(text.match(/[^.\n]+(?:\.[^A-Za-z]|$)/g)||[]).map(s=>s.trim());
  return sentences.filter(s=>/(experience|years|proficien|must|required|responsib|own|deliver|design|research|prototype|figma|portfolio)/i.test(s)).slice(0,12);
}
export function extractJobSections({ jobText }){
  const Position=extractField(/\b(Position|Job\s*Title|Role)\s*:\s*(.+)/i, jobText);
  const Company=extractField(/\b(Company|Employer)\s*:\s*(.+)/i, jobText);
  const Industry=extractField(/\bIndustry\s*:\s*(.+)/i, jobText);
  const Country=detectCountry(jobText);
  const HRContact=extractField(/\b(HR\s*Contact|Recruiter|Contact|Hiring\s*Manager)\s*:\s*(.+)/i, jobText);
  const Seniority=detectSeniority(jobText);
  const reqs=extractRequirements(jobText);
  const tone=pickTone(jobText);
  const soft=[...new Set(SOFT_QUALITIES.filter(s=>s.rx.test(jobText)).map(s=>s.q))];
  const tools=findTools(jobText);
  const portfolio=inferPortfolioImportance(jobText);
  const urgency=inferUrgency(jobText);
  const ats=findAtsKeywords(jobText);
  return {
    details:{Position,Seniority,Company,Industry,Country,HRContact},
    requirements:reqs,
    inferred:{Tone:tone,SoftQualities:soft,PortfolioImportance:portfolio,ToolEmphasis:tools,Urency:urgency,ATSKeywords:ats},
    fullText:jobText
  };
}
export function formatJobExtractionForPrompt({ details, requirements, inferred, fullText }){
  const lines=[];
  lines.push('--- [Extracted Job Details] ---');
  lines.push(`Position: ${details.Position}`);
  lines.push(`Seniority: ${details.Seniority}`);
  lines.push(`Company: ${details.Company}`);
  lines.push(`Industry: ${details.Industry}`);
  lines.push(`Country: ${details.Country}`);
  lines.push(`HR Contact: ${details.HRContact}`);
  lines.push('');
  lines.push('--- [Extracted Requirements] ---');
  requirements.forEach(r=>lines.push(`- ${r}`));
  lines.push('');
  lines.push('--- [Inferred Attributes] ---');
  lines.push(`Tone: ${inferred.Tone}`);
  lines.push(`Soft Qualities: ${inferred.SoftQualities.join(', ') || 'Unclear'}`);
  lines.push(`Portfolio Importance: ${inferred.PortfolioImportance}`);
  lines.push(`Tool Emphasis: ${inferred.ToolEmphasis.join(', ') || 'None detected'}`);
  lines.push(`Urgency: ${inferred.Urency}`);
  lines.push(`ATS Keywords: ${inferred.ATSKeywords.join(', ') || 'None detected'}`);
  lines.push('');
  lines.push('--- [Job Advertisement Full Text] ---');
  lines.push(fullText || '');
  return lines.join('\n').trim();
}
export function extractAndFormatJob({ jobText }){
  const data=extractJobSections({ jobText });
  return formatJobExtractionForPrompt({ ...data });
}
