import { useMemo, useState } from 'react';
import { api } from '../../api.js';
import { usePoll } from '../../hooks.js';
import { Alert, ConfirmModal, ProjectCard, TechStackPicker } from '../../components.jsx';

const emptyForm = { title: '', description: '', techStack: [], githubUrl: '', demoUrl: '', status: 'Ongoing', members: '' };

function ProjectForm({ initial, onCancel, onSaved, meMembers }) {
  const [form, setForm] = useState(initial);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const useTeamRoster = () => {
    setForm((f) => ({ ...f, members: meMembers.join(', ') }));
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    if (!form.title.trim()) { setErr('Project title is required.'); return; }
    setSaving(true);
    try {
      const body = { ...form, techStack: form.techStack, members: form.members };
      if (form._id) await api(`/student/projects/${form._id}`, { method: 'PUT', body });
      else await api('/student/projects', { method: 'POST', body });
      onSaved();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="card project-form" onSubmit={submit}>
      <h3>{form._id ? 'Edit project' : 'Add your project'}</h3>
      <Alert>{err}</Alert>
      <label>Project title
        <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Smart Campus Assistant" required />
      </label>
      <label>Description
        <textarea rows="3" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What does your project do?" />
      </label>
      <label>Tech stack
        <TechStackPicker value={form.techStack} onChange={(techStack) => setForm({ ...form, techStack })} />
      </label>
      <label>Status
        <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
          <option value="Ongoing">Ongoing</option>
          <option value="Completed">Completed</option>
        </select>
      </label>
      <div className="grid two">
        <label>GitHub link
          <input value={form.githubUrl} onChange={(e) => setForm({ ...form, githubUrl: e.target.value })} placeholder="https://github.com/your-team/project" />
        </label>
        <label>Live demo link
          <input value={form.demoUrl} onChange={(e) => setForm({ ...form, demoUrl: e.target.value })} placeholder="https://your-demo.example.com" />
        </label>
      </div>
      <label>Team members involved <span className="muted">(comma separated)</span>
        {meMembers.length > 0 && (
          <button type="button" className="btn small secondary" style={{ marginLeft: '.6rem', marginTop: '-.2rem' }} onClick={useTeamRoster}>Use my team roster</button>
        )}
        <input value={form.members} onChange={(e) => setForm({ ...form, members: e.target.value })} placeholder="Asha, Ravi, Priya" />
      </label>
      <div className="row" style={{ marginTop: '.4rem' }}>
        <button className="btn" disabled={saving}>{saving ? 'Saving…' : form._id ? 'Save changes' : 'Add project'}</button>
        <button type="button" className="btn secondary" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
}

export default function StudentProjects() {
  const { data: all, error, reload } = usePoll('/student/projects', 12000);
  const mine = usePoll('/student/projects/mine', 12000);
  const me = usePoll('/student/me', 15000);

  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [tech, setTech] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [actionErr, setActionErr] = useState('');
  const [confirmProject, setConfirmProject] = useState(null);

  const myTeamName = me.data?.name;
  const myTeamIds = useMemo(() => new Set((mine.data || []).map((p) => String(p._id))), [mine.data]);
  const meMembers = useMemo(() => (me.data?.members || []).map((m) => m.fullName), [me.data]);

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

  const startAdd = () => { setEditing(null); setShowForm(true); };
  const startEdit = (p) => {
    setEditing(p);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const closeForm = () => { setShowForm(false); setEditing(null); };
  const saved = () => { closeForm(); reload(); mine.reload(); };

  const remove = (p) => { setActionErr(''); setConfirmProject(p); };

  const confirmRemove = async () => {
    const p = confirmProject;
    if (!p) return;
    setConfirmProject(null);
    try {
      await api(`/student/projects/${p._id}`, { method: 'DELETE' });
      reload(); mine.reload();
    } catch (e) {
      setActionErr(e.message);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <p className="eyebrow tests-tag">Project Showcase</p>
          <h2>TechNova projects</h2>
        </div>
        <button type="button" className="btn" onClick={startAdd}>+ Add project</button>
      </div>

      <Alert>{error}</Alert>
      <Alert>{actionErr}</Alert>

      {showForm && (
        <ProjectForm
          initial={editing ? {
            _id: editing._id,
            title: editing.title,
            description: editing.description,
            techStack: editing.techStack || [],
            githubUrl: editing.githubUrl,
            demoUrl: editing.demoUrl,
            status: editing.status,
            members: (editing.members || []).join(', '),
          } : emptyForm}
          onCancel={closeForm}
          onSaved={saved}
          meMembers={meMembers}
        />
      )}

      <div className="card project-toolbar">
        <div className="grid three">
          <label>Search
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search title, description, tech, member…" />
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
          {all.length === 0 ? 'No projects have been added yet. Be the first team to showcase your work!' : 'No projects match your search/filter.'}
        </div>
      ) : (
        <div className="grid three project-grid">
          {filtered.map((p) => (
            <ProjectCard
              key={p._id}
              p={p}
              mine={myTeamIds.has(String(p._id)) || p.teamName === myTeamName}
              onEdit={startEdit}
              onDelete={remove}
            />
          ))}
        </div>
      )}

      <ConfirmModal
        open={!!confirmProject}
        title="Delete project?"
        message={confirmProject ? `Delete "${confirmProject.title}"? This cannot be undone.` : ''}
        confirmText="Delete"
        tone="danger"
        onConfirm={confirmRemove}
        onCancel={() => setConfirmProject(null)}
      />
    </>
  );
}
