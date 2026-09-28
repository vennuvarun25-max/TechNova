import { useEffect, useState } from 'react';
import { Alert } from '../../components.jsx';
import { api } from '../../api.js';

export default function StudentRoadmaps() {
  const [roadmaps, setRoadmaps] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    api('/roadmaps/me')
      .then((data) => setRoadmaps(data.roadmaps || []))
      .catch((e) => setErr(e.message));
  }, []);

  return (
    <>
      <h2>Career Roadmaps</h2>
      <Alert>{err}</Alert>
      {!roadmaps.length ? (
        <div className="card muted">No roadmaps are available yet.</div>
      ) : (
        roadmaps.map((roadmap) => (
          <div className="card" key={roadmap._id} style={{ marginBottom: '1.25rem' }}>
            <div className="row between">
              <div>
                <p className="eyebrow">{roadmap.domain}</p>
                <h3>{roadmap.title}</h3>
              </div>
              <span className={`badge ${roadmap.isLocked ? 'red' : 'green'}`}>{roadmap.isLocked ? 'Locked' : 'Open'}</span>
            </div>
            {roadmap.description && <p className="muted">{roadmap.description}</p>}
            {!roadmap.access && (
              <div className="alert error">{roadmap.reason || 'This roadmap is locked. Please request access from the admin.'}</div>
            )}
            {roadmap.access && (
              <div>
                {roadmap.steps?.map((step, index) => (
                  <div key={`${roadmap._id}-step-${index}`} style={{ borderTop: '1px solid rgba(255,255,255,0.12)', paddingTop: '1rem', marginTop: '1rem' }}>
                    <h4>{index + 1}. {step.title}</h4>
                    {step.description && <p className="muted">{step.description}</p>}
                    {step.resources?.length ? (
                      <ul>
                        {step.resources.map((resource, rIndex) => (
                          <li key={`${roadmap._id}-resource-${rIndex}`}>
                            <strong>{resource.title}</strong>
                            {resource.description && <span className="muted"> — {resource.description}</span>}
                            <div>
                              <a href={resource.url} target="_blank" rel="noreferrer">Open resource</a>
                            </div>
                          </li>
                        ))}
                      </ul>
                    ) : <p className="muted">No resources for this step yet.</p>}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </>
  );
}
