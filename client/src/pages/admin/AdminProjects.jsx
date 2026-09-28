import { useMemo, useState } from 'react';
import { usePoll } from '../../hooks.js';
import { Alert, ProjectCard } from '../../components.jsx';

// Read-only Project Showcase view for admins. Unlike the team view, this
// gets back every project regardless of status or team — enforced by the
// backend (/api/admin/projects), not filtered here.
export default function AdminProjects() {
  const { data: all, error } = usePoll('/admin/projects', 12000);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [tech, setTech] = useState('');

  const techOptions = useMemo(() => {
    const set = new Set();
    (all || []).forEach((p) => (p.techStack || []).forEach((t) => set.add(t)));
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [all]);

  const filtered = useMemo(() => {
    let list = all || [];
    if (status) list = list.filter((p) => p.status === status);
    if (tech) list = list.filter((p) => (p.techStack || []).some((t) => t.toLowerCase() === tech.toLowerCase()));
    if (q.trim()) {
      const needle = q.trim().toLowerCase();
      list = list.filter((p) => [p.title, p.description, ...(p.techStack || []), ...(p.members || []), p.teamName]
        .join(' ').toLowerCase().includes(needle));
    }
    return list;
  }, [all, q, status, tech]);

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow tests-tag">Project Showcase</p>
          <h2>All teams' projects</h2>
        </div>
      </div>

      <Alert>{error}</Alert>

      <div className="card project-toolbar">
        <div className="grid three">
          <label>Search
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, description, tech, team…" />
          </label>
          <label>Status
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">All statuses</option>
              <option value="Ongoing">Ongoing</option>
              <option value="Completed">Completed</option>
            </select>
          </label>
          <label>Tech stack
            <select value={tech} onChange={(e) => setTech(e.target.value)}>
              <option value="">All technologies</option>
              {techOptions.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </label>
        </div>
      </div>

      {!all ? (
        <p className="muted">Loading projects…</p>
      ) : filtered.length === 0 ? (
        <div className="card muted">
          {all.length === 0 ? 'No projects have been added yet.' : 'No projects match your search/filter.'}
        </div>
      ) : (
        <div className="grid three project-grid">
          {filtered.map((p) => <ProjectCard key={p._id} p={p} />)}
        </div>
      )}
    </>
  );
}
