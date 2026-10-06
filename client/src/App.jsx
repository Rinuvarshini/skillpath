import { useState, useEffect } from 'react';
import {
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer,
} from 'recharts';

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const STORAGE_KEY = 'skillpath-saved';

// read the saved session from the browser (returns null if nothing or if it fails)
function loadSaved() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function App() {
  const [saved] = useState(loadSaved);

  const [role, setRole] = useState(saved?.role || 'Data Analyst');
  const [roles, setRoles] = useState([]);
  const [language, setLanguage] = useState(saved?.language || 'English');
  const [skillsText, setSkillsText] = useState('python, excel, mysql');
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(saved?.result || null);
  const [roadmap, setRoadmap] = useState(saved?.roadmap || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // load the list of roles for the dropdown
  useEffect(() => {
    fetch(`${BASE}/roles`)
      .then((r) => r.json())
      .then((list) => {
        setRoles(list);
        setRole((current) => (list.includes(current) ? current : list[0]));
      })
      .catch(() => {});
  }, []);

  // save the result and the ticked weeks whenever they change
  useEffect(() => {
    if (!result) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ role: result.role, language, result, roadmap })
      );
    } catch {
      // saving is optional, so ignore errors
    }
  }, [result, roadmap, language]);

  async function handleAnalyze() {
    setLoading(true);
    setError('');
    setResult(null);
    setRoadmap([]);
    try {
      let res;
      if (file) {
        const form = new FormData();
        form.append('role', role);
        form.append('language', language);
        form.append('resume', file);
        res = await fetch(`${BASE}/analyze`, { method: 'POST', body: form });
      } else {
        const skills = skillsText.split(',').map((s) => s.trim()).filter(Boolean);
        res = await fetch(`${BASE}/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role, skills, language }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Something went wrong');
      setResult(data);
      setRoadmap(data.roadmap);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  function toggleWeek(weekNumber) {
    setRoadmap((prev) =>
      prev.map((w) => (w.week === weekNumber ? { ...w, done: !w.done } : w))
    );
  }

  // clear the saved session and start fresh
  function startOver() {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setResult(null);
    setRoadmap([]);
    setFile(null);
    setError('');
  }

  const doneCount = roadmap.filter((w) => w.done).length;
  const readiness = result
    ? Math.round(
        result.matchScore +
          (100 - result.matchScore) * (roadmap.length ? doneCount / roadmap.length : 0)
      )
    : 0;

  const chartData = result
    ? [
        ...result.haveSkills.map((s) => ({ skill: s, value: 100 })),
        ...result.missingSkills.map((s) => ({ skill: s, value: 0 })),
      ]
    : [];

  return (
    <div className="container">
      <div className="hero">
        <h1>SkillPath</h1>
        <p>Find your skill gaps and get a free, personalized learning roadmap</p>
      </div>

      <div className="card">
        <label>Target role</label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {roles.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>

        <label>Roadmap language</label>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="English">English</option>
          <option value="Tamil">தமிழ் (Tamil)</option>
          <option value="Hindi">हिन्दी (Hindi)</option>
        </select>

        <label>Upload your resume (PDF)</label>
        <input type="file" accept="application/pdf"
          onChange={(e) => setFile(e.target.files[0] || null)} />

        <label>Or type your skills (comma separated)</label>
        <input type="text" value={skillsText}
          onChange={(e) => setSkillsText(e.target.value)} disabled={!!file} />

        <button className="btn" onClick={handleAnalyze} disabled={loading}>
          {loading ? 'Analyzing... (can take a few seconds)' : 'Analyze my skills'}
        </button>
        {result && (
          <button className="btn" onClick={startOver}
            style={{ marginLeft: 10, background: '#6b7280' }}>
            Start over
          </button>
        )}
        {error && <p className="error">{error}</p>}
      </div>

      {result && (
        <>
          <div className="card">
            <h2>Readiness for {result.role}</h2>
            <div className="bar"><div style={{ width: `${readiness}%` }} /></div>
            <div className="stats">
              <div className="stat"><div className="num">{readiness}%</div><div className="lbl">Readiness now</div></div>
              <div className="stat"><div className="num">{result.matchScore}%</div><div className="lbl">Starting match</div></div>
              <div className="stat"><div className="num">{doneCount}/{roadmap.length}</div><div className="lbl">Weeks completed</div></div>
            </div>

            <div style={{ width: '100%', height: 300 }}>
              <ResponsiveContainer>
                <RadarChart data={chartData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="skill" />
                  <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                  <Radar dataKey="value" stroke="#2563eb" fill="#2563eb" fillOpacity={0.4} />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h2>Your skill gap</h2>
            <label>Skills you have</label>
            <div className="chips">
              {result.haveSkills.length
                ? result.haveSkills.map((s) => <span key={s} className="chip have">{s}</span>)
                : <span>none yet</span>}
            </div>
            <label>Skills to learn</label>
            <div className="chips">
              {result.missingSkills.length
                ? result.missingSkills.map((s) => <span key={s} className="chip miss">{s}</span>)
                : <span>You have every skill for this role!</span>}
            </div>
          </div>

          <div className="card">
            <h2>Your learning roadmap</h2>
            {roadmap.map((w) => (
              <div key={w.week} className={`week ${w.done ? 'done' : ''}`}>
                <label className="week-title">
                  <input type="checkbox" checked={w.done} onChange={() => toggleWeek(w.week)} />
                  Week {w.week}: {w.topic}
                </label>
                <p>{w.explanation}</p>
                <p className="project"><b>Mini project:</b> {w.project}</p>
                <div className="links">
                  {w.resources.map((r) => (
                    <a key={r.url} href={r.url} target="_blank" rel="noreferrer">
                      {r.title} ↗
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}