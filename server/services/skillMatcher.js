function normalize(text) {
  return text.toLowerCase().trim();
}

function matchSkills(studentSkills, role) {
  const student = studentSkills.map(normalize);

  const haveSkills = [];
  const missingSkills = [];
  let totalWeight = 0;
  let haveWeight = 0;

  role.skills.forEach((skill) => {
    // core skills count double, nice-to-have skills count once
    const weight = skill.level === 'core' ? 2 : 1;
    totalWeight += weight;

    // a skill matches if its name OR any alias is in the student's list
    const names = [skill.name, ...(skill.aliases || [])].map(normalize);
    const found = names.some((n) => student.includes(n));

    if (found) {
      haveSkills.push(skill.name);
      haveWeight += weight;
    } else {
      missingSkills.push(skill.name);
    }
  });

  const matchScore = Math.round((haveWeight / totalWeight) * 100);
  return { matchScore, haveSkills, missingSkills };
}

module.exports = { matchSkills };