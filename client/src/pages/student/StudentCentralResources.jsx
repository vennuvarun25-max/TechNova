import { useState } from 'react';
import { fileUrl } from '../../api.js';
import { Alert, Badge } from '../../components.jsx';
import { usePoll } from '../../hooks.js';

const CATEGORIES = [
  ['all', 'All'],
  ['test', 'Test Resources'],
  ['shared', 'Shared Resources'],
];
const RES_LABEL = { pdf: 'PDF', document: 'Document', link: 'Link' };
const RES_TONE = { pdf: 'red', document: 'blue', link: 'green' };

export default function StudentCentralResources() {
  const { data, error } = usePoll('/student/central-resources', 7000);
  const [category, setCategory] = useState('all');
  const visible = (data || []).filter((item) => category === 'all' || item.category === category);

  return (
    <>
      <div className="page-head">
        <div><p className="eyebrow res-tag">Resource library</p><h2>Central Resources</h2></div>
      </div>
      <Alert>{error}</Alert>

      <div className="tabs big-tabs" role="tablist" aria-label="Resource category">
        {CATEGORIES.map(([value, label]) => (
          <button key={value} role="tab" aria-selected={category === value} className={category === value ? 'active res-tab' : ''} onClick={() => setCategory(value)}>{label}</button>
        ))}
      </div>

      {!data ? <p className="muted">Loading resources…</p> : visible.length === 0 ? (
        <div className="card muted">No released resources in this category.</div>
      ) : (
        <div className="grid two">
          {visible.map((item) => (
            <article className="card resource" key={item._id}>
              <div className="row between wrap">
                <Badge tone={RES_TONE[item.type]}>{RES_LABEL[item.type]}</Badge>
                <Badge tone={item.category === 'test' ? 'red' : 'blue'}>{item.category === 'test' ? 'Test Resource' : 'Shared Resource'}</Badge>
              </div>
              <h3>{item.title}</h3>
              {item.roundName && <small className="muted">{item.day} · {item.roundName}</small>}
              <div className="row">
                {item.type === 'link' ? (
                  <a className="btn res small" href={item.url} target="_blank" rel="noopener noreferrer">Open link</a>
                ) : (
                  <>
                    <a className="btn res small" href={fileUrl(item.url)} target="_blank" rel="noopener noreferrer">View</a>
                    <a className="btn secondary small" href={fileUrl(item.url, true)}>Download</a>
                  </>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
