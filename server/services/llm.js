const { GoogleGenAI } = require('@google/genai');

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// models to try, in order
const MODELS = ['gemini-3.6-flash', 'gemini-3.5-flash'];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Backup plan if the LLM fails: one week per missing skill
function fallbackRoadmap(missingSkills) {
  return missingSkills.map((skill, i) => ({
    week: i + 1,
    topic: `Learn ${skill}`,
    skills: [skill],
    explanation: `Build a solid foundation in ${skill}.`,
    project: `Make a small project that uses ${skill}.`,
  }));
}

async function callModel(model, prompt) {
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: { responseMimeType: 'application/json' },
  });
  const clean = response.text.replace(/```json|```/g, '').trim();
  const weeks = JSON.parse(clean);
  if (!Array.isArray(weeks)) throw new Error('Not an array');
  return weeks;
}

async function generateRoadmap(roleName, haveSkills, missingSkills, language = 'English') {
  if (missingSkills.length === 0) return [];

  const prompt = `You are a career mentor. A student wants to become a ${roleName}.
They already know: ${haveSkills.join(', ') || 'nothing yet'}.
They still need to learn: ${missingSkills.join(', ')}.

Create a week-by-week learning plan. Rules:
- Use ONLY the skills listed as "still need to learn", with their exact names.
- Put easier or foundational skills first. One or two skills per week.
- Do NOT include any links or course names.
- Write "topic", "explanation" and "project" in ${language}. Keep every item inside "skills" in English, exactly as given.
- Reply with ONLY a JSON array, no other text, in this shape:
[{"week":1,"topic":"short title","skills":["exact skill name"],"explanation":"1-2 sentences on why this matters","project":"one small hands-on project"}]`;

  // try each model, and each model up to 2 times
  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        return await callModel(model, prompt);
      } catch (err) {
        console.error(`${model} attempt ${attempt} failed:`, err.message.slice(0, 150));
        await sleep(2000);
      }
    }
  }

  console.error('All attempts failed, using fallback roadmap');
  return fallbackRoadmap(missingSkills);
}

module.exports = { generateRoadmap };