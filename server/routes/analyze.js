const express = require('express');
const multer = require('multer');
const roles = require('../data/roles.json');
const { matchSkills } = require('../services/skillMatcher');
const { extractText, extractSkills } = require('../services/resumeParser');
const { generateRoadmap } = require('../services/llm');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post('/', upload.single('resume'), async (req, res) => {
  try {
        const { role, language } = req.body;
    const allowed = ['English', 'Tamil', 'Hindi'];
    const lang = allowed.includes(language) ? language : 'English';
    const selectedRole = roles.find(
      (r) => r.name.toLowerCase() === (role || '').toLowerCase()
    );
    if (!selectedRole) {
      return res.status(404).json({ error: 'Role not found' });
    }

    let skills = [];
    if (req.file) {
      const text = await extractText(req.file.buffer);
      skills = extractSkills(text, selectedRole);
    } else {
      skills = req.body.skills || [];
    }

    const result = matchSkills(skills, selectedRole);

        const weeks = await generateRoadmap(
      selectedRole.name,
      result.haveSkills,
      result.missingSkills,
      lang
    );

    // attach resource links from OUR dataset and mark each week as not done
    const roadmap = weeks.map((w) => ({
      ...w,
      done: false,
      resources: (w.skills || []).flatMap((name) => {
        const s = selectedRole.skills.find((x) => x.name === name);
        return s ? s.resources || [] : [];
      }),
    }));

    res.json({
      role: selectedRole.name,
      detectedSkills: skills,
      ...result,
      roadmap,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Could not process the request: ' + err.message });  }
});

module.exports = router;