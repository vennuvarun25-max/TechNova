import { useEffect, useState } from 'react';
import { api, fileUrl } from '../../api.js';
import { Alert } from '../../components.jsx';

const emptyPerson = () => ({ name: '', bio: '', imageUrl: '', imageFileName: '' });
const emptyAbout = () => ({
  title: 'About TechNova',
  introduction: '',
  imageUrl: '',
  imageFileName: '',
  leads: [emptyPerson(), emptyPerson()],
  coLeads: [emptyPerson(), emptyPerson()],
});

function prepareAbout(data) {
  const defaults = emptyAbout();
  return {
    ...defaults,
    ...data,
    leads: data.leads?.length === 2 ? data.leads : defaults.leads,
    coLeads: data.coLeads?.length >= 2 ? data.coLeads : defaults.coLeads,
  };
}

function PortraitPicker({ person, onFile, onRemove, removing }) {
  const [preview, setPreview] = useState('');
  useEffect(() => {
    const selectedFile = person.selectedImage;
    if (!selectedFile) { setPreview(''); return undefined; }
    const url = URL.createObjectURL(selectedFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [person.selectedImage]);

  const imageUrl = preview || (!removing && person.imageUrl ? fileUrl(person.imageUrl) : '');
  return (
    <div className="about-portrait-control">
      {imageUrl && <img className="about-person-image" src={imageUrl} alt={`${person.name || 'Leadership'} portrait`} />}
      <label>Profile image
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onFile(event.target.files?.[0] || null)} />
      </label>
      {person.imageUrl && !person.selectedImage && <button type="button" className="btn small secondary" onClick={onRemove}>{removing ? 'Keep current portrait' : 'Remove portrait'}</button>}
      {person.selectedImage && <button type="button" className="btn small secondary" onClick={() => onFile(null)}>Clear selected image</button>}
    </div>
  );
}

export default function AdminAbout() {
  const [content, setContent] = useState(emptyAbout);
  const [image, setImage] = useState(null);
  const [profileImages, setProfileImages] = useState({});
  const [removedProfileImages, setRemovedProfileImages] = useState({});
  const [removeImage, setRemoveImage] = useState(false);
  const [imageInputKey, setImageInputKey] = useState(0);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try { setContent(prepareAbout(await api('/admin/about'))); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const updatePerson = (group, index, field, value) => {
    setContent((current) => ({
      ...current,
      [group]: current[group].map((person, personIndex) => personIndex === index ? { ...person, [field]: value } : person),
    }));
  };

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    const form = new FormData();
    form.append('title', content.title);
    form.append('introduction', content.introduction);
    form.append('leads', JSON.stringify(content.leads.map(({ name, bio }) => ({ name, bio }))));
    form.append('coLeads', JSON.stringify(content.coLeads.map(({ name, bio }) => ({ name, bio }))));
    form.append('removeImage', String(removeImage));
    if (image) form.append('image', image);
    for (const [group, prefix] of [['leads', 'leadImage'], ['coLeads', 'coLeadImage']]) {
      content[group].forEach((_, index) => {
        const key = `${group}-${index}`;
        form.append(`remove${prefix[0].toUpperCase()}${prefix.slice(1)}${index}`, String(!!removedProfileImages[key]));
        if (profileImages[key]) form.append(`${prefix}${index}`, profileImages[key]);
      });
    }
    try {
      setContent(prepareAbout(await api('/admin/about', { method: 'PUT', form })));
      setImage(null);
      setProfileImages({});
      setRemovedProfileImages({});
      setRemoveImage(false);
      setImageInputKey((key) => key + 1);
      setSuccess('About page updated.');
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const [localImagePreview, setLocalImagePreview] = useState('');
  useEffect(() => {
    if (!image) { setLocalImagePreview(''); return undefined; }
    const previewUrl = URL.createObjectURL(image);
    setLocalImagePreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [image]);
  const imagePreview = localImagePreview || (!removeImage && content.imageUrl ? fileUrl(content.imageUrl) : '');

  const updatePersonImage = (group, index, file) => {
    const key = `${group}-${index}`;
    setProfileImages((current) => ({ ...current, [key]: file }));
    if (file) setRemovedProfileImages((current) => ({ ...current, [key]: false }));
  };

  const removeLastCoLead = () => {
    const index = content.coLeads.length - 1;
    const key = `coLeads-${index}`;
    setContent((current) => ({ ...current, coLeads: current.coLeads.slice(0, -1) }));
    setProfileImages((current) => { const next = { ...current }; delete next[key]; return next; });
    setRemovedProfileImages((current) => { const next = { ...current }; delete next[key]; return next; });
  };

  return (
    <>
      <div className="page-head"><div><p className="eyebrow res-tag">Site content</p><h2>About TechNova</h2></div></div>
      <Alert>{error}</Alert>
      <Alert type="success">{success}</Alert>
      {loading ? <p className="muted">Loading About content…</p> : (
        <form className="about-editor" onSubmit={submit}>
          <section className="card">
            <h3>About page</h3>
            <label>Page title
              <input value={content.title} onChange={(event) => setContent({ ...content, title: event.target.value })} required />
            </label>
            <label>Introduction
              <textarea rows="4" value={content.introduction} onChange={(event) => setContent({ ...content, introduction: event.target.value })} />
            </label>
          </section>

          <section className="card">
            <h3>About image</h3>
            {imagePreview && <img className="about-admin-image" src={imagePreview} alt="About page preview" />}
            <label>Upload image
              <input key={imageInputKey} type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => { setImage(event.target.files?.[0] || null); setRemoveImage(false); }} />
            </label>
            {content.imageUrl && !image && (
              <label className="check">
                <input type="checkbox" checked={removeImage} onChange={(event) => setRemoveImage(event.target.checked)} />
                Remove current image
              </label>
            )}
          </section>

          <section className="card">
            <h3>TechNova leads</h3>
            <div className="about-person-grid">
              {content.leads.map((person, index) => (
                <div className="about-editor-person" key={`lead-${index}`}>
                  <h4>Lead</h4>
                  <PortraitPicker
                    person={{ ...person, selectedImage: profileImages[`leads-${index}`] }}
                    removing={!!removedProfileImages[`leads-${index}`]}
                    onFile={(file) => updatePersonImage('leads', index, file)}
                    onRemove={() => setRemovedProfileImages((current) => ({ ...current, [`leads-${index}`]: !current[`leads-${index}`] }))}
                  />
                  <label>Name
                    <input value={person.name} onChange={(event) => updatePerson('leads', index, 'name', event.target.value)} required />
                  </label>
                  <label>Bio
                    <textarea rows="3" value={person.bio} onChange={(event) => updatePerson('leads', index, 'bio', event.target.value)} />
                  </label>
                </div>
              ))}
            </div>
          </section>

          <section className="card">
            <div className="row between wrap">
              <h3>TechNova co-leads</h3>
              {content.coLeads.length < 3 && <button type="button" className="btn small secondary" onClick={() => setContent((current) => ({ ...current, coLeads: [...current.coLeads, emptyPerson()] }))}>Add co-lead</button>}
            </div>
            <div className="about-person-grid">
              {content.coLeads.map((person, index) => (
                <div className="about-editor-person" key={`co-lead-${index}`}>
                  <div className="row between"><h4>Co-lead</h4>{content.coLeads.length > 2 && index === content.coLeads.length - 1 && <button type="button" className="btn small danger" onClick={removeLastCoLead}>Remove</button>}</div>
                  <PortraitPicker
                    person={{ ...person, selectedImage: profileImages[`coLeads-${index}`] }}
                    removing={!!removedProfileImages[`coLeads-${index}`]}
                    onFile={(file) => updatePersonImage('coLeads', index, file)}
                    onRemove={() => setRemovedProfileImages((current) => ({ ...current, [`coLeads-${index}`]: !current[`coLeads-${index}`] }))}
                  />
                  <label>Name
                    <input value={person.name} onChange={(event) => updatePerson('coLeads', index, 'name', event.target.value)} required />
                  </label>
                  <label>Bio
                    <textarea rows="3" value={person.bio} onChange={(event) => updatePerson('coLeads', index, 'bio', event.target.value)} />
                  </label>
                </div>
              ))}
            </div>
          </section>

          <button className="btn" disabled={saving}>{saving ? 'Saving…' : 'Save About page'}</button>
        </form>
      )}
    </>
  );
}
