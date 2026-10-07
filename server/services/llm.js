const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// models to try, in order (a wrong name just fails and the next one is tried)
const MODELS = ['gemini-3.5-flash', 'gemini-3.5-flash-lite', 'gemini-3.6-flash'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// the writing system each language must use
const SCRIPT_CHECK = { Hindi: /[\u0900-\u097F]/, Tamil: /[\u0B80-\u0BFF]/ };
const SCRIPT_NOTE = {
  Hindi: ' in the Devanagari script, for example हिन्दी',
  Tamil: ' in the Tamil script, for example தமிழ்',
};

// saved AI answers, so the same request never needs the AI twice
const CACHE_FILE = path.join(__dirname, '../data/roadmap-cache.json');
let cache = {};
try {
  cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
} catch {
  cache = {};
}
function saveCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  } catch {
    // saving is optional
  }
}

// Backup plan if the AI fails: one week per missing skill
function fallbackRoadmap(missingSkills) {
  return missingSkills.map((skill, i) => ({
    week: i + 1,
    topic: `Learn ${skill}`,
    skills: [skill],
    explanation: `Build a solid foundation in ${skill}.`,
    project: `Make a small project that uses ${skill}.`,
  }));
}

async function callModel(model, prompt, language) {
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });
  const clean = response.text.replace(/```json|```/g, '').trim();
  const weeks = JSON.parse(clean);
  if (!Array.isArray(weeks)) throw new Error('Not an array');

  // reject answers that are not written in the right script
  const check = SCRIPT_CHECK[language];
  if (check && !weeks.every((w) => check.test(w.explanation || '') && check.test(w.topic || ''))) {
    throw new Error('Wrong script: answer was not in ' + language + ' letters');
  }
  return weeks;
}

async function generateRoadmap(roleName, haveSkills, missingSkills, language = 'English') {
  if (missingSkills.length === 0) return [];

  // "|v2" makes old Tamil/Hindi answers saved before this fix be ignored
  const key =
    [roleName, haveSkills.join(','), missingSkills.join(','), language].join('|') +
    (language === 'English' ? '' : '|v2');
  if (cache[key]) return cache[key];

  const languageRule =
    language === 'English'
      ? 'Write "topic", "explanation" and "project" in English.'
      : `Write "topic", "explanation" and "project" in ${language}${SCRIPT_NOTE[language] || ''}. Never write ${language} words using English letters.`;

  const prompt = `You are a career mentor. A student wants to become a ${roleName}.
They already know: ${haveSkills.join(', ') || 'nothing yet'}.
They still need to learn: ${missingSkills.join(', ')}.

Create a week-by-week learning plan. Rules:
- Use ONLY the skills listed as "still need to learn", with their exact names.
- Put easier or foundational skills first. One or two skills per week.
- Do NOT include any links or course names.
- ${languageRule} Keep every item inside "skills" in English, exactly as given.
- Reply with ONLY a JSON array, no other text, in this shape:
[{"week":1,"topic":"short title","skills":["exact skill name"],"explanation":"1-2 sentences on why this matters","project":"one small hands-on project"}]`;

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const weeks = await callModel(model, prompt, language);
        cache[key] = weeks;
        saveCache();
        return weeks;
      } catch (err) {
        const msg = String(err.message);
        console.error(`${model} attempt ${attempt} failed:`, msg.slice(0, 150));
        // quota used up or unknown model: retrying this model is pointless
        if (/"code":\s*(429|404)|RESOURCE_EXHAUSTED|NOT_FOUND/.test(msg)) break;
        await sleep(attempt * 2000);
      }
    }
  }

  console.error('All attempts failed, using fallback roadmap');
  return fallbackRoadmap(missingSkills);
}

module.exports = { generateRoadmap };