// utils/cv-extractor.js
const LANGUAGE_CONFIG = {
  English: {
    experience: ['experience', 'work history', 'employment history', 'professional experience'],
    education: ['education', 'qualifications'],
    skills: ['skills', 'key skills', 'technical skills', 'competencies']
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

/**
 * Extracts structured sections (experience, education, skills) from raw CV text.
 * @param {object} params - The parameters object.
 * @param {string} params.cvText - The raw text of the CV.
 * @param {string} [params.language='English'] - The language of the CV.
 * @returns {{extractedSections: object, remainingText: string}} - An object containing extracted sections and the remaining text.
 */
export function extractCvSections({ cvText, language = 'English' }) {
  const keywords = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.English;
  const lines = cvText.split('\n');
  const foundSections = [];

  // 1. Find all section headers and their line numbers
  lines.forEach((line, index) => {
    const lowerLine = line.toLowerCase().trim();
    if (lowerLine.length > 0 && lowerLine.length < 50) { // Headers are usually short
      for (const sectionName in keywords) {
        for (const keyword of keywords[sectionName]) {
          if (lowerLine.includes(keyword.toLowerCase())) {
            foundSections.push({ name: sectionName, index });
            return; // Move to the next line once a section is found
          }
        }
      }
    }
  });

  // 2. If no sections are found, return the original text (graceful fallback)
  if (foundSections.length === 0) {
    return {
      extractedSections: {},
      remainingText: cvText,
    };
  }

  // 3. Sort sections by their appearance in the document
  foundSections.sort((a, b) => a.index - b.index);

  const extractedSections = {};
  const usedLineIndexes = new Set();

  // 4. Extract content for each found section
  for (let i = 0; i < foundSections.length; i++) {
    const currentSection = foundSections[i];
    const nextSection = foundSections[i + 1];

    const startLine = currentSection.index;
    const endLine = nextSection ? nextSection.index : lines.length;

    const sectionLines = lines.slice(startLine, endLine);
    extractedSections[currentSection.name] = sectionLines.join('\n').trim();

    // Mark these lines as "used"
    for (let j = startLine; j < endLine; j++) {
      usedLineIndexes.add(j);
    }
  }

  // 5. Collect any text that wasn't part of an extracted section
  const remainingLines = lines.filter((_, index) => !usedLineIndexes.has(index));
  const remainingText = remainingLines.join('\n').trim();

  return { extractedSections, remainingText };
}
