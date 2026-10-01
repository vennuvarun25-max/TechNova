import { useEffect, useState } from 'react';
import { api, fileUrl } from '../../api.js';
import { Alert, Badge, ConfirmModal } from '../../components.jsx';

const emptyForm = { title: '', description: '', type: 'pdf', category: 'test', url: '', problemUrl: '' };
const RES_LABEL = { pdf: 'PDF', document: 'Document', link: 'Link' };
const CATEGORY_LABEL = { test: 'Test resource', shared: 'Shared resource' };

export default function AdminCentralResources() {
  const [items, setItems] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [resourceToDelete, setResourceToDelete] = useState(null);

  const load = () => api('/admin/central-resources').then(setItems).catch((e) => setError(e.message));
  useEffect(() => { load(); }, []);

  const submit = async (event) => {
    event.preventDefault();
    setError('');
    setSuccess('');
    const body = new FormData();
    body.append('title', form.title);
    body.append('description', form.description);
    body.append('type', form.type);
    body.append('category', form.category);
    body.append('problemUrl', form.problemUrl);
    if (form.type === 'link') body.append('url', form.url);
    else if (file) body.append('file', file);
    try {
      await api('/admin/central-resources', { method: 'POST', form: body });
      setSuccess(form.category === 'test' ? 'Test resource added and locked until released.' : 'Shared resource added.');
      setForm(emptyForm);
      setFile(null);
      setFileKey((key) => key + 1);
      await load();
    } catch (e) { setError(e.message); }
  };

  const setReleased = async (resource, isReleased) => {
    setError('');
    setSuccess('');
    try {
      await api(`/admin/central-resources/${resource._id}/access`, { method: 'PUT', body: { isReleased } });
      setSuccess(`${resource.title} ${isReleased ? 'released' : 'locked'}.`);
      await load();
    } catch (e) { setError(e.message); }
  };

  const remove = async () => {
    if (!resourceToDelete) return;
    const resource = resourceToDelete;
    setResourceToDelete(null);
    setError('');
    setSuccess('');
    try {
      await api(`/admin/central-resources/${resource._id}`, { method: 'DELETE' });
      setSuccess('Resource deleted.');
      await load();
    } catch (e) { setError(e.message); }
  };

  return (
    <>
      <div className="page-head">
        <div><p className="eyebrow res-tag">Resource library</p><h2>Central Resources</h2></div>
      </div>
      <Alert>{error}</Alert>
      <Alert type="success">{success}</Alert>

      <form className="card" onSubmit={submit}>
        <h3>Add central resource</h3>
        <div className="grid two">
          <label>Title
            <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Resource title" />
          </label>
          <label>Description <span className="muted">(optional)</span>
            <textarea rows="2" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Add details about this resource" />
          </label>
          <label>Category
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
              <option value="test">Test Resources</option>
              <option value="shared">Shared Resources</option>
            </select>
          </label>
          <label>Type
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="pdf">PDF upload</option>
              <option value="document">Document upload</option>
              <option value="link">External link</option>
            </select>
          </label>
          {form.type === 'link' ? (
            <label>URL
              <input type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://" required />
            </label>
          ) : (
            <label>File (max 25 MB)
              <input key={fileKey} type="file" accept={form.type === 'pdf' ? '.pdf,application/pdf' : undefined} onChange={(e) => setFile(e.target.files[0] || null)} required />
            </label>
          )}
          <label>Problem Link <span className="muted">(optional)</span>
            <input type="url" value={form.problemUrl} onChange={(e) => setForm({ ...form, problemUrl: e.target.value })} placeholder="https://" />
          </label>
        </div>
        <button className="btn">Add resource</button>
        <small className="muted">Test Resources are locked when added. Release them after the test; Shared Resources are available immediately.</small>
      </form>

      <section className="card">
        <h3>Resources</h3>
        {items === null ? <p className="muted">Loading resources…</p> : items.length === 0 ? <p className="muted">No central resources yet.</p> : (
          <ul className="plain divided">
            {items.map((item) => (
              <li key={item._id} className="row between wrap">
                <div>
                  <Badge tone={item.category === 'test' ? 'red' : 'blue'}>{CATEGORY_LABEL[item.category]}</Badge>{' '}
                  <Badge tone="gray">{RES_LABEL[item.type]}</Badge>{' '}
                  {item.type === 'link'
                    ? <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a>
                    : <a href={fileUrl(item.url)} target="_blank" rel="noopener noreferrer">{item.title}</a>}
                  {item.description && <div className="muted">{item.description}</div>}
                  {item.problemUrl && <div className="muted">Problem link added</div>}
                  {item.category === 'test' && <small className="muted">{item.isReleased ? 'Released' : 'Locked'}</small>}
                </div>
                <span className="row">
                  {item.category === 'test' && <button className="btn small secondary" onClick={() => setReleased(item, !item.isReleased)}>{item.isReleased ? 'Lock' : 'Release'}</button>}
                  <button className="btn small danger" onClick={() => setResourceToDelete(item)}>Delete</button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmModal
        open={!!resourceToDelete}
        title="Delete resource?"
        message={resourceToDelete ? `Delete "${resourceToDelete.title}"? This cannot be undone.` : ''}
        confirmText="Delete"
        tone="danger"
        onConfirm={remove}
        onCancel={() => setResourceToDelete(null)}
      />
    </>
  );
}
