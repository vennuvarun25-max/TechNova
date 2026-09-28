import { useMemo, useState } from 'react';
import { usePoll } from '../../hooks.js';
import { Alert, ProjectCard } from '../../components.jsx';

// Read-only Project Showcase view for individual members. Visibility mirrors
// their own team account: every project belonging to their team (any
// status) plus Completed projects from other teams — enforced server-side
// by /api/member/projects (buildProjectVisibilityFilter), not filtered here.
// Members don't manage a project's content — only the owning `team` account
// (or an admin) can add/edit/delete — so there is no form here, same as
// AdminProjects.
export default function MemberProjects() {
  const me = usePoll('/member/me', 15000);
  const { data: all, error } = usePoll('/member/projects', 12000);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [tech, setTech] = useState('');

  const myTeamName = me.data?.teamName;

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
          <h2>TechNova projects</h2>
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
          {all.length === 0 ? 'No projects have been added yet. Ask your team to showcase your work!' : 'No projects match your search/filter.'}
        </div>
      ) : (
        <div className="grid three project-grid">
          {filtered.map((p) => (
            <ProjectCard key={p._id} p={p} mine={p.teamName === myTeamName} />
          ))}
        </div>
      )}
    </>
  );
}
