import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, fileUrl } from '../../api.js';
import { Alert, Badge, ConfirmModal } from '../../components.jsx';

const emptyTask = { title: '', description: '', link: '' };
const emptyRes = { title: '', type: 'pdf', url: '' };
const RES_LABEL = { pdf: 'PDF', document: 'Document', link: 'Link' };

export default function AdminRoundManage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null); // { kind: 'task' | 'resource', item }
  const [task, setTask] = useState(emptyTask);
  const [taskId, setTaskId] = useState(null);
  const [res, setRes] = useState(emptyRes);
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [tab, setTab] = useState('tests');
  const [aiForm, setAiForm] = useState({ domain: '', focus: '', audience: 'students', goal: '' });
  const [aiBezier, setAiBezier] = useState(null);
  const [aiBusy, setAiBusy] = useState(false);

  const load = useCallback(
    () => api(`/admin/rounds/${id}`).then(setData).catch((e) => setErr(e.message)),
    [id]
  );
  useEffect(() => { load(); }, [load]);

  const run = async (fn, msg) => {
    setErr(''); setOk('');
    try { await fn(); if (msg) setOk(msg); await load(); return true; }
    catch (e) { setErr(e.message); return false; }
  };

  const saveTask = async (e) => {
    e.preventDefault();
    const done = await run(
      () => taskId
        ? api(`/admin/tasks/${taskId}`, { method: 'PUT', body: task })
        : api(`/admin/rounds/${id}/tasks`, { method: 'POST', body: task }),
      taskId ? 'Task updated.' : 'Task added.'
    );
    if (done) { setTask(emptyTask); setTaskId(null); }
  };

  const removeTask = (t) => setConfirmDelete({ kind: 'task', item: t });

  const addResource = async (e) => {
    e.preventDefault();
    const form = new FormData();
    form.append('title', res.title);
    form.append('type', res.type);
    if (res.type === 'link') form.append('url', res.url);
    else if (file) form.append('file', file);
    const done = await run(() => api(`/admin/rounds/${id}/resources`, { method: 'POST', form }), 'Resource added.');
    if (done) { setRes(emptyRes); setFile(null); setFileKey((k) => k + 1); }
  };

  const removeResource = (x) => setConfirmDelete({ kind: 'resource', item: x });

  const confirmRemove = () => {
    const pending = confirmDelete;
    if (!pending) return;
    setConfirmDelete(null);
    if (pending.kind === 'task') run(() => api(`/admin/tasks/${pending.item._id}`, { method: 'DELETE' }), 'Task deleted.');
    else run(() => api(`/admin/resources/${pending.item._id}`, { method: 'DELETE' }), 'Resource deleted.');
  };

  const generateAiRoadmap = async (e) => {
    e.preventDefault();
    setErr(''); setOk('');
    setAiBusy(true);
    try {
      const generated = await api(`/admin/rounds/${id}/resources/ai-roadmap`, { method: 'POST', body: aiForm });
      setAiBezier(generated.roadmap);
      setOk(`AI roadmap added (${generated.added} resources).`);
      setAiForm({ domain: '', focus: '', audience: 'students', goal: '' });
      await load();
    } catch (e2) {
      setErr(e2.message);
    } finally {
      setAiBusy(false);
    }
  };

  if (!data) return <>{err ? <Alert>{err}</Alert> : <p className="muted">Loading…</p>}</>;
  const { round, tasks, resources } = data;

  return (
    <>
      <Link to="/admin/rounds">← Back to rounds</Link>
      <h2>{round.name}</h2>
      <Alert>{err}</Alert>
      <Alert type="success">{ok}</Alert>

      <div className="card">
        <p className="pre"><strong>Description:</strong> {round.description || '—'}</p>
        <p className="pre"><strong>Instructions:</strong> {round.instructions || '—'}</p>
        <small className="muted">Edit these on the Rounds page.</small>
      </div>

      <div className="tabs big-tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'tests'} className={tab === 'tests' ? 'active tests-tab' : ''} onClick={() => setTab('tests')}>Tests ({tasks.length})</button>
        <button role="tab" aria-selected={tab === 'resources'} className={tab === 'resources' ? 'active res-tab' : ''} onClick={() => setTab('resources')}>Resources ({resources.length})</button>
      </div>

      {tab === 'tests' && (<>
      {/* ---------- Tasks ---------- */}
      <form className="card" onSubmit={saveTask}>
        <h3>{taskId ? 'Edit task' : 'Add task'}</h3>
        <label>Title
          <input value={task.title} onChange={(e) => setTask({ ...task, title: e.target.value })} required />
        </label>
        <label>Description
          <textarea rows="3" value={task.description} onChange={(e) => setTask({ ...task, description: e.target.value })} />
        </label>
        <label>Problem link (optional)
          <input type="url" value={task.link} onChange={(e) => setTask({ ...task, link: e.target.value })} placeholder="https://" />
        </label>
        <div className="row">
          <button className="btn">{taskId ? 'Save task' : 'Add task'}</button>
          {taskId && <button type="button" className="btn secondary" onClick={() => { setTask(emptyTask); setTaskId(null); }}>Cancel</button>}
        </div>
      </form>

      <div className="card">
        {tasks.length === 0 ? <p className="muted">No tasks yet.</p> : (
          <ul className="plain divided">
            {tasks.map((t, i) => (
              <li key={t._id} className="row between wrap">
                <div>
                  <strong>{i + 1}. {t.title}</strong>
                  {t.description && <div className="muted clamp">{t.description}</div>}
                  {t.link && <small><a href={t.link} target="_blank" rel="noopener noreferrer">{t.link}</a></small>}
                </div>
                <span className="row">
                  <button className="btn small secondary" onClick={() => { setTaskId(t._id); setTask({ title: t.title, description: t.description, link: t.link }); window.scrollTo({ top: 200, behavior: 'smooth' }); }}>Edit</button>
                  <button className="btn small danger" onClick={() => removeTask(t)}>Delete</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      </>)}

      {tab === 'resources' && (<>
      {/* ---------- AI roadmap generation ---------- */}
      <form className="card" onSubmit={generateAiRoadmap}>
        <h3>Generate AI roadmap</h3>
        <p className="muted">Create a step-by-step learning roadmap for a domain and add the topic-wise resource links directly into this round.</p>
        <div className="grid two">
          <label>Domain
            <input value={aiForm.domain} onChange={(e) => setAiForm({ ...aiForm, domain: e.target.value })} placeholder="AI, Cybersecurity, Data Science" required />
          </label>
          <label>Focus
            <input value={aiForm.focus} onChange={(e) => setAiForm({ ...aiForm, focus: e.target.value })} placeholder="Frontend, Cloud, ML, etc." />
          </label>
        </div>
        <label>Audience
          <input value={aiForm.audience} onChange={(e) => setAiForm({ ...aiForm, audience: e.target.value })} placeholder="students, beginners, job seekers" />
        </label>
        <label>Target goal
          <textarea rows="2" value={aiForm.goal} onChange={(e) => setAiForm({ ...aiForm, goal: e.target.value })} placeholder="Become job-ready in 8 weeks" />
        </label>
        <button className="btn" disabled={aiBusy}>{aiBusy ? 'Generating…' : 'Generate roadmap'}</button>
      </form>

      {aiBezier && (
        <div className="card">
          <h3>{aiBezier.title}</h3>
          <p className="muted">{aiBezier.summary}</p>
          {aiBezier.steps?.map((step, index) => (
            <div key={`${aiBezier.title}-${index}`} style={{ marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '1rem' }}>
              <h4>{index + 1}. {step.title}</h4>
              {step.description && <p className="muted">{step.description}</p>}
              <ul>
                {(step.resources || []).map((resource, resIndex) => (
                  <li key={`${step.title}-${resIndex}`}>
                    <a href={resource.url} target="_blank" rel="noreferrer">{resource.title}</a>
                    {resource.description && <span className="muted"> — {resource.description}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* ---------- Resources ---------- */}
      <form className="card" onSubmit={addResource}>
        <h3>Add resource</h3>
        <div className="grid two">
          <label>Title
            <input value={res.title} onChange={(e) => setRes({ ...res, title: e.target.value })} placeholder="e.g. HTML basics" />
          </label>
          <label>Type
            <select value={res.type} onChange={(e) => setRes({ ...res, type: e.target.value })}>
              <option value="pdf">PDF (upload)</option>
              <option value="document">Document (upload)</option>
              <option value="link">External link</option>
            </select>
          </label>
        </div>
        {res.type === 'link' ? (
          <label>URL
            <input type="url" value={res.url} onChange={(e) => setRes({ ...res, url: e.target.value })} placeholder="https://" required />
          </label>
        ) : (
          <label>File (max 25 MB)
            <input key={fileKey} type="file" accept={res.type === 'pdf' ? '.pdf,application/pdf' : undefined}
              onChange={(e) => setFile(e.target.files[0] || null)} required />
          </label>
        )}
        <button className="btn">Add resource</button>
      </form>

      <div className="card">
        {resources.length === 0 ? <p className="muted">No resources yet.</p> : (
          <ul className="plain divided">
            {resources.map((x) => (
              <li key={x._id} className="row between wrap">
                <span><Badge tone="blue">{RES_LABEL[x.type]}</Badge> <a href={x.type === 'link' ? x.url : fileUrl(x.url)} target="_blank" rel="noopener noreferrer">{x.title}</a></span>
                <button className="btn small danger" onClick={() => removeResource(x)}>Delete</button>
              </li>
            ))}
          </ul>
        )}
      </div>
      </>)}

      <ConfirmModal
        open={!!confirmDelete}
        title={confirmDelete?.kind === 'task' ? 'Delete task?' : 'Delete resource?'}
        message={confirmDelete
          ? (confirmDelete.kind === 'task'
            ? `Delete task "${confirmDelete.item.title}"? Team completions and XP for it will be removed.`
            : `Delete resource "${confirmDelete.item.title}"?`)
          : ''}
        confirmText="Delete"
        tone="danger"
        onConfirm={confirmRemove}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}
