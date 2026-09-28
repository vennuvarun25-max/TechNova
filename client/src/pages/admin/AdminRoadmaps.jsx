import { useEffect, useMemo, useState } from 'react';
import { api } from '../../api.js';
import { Alert, ConfirmModal } from '../../components.jsx';

const emptyStep = () => ({ title: '', description: '', resources: [{ title: '', type: 'link', url: '', description: '' }] });
const emptyForm = {
  domain: '',
  title: '',
  description: '',
  isLocked: true,
  steps: [emptyStep()],
};

export default function AdminRoadmaps() {
  const [roadmaps, setRoadmaps] = useState([]);
  const [teams, setTeams] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState(null);
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [confirmRoadmap, setConfirmRoadmap] = useState(null);

  const load = async () => {
    try {
      const [roadmapData, teamData] = await Promise.all([
        api('/roadmaps/all'),
        api('/admin/teams'),
      ]);
      setRoadmaps(roadmapData.roadmaps || []);
      setTeams(teamData || []);
    } catch (e) {
      setErr(e.message);
    }
  };

  useEffect(() => { load(); }, []);

  const addStep = () => setForm((current) => ({ ...current, steps: [...current.steps, emptyStep()] }));

  const updateStep = (index, field, value) => {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, stepIndex) => stepIndex === index ? { ...step, [field]: value } : step),
    }));
  };

  const updateResource = (stepIndex, resourceIndex, field, value) => {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, idx) => idx === stepIndex ? ({
        ...step,
        resources: step.resources.map((resource, resourceIdx) => resourceIdx === resourceIndex ? { ...resource, [field]: value } : resource),
      }) : step),
    }));
  };

  const addResource = (stepIndex) => {
    setForm((current) => ({
      ...current,
      steps: current.steps.map((step, idx) => idx === stepIndex ? { ...step, resources: [...step.resources, { title: '', type: 'link', url: '', description: '' }] } : step),
    }));
  };

  const reset = () => {
    setForm(emptyForm);
    setEditId(null);
  };

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setOk('');
    try {
      if (editId) await api(`/roadmaps/${editId}`, { method: 'PUT', body: form });
      else await api('/roadmaps', { method: 'POST', body: form });
      setOk(editId ? 'Roadmap updated.' : 'Roadmap created.');
      reset();
      load();
    } catch (e2) {
      setErr(e2.message);
    }
  };

  const toggleAccess = async (roadmapId, teamId, isGranted, message) => {
    try {
      await api(`/roadmaps/${roadmapId}/access`, { method: 'POST', body: { teamId, isGranted, message } });
      setOk('Access updated.');
      load();
    } catch (e2) {
      setErr(e2.message);
    }
  };

  const edit = (roadmap) => {
    setEditId(roadmap._id);
    setForm({
      domain: roadmap.domain,
      title: roadmap.title,
      description: roadmap.description || '',
      isLocked: !!roadmap.isLocked,
      steps: roadmap.steps?.length ? roadmap.steps.map((step) => ({
        title: step.title,
        description: step.description || '',
        resources: step.resources?.length ? step.resources.map((resource) => ({
          title: resource.title,
          type: resource.type || 'link',
          url: resource.url || '',
          description: resource.description || '',
        })) : [{ title: '', type: 'link', url: '', description: '' }],
      })) : [emptyStep()],
    });
  };

  const remove = (roadmap) => setConfirmRoadmap(roadmap);

  const confirmRemove = async () => {
    const roadmap = confirmRoadmap;
    if (!roadmap) return;
    setConfirmRoadmap(null);
    try {
      await api(`/roadmaps/${roadmap._id}`, { method: 'DELETE' });
      setOk('Roadmap deleted.');
      load();
    } catch (e2) {
      setErr(e2.message);
    }
  };

  return (
    <>
      <h2>Roadmap management</h2>
      <Alert>{err}</Alert>
      <Alert type="success">{ok}</Alert>

      <form className="card" onSubmit={submit}>
        <h3>{editId ? 'Edit roadmap' : 'Create roadmap'}</h3>
        <div className="grid two">
          <label>Domain
            <input value={form.domain} onChange={(e) => setForm({ ...form, domain: e.target.value })} placeholder="AI / Cybersecurity / Cloud" required />
          </label>
          <label>Lock status
            <select value={String(form.isLocked)} onChange={(e) => setForm({ ...form, isLocked: e.target.value === 'true' })}>
              <option value="true">Locked</option>
              <option value="false">Open</option>
            </select>
          </label>
        </div>
        <label>Roadmap title
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Career roadmap" required />
        </label>
        <label>Description
          <textarea rows="2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </label>

        {form.steps.map((step, stepIndex) => (
          <div key={`step-${stepIndex}`} className="card" style={{ marginTop: '1rem', padding: '1rem' }}>
            <div className="row between">
              <h4>Step {stepIndex + 1}</h4>
              {form.steps.length > 1 && <button type="button" className="btn small secondary" onClick={() => setForm((current) => ({ ...current, steps: current.steps.filter((_, idx) => idx !== stepIndex) }))}>Remove</button>}
            </div>
            <label>Step title
              <input value={step.title} onChange={(e) => updateStep(stepIndex, 'title', e.target.value)} required />
            </label>
            <label>Step description
              <textarea rows="2" value={step.description} onChange={(e) => updateStep(stepIndex, 'description', e.target.value)} />
            </label>
            {(step.resources || []).map((resource, resourceIndex) => (
              <div key={`resource-${stepIndex}-${resourceIndex}`} style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 12, padding: '0.75rem', marginTop: '0.75rem' }}>
                <div className="grid two">
                  <label>Resource title
                    <input value={resource.title} onChange={(e) => updateResource(stepIndex, resourceIndex, 'title', e.target.value)} />
                  </label>
                  <label>Type
                    <select value={resource.type || 'link'} onChange={(e) => updateResource(stepIndex, resourceIndex, 'type', e.target.value)}>
                      <option value="link">Link</option>
                      <option value="pdf">PDF</option>
                      <option value="document">Document</option>
                    </select>
                  </label>
                </div>
                <label>URL
                  <input value={resource.url} onChange={(e) => updateResource(stepIndex, resourceIndex, 'url', e.target.value)} placeholder="https://..." />
                </label>
                <label>Resource note
                  <input value={resource.description} onChange={(e) => updateResource(stepIndex, resourceIndex, 'description', e.target.value)} />
                </label>
              </div>
            ))}
            <button type="button" className="btn small secondary" style={{ marginTop: '0.75rem' }} onClick={() => addResource(stepIndex)}>Add resource</button>
          </div>
        ))}

        <button type="button" className="btn small secondary" style={{ marginTop: '1rem' }} onClick={addStep}>Add step</button>

        <div className="row" style={{ marginTop: '1rem' }}>
          <button className="btn">{editId ? 'Save changes' : 'Create roadmap'}</button>
          {editId && <button type="button" className="btn secondary" onClick={reset}>Cancel</button>}
        </div>
      </form>

      <div className="card">
        <h3>Roadmaps</h3>
        {roadmaps.length === 0 ? <p className="muted">No roadmaps yet.</p> : (
          roadmaps.map((roadmap) => (
            <div key={roadmap._id} style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px', padding: '1rem', marginBottom: '1rem' }}>
              <div className="row between">
                <div>
                  <p className="eyebrow">{roadmap.domain}</p>
                  <h4>{roadmap.title}</h4>
                </div>
                <span className={`badge ${roadmap.isLocked ? 'red' : 'green'}`}>{roadmap.isLocked ? 'Locked' : 'Open'}</span>
              </div>
              <p className="muted">{roadmap.description || 'No description provided.'}</p>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                <button className="btn small" type="button" onClick={() => edit(roadmap)}>Edit</button>
                <button className="btn small danger" type="button" onClick={() => remove(roadmap)}>Delete</button>
              </div>

              <div>
                <h5>Grant access</h5>
                {teams.length === 0 ? <p className="muted">No teams available.</p> : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {teams.map((team) => {
                      const match = (roadmap.access || []).find((entry) => String(entry.team?._id || entry.team) === String(team._id));
                      const allowed = !!match?.isGranted;
                      return (
                        <div key={`${roadmap._id}-${team._id}`} className="row between" style={{ border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, padding: '0.5rem 0.75rem' }}>
                          <span>{team.name} ({team.teamId})</span>
                          <div className="row" style={{ gap: '0.5rem' }}>
                            <button className="btn small" type="button" onClick={() => toggleAccess(roadmap._id, team._id, !allowed, allowed ? 'Access revoked by admin' : 'Access granted by admin')}>{allowed ? 'Revoke' : 'Grant'}</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <ConfirmModal
        open={!!confirmRoadmap}
        title="Delete roadmap?"
        message={confirmRoadmap ? `Delete "${confirmRoadmap.title}"? This cannot be undone.` : ''}
        confirmText="Delete"
        tone="danger"
        onConfirm={confirmRemove}
        onCancel={() => setConfirmRoadmap(null)}
      />
    </>
  );
}
