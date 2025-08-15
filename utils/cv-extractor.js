// utils/cv-extractor.js
const LANGUAGE_CONFIG = {
  English: {
    experience: ['experience', 'work history', 'employment history', 'professional experience'],
    education: ['education', 'qualifications'],
    skills: ['skills', 'key skills', 'technical skills', 'competencies'],
    certifications: ['certifications', 'certificates', 'licenses'],
    languages: ['languages', 'spoken languages', 'language skills'],
    awards: ['awards', 'recognition', 'honors'],
    projects: ['projects', 'side projects', 'personal projects'],
    publications: ['publications'],
    volunteer: ['volunteer', 'volunteering', 'community'],
    summary: ['summary', 'profile', 'about me'],
    contact: ['contact', 'contact details']
  },
  Polish: {
    experience: ['doświadczenie', 'doświadczenie zawodowe'],
    education: ['wykształcenie'],
    skills: ['umiejętności']
  },
  Czech: {
    experience: ['praxe', 'pracovní zkušenosti'],
    education: ['vzdělání'],
    skills: ['dovednosti']
  },
  Hungarian: {
    experience: ['tapasztalat', 'szakmai tapasztalat'],
    education: ['oktatás', 'tanulmányok'],
    skills: ['készségek']
  },
  Romanian: {
    experience: ['experiență', 'experiență profesională'],
    education: ['educație'],
    skills: ['competențe']
  },
  Ukrainian: {
    experience: ['досвід', 'досвід роботи'],
    education: ['освіта'],
    skills: ['навички', 'ключові навички']
  }
};

function titleCase(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function extractCvSections({ cvText, language = 'English' }) {
  const keywords = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.English;
  const lines = cvText.split('\n');
  const foundSections = [];
  lines.forEach((line, index) => {
    const lowerLine = line.toLowerCase().trim();
    if (lowerLine.length > 0 && lowerLine.length < 80) {
      for (const sectionName in keywords) {
        for (const keyword of keywords[sectionName]) {
          if (lowerLine.includes(keyword.toLowerCase())) {
            foundSections.push({ name: sectionName, index });
            return;
          }
        }
      }
    }
  });
  if (foundSections.length === 0) {
    return { extractedSections: {}, remainingText: cvText, sectionOrderFound: [] };
  }
  foundSections.sort((a, b) => a.index - b.index);
  const extractedSections = {};
  const usedLineIndexes = new Set();
  for (let i = 0; i < foundSections.length; i++) {
    const current = foundSections[i];
    const next = foundSections[i + 1];
    const startLine = current.index;
    const endLine = next ? next.index : lines.length;
    const sectionLines = lines.slice(startLine, endLine);
    extractedSections[current.name] = sectionLines.join('\n').trim();
    for (let j = startLine; j < endLine; j++) usedLineIndexes.add(j);
  }
  const remainingLines = lines.filter((_, index) => !usedLineIndexes.has(index));
  const remainingText = remainingLines.join('\n').trim();
  return { extractedSections, remainingText, sectionOrderFound: foundSections.map(s => s.name) };
}

export function formatCvExtractionForPrompt({ extractedSections, remainingText, order }) {
  const seen = new Set();
  let out = '';
  order.forEach(name => {
    if (extractedSections[name] && !seen.has(name)) {
      out += `--- [Extracted ${titleCase(name)} Section] ---\n${extractedSections[name]}\n\n`;
      seen.add(name);
    }
  });
  for (const name in extractedSections) {
    if (!seen.has(name)) {
      out += `--- [Extracted ${titleCase(name)} Section] ---\n${extractedSections[name]}\n\n`;
      seen.add(name);
    }
  }
  out += `--- [Remaining CV Text] ---\n${remainingText || ''}`;
  return out.trim();
}

export function extractAndFormatCv({ cvText, language = 'English' }) {
  const { extractedSections, remainingText, sectionOrderFound } = extractCvSections({ cvText, language });
  if (Object.keys(extractedSections).length === 0) return cvText;
  return formatCvExtractionForPrompt({ extractedSections, remainingText, order: sectionOrderFound });
}
