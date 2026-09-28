import { Link, useParams } from 'react-router-dom';
import { fileUrl } from '../../api.js';
import { usePoll } from '../../hooks.js';
import { Badge, LockedPanel } from '../../components.jsx';

const RES_LABEL = { pdf: 'PDF', document: 'Document', link: 'Link' };
const RES_TONE = { pdf: 'red', document: 'blue', link: 'green' };

export default function StudentResources() {
  const { id } = useParams();
  const { data, error } = usePoll(`/student/rounds/${id}/resources`, 5000);

  if (!data && error) {
    return <LockedPanel title="Resources are closed" message={error} backTo={`/rounds/${id}`} backLabel="Back to round" />;
  }
  if (!data) return <p className="muted">Loading…</p>;
  const { round, resources } = data;

  return (
    <>
      <Link to={`/rounds/${id}`} className="back">← Back to round</Link>
      <div className="page-head">
        <div><p className="eyebrow res-tag">Resources</p><h2>{round.name}</h2></div>
      </div>

      {resources.length === 0 && <div className="card muted">No resources for this round.</div>}
      <div className="grid two">
        {resources.map((x) => (
          <div className="card resource" key={x._id}>
            <Badge tone={RES_TONE[x.type]}>{RES_LABEL[x.type]}</Badge>
            <h3>{x.title}</h3>
            <div className="row">
              {x.type === 'link' ? (
                <a className="btn res small" href={x.url} target="_blank" rel="noopener noreferrer">Open link</a>
              ) : (
                <>
                  <a className="btn res small" href={fileUrl(x.url)} target="_blank" rel="noopener noreferrer">View</a>
                  <a className="btn secondary small" href={fileUrl(x.url, true)}>Download</a>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
