import { fileUrl } from '../../api.js';
import { Alert } from '../../components.jsx';
import { usePoll } from '../../hooks.js';

function PeopleSection({ title, people, tone }) {
  const visiblePeople = (people || []).filter((person) => person.name?.trim());
  return (
    <section className={`about-group ${tone}`}>
      <h3>{title}</h3>
      {visiblePeople.length ? (
        <div className="about-person-grid">
          {visiblePeople.map((person, index) => (
            <article
              className="about-person"
              key={`${title}-${person.name}-${index}`}
              style={{ '--about-index': index }}
            >
              <div className="about-person-identity">
                {person.imageUrl && <img className="about-person-image" src={fileUrl(person.imageUrl)} alt={`${person.name} portrait`} />}
              </div>
              <div className="about-person-details">
                <h4>{person.name}</h4>
                {person.bio && <p className="about-person-bio">{person.bio}</p>}
              </div>
            </article>
          ))}
        </div>
      ) : <p className="muted">Leadership profiles will be added soon.</p>}
    </section>
  );
}

export default function AboutPage() {
  const { data, error } = usePoll('/about', 10000);

  return (
    <div className="about-page">
      <Alert>{error}</Alert>
      {!data ? <p className="muted">Loading About page…</p> : (
        <>
          <section className={`about-hero${data.imageUrl ? '' : ' about-hero-text-only'}`}>
            <div className="about-copy">
              <p className="eyebrow res-tag">TechNova</p>
              <h2>{data.title || 'About TechNova'}</h2>
              {data.introduction && <p>{data.introduction}</p>}
            </div>
            {data.imageUrl && <img className="about-cover-image" src={fileUrl(data.imageUrl)} alt="TechNova" />}
          </section>
          <PeopleSection title="TechNova leads" people={data.leads} tone="about-leads" />
          <PeopleSection title="TechNova co-leads" people={data.coLeads} tone="about-co-leads" />
        </>
      )}
    </div>
  );
}
