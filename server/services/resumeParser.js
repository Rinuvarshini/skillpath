// Reads a PDF file (as a buffer) and returns all its text
async function extractText(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    verbosity: 0,
  }).promise;

  let text = '';
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item) => item.str).join(' ') + '\n';
  }
  return text;
}

// Makes special characters safe to use inside a search pattern
function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Looks through the resume text for each skill of the role (name or alias)
function extractSkills(text, role) {
  const lower = text.toLowerCase();
  const found = [];

  role.skills.forEach((skill) => {
    const names = [skill.name, ...(skill.aliases || [])];
    const hit = names.some((n) => {
      // matches whole words only, so "py" won't match inside "happy"
      const pattern = new RegExp(
        `(^|[^a-z0-9+#])${escapeRegex(n.toLowerCase())}($|[^a-z0-9+#])`
      );
      return pattern.test(lower);
    });
    if (hit) found.push(skill.name);
  });

  return found;
}

module.exports = { extractText, extractSkills };