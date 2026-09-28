import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePoll } from '../../hooks.js';
import { Alert, Timer } from '../../components.jsx';
import { api } from '../../api.js';
import heroBg from '../../assets/technova-hero-bg.svg';

// Dashboard hero background: try loading the themed image first. If it
// fails (missing file, slow/broken network, etc.) we simply never apply the
// inline background-image, so the existing navy/indigo CSS gradient on
// `.hero` keeps showing through as the fallback — no extra markup needed.
function useHeroBackground(src) {
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.onload = () => { if (!cancelled) setOk(true); };
    img.onerror = () => { if (!cancelled) setOk(false); };
    img.src = src;
    return () => { cancelled = true; };
  }, [src]);
  return ok;
}

const PROFILE_TYPES = [
  { key: 'linkedinUrl', label: 'LinkedIn', src: 'https://cdn.simpleicons.org/linkedin/0a66c2', alt: 'LinkedIn' },
  { key: 'githubUrl', label: 'GitHub', src: 'https://cdn.simpleicons.org/github/111827', alt: 'GitHub' },
  { key: 'leetcodeUrl', label: 'LeetCode', src: 'https://cdn.simpleicons.org/leetcode/ffa116', alt: 'LeetCode' },
  { key: 'kaggleUrl', label: 'Kaggle', src: 'https://cdn.simpleicons.org/kaggle/20beff', alt: 'Kaggle' },
];

function normalizeProfileUrl(value) {
  const raw = String(value ?? '').trim();
  return raw;
}

function ProfileIcon({ profile }) {
  if (profile.key === 'linkedinUrl') {
    return (
      <svg aria-label={profile.alt} role="img" viewBox="0 0 24 24" width="20" height="20" fill="#0a66c2">
        <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12ZM7.12 20.45H3.56V9h3.56v11.45ZM22.23 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.23 0Z" />
      </svg>
    );
  }
  return <img src={profile.src} alt={profile.alt} style={{ width: '1.2rem', height: '1.2rem', objectFit: 'contain' }} />;
}

export default function StudentDashboard() {
  const me = usePoll('/student/me', 10000);
  const heroImgOk = useHeroBackground(heroBg);
  const [expandedMember, setExpandedMember] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');
  const profileEditorRef = useRef(null);
  const teamRank = me.data?.rank ?? '—';
  const teamCount = me.data?.teamCount ?? '—';

  const openMemberProfile = (member) => {
    const nextDraft = PROFILE_TYPES.reduce((draft, profile) => ({
      ...draft,
      [profile.key]: member[profile.key] || '',
    }), {});
    setExpandedMember(member._id);
    setDrafts((current) => ({ ...current, [member._id]: nextDraft }));
    setProfileError('');
  };

  const saveMemberProfile = async (member) => {
    setSavingProfile(true);
    setProfileError('');
    try {
      const payload = Object.fromEntries(PROFILE_TYPES.map((profile) => [
        profile.key,
        normalizeProfileUrl(drafts[member._id]?.[profile.key]),
      ]));
      await api(`/student/members/${member._id}/profile-links`, { method: 'POST', body: payload });
      setExpandedMember(null);
      await me.reload();
    } catch (e) {
      setProfileError(e.message);
      await me.reload();
    } finally {
      setSavingProfile(false);
    }
  };

  useEffect(() => {
    if (expandedMember) profileEditorRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [expandedMember]);

  return (
    <>
      <section
        className="hero"
        style={heroImgOk ? {
          backgroundImage: `linear-gradient(125deg, rgba(8,11,29,.86) 0%, rgba(19,15,58,.8) 45%, rgba(38,29,110,.72) 78%, rgba(61,58,168,.62) 130%), url(${heroBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : undefined}
      >
        <div>
          <p className="hero-label">Your team</p>
          <h2>{me.data ? me.data.name : '…'}</h2>
          <div className="chips">
            <span className="chip">Team ID: {me.data?.teamId || '—'}</span>
            <span className="chip">Candidates: {me.data?.members?.length ?? '—'}</span>
          </div>
        </div>
        <div className="hero-stats">
          <div className="hero-box rank-box" aria-label={`Nova rank ${teamRank} of ${teamCount} teams`}>
            <span className="hero-label">Nova rank</span>
            <div className="rank-value-row">
              <span className="hero-rank">#{teamRank}</span>
              <span className="rank-total">of {teamCount} teams</span>
            </div>
          </div>
          <div className="hero-box">
            <span className="hero-label">Total Team XP</span>
            <span className="hero-xp">{me.data ? me.data.xp : '–'}</span>
          </div>
          <div className="hero-box">
            <span className="hero-label">Time left</span>
            <Timer />
          </div>
        </div>
      </section>
      <Alert>{me.error}</Alert>
      <Alert>{profileError}</Alert>

      <div className="card">
        <h3>Team candidates</h3>
        {me.data?.members?.length ? (
          <div className="member-list">
            {me.data.members.map((member) => {
              const roleClass = {
                'VISION LEAD': 'role-vision-lead',
                'CODE ARCHITECT': 'role-code-architect',
                'INNOVATION STRATEGIST': 'role-innovation-strategist',
              }[member.role] || '';
              return <div key={member._id} className={`member-card identity-card ${roleClass}`}>
                <div className="member-card-header">
                  <div>
                    <span className="identity-role">{member.role}</span>
                    <strong>{member.fullName}</strong>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.9rem' }}>
                  {PROFILE_TYPES.map((profile) => {
                    const href = member[profile.key];
                    const sharedStyle = {
                      width: '2.6rem',
                      height: '2.6rem',
                      borderRadius: '999px',
                      border: '1px solid rgba(255,255,255,0.14)',
                      background: href ? 'rgba(109,139,255,0.16)' : 'rgba(255,255,255,0.04)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textDecoration: 'none',
                      padding: 0,
                      cursor: 'pointer',
                      overflow: 'hidden',
                    };

                    const image = <ProfileIcon profile={profile} />;
                    return href ? (
                      <a key={profile.key} href={href} target="_blank" rel="noreferrer" style={sharedStyle} title={`Open ${profile.label}`}>
                        {image}
                      </a>
                    ) : (
                      <button key={profile.key} type="button" style={sharedStyle} title={`Add ${profile.label}`} onClick={(event) => { event.preventDefault(); event.stopPropagation(); openMemberProfile(member); }}>
                        {image}
                      </button>
                    );
                  })}
                </div>

                {expandedMember === member._id && (
                  <div className="candidate-profile-editor" ref={profileEditorRef} tabIndex={-1}>
                    {PROFILE_TYPES.map((profile) => (
                      <label key={profile.key}>
                        {profile.label}
                        <input
                          type="text"
                          value={drafts[member._id]?.[profile.key] || ''}
                          onChange={(event) => setDrafts((current) => ({
                            ...current,
                            [member._id]: { ...current[member._id], [profile.key]: event.target.value },
                          }))}
                          placeholder="https://"
                        />
                      </label>
                    ))}
                    <div className="row">
                      <button type="button" className="btn small secondary" onClick={() => setExpandedMember(null)}>Close</button>
                      <button type="button" className="btn small" disabled={savingProfile} onClick={() => saveMemberProfile(member)}>
                        {savingProfile ? 'Saving…' : 'Save links'}
                      </button>
                    </div>
                  </div>
                )}

                {member.linkedinUrl || member.githubUrl || member.leetcodeUrl || member.kaggleUrl ? (
                  <button type="button" className="btn small secondary" style={{ marginTop: '0.9rem' }} onClick={(event) => { event.preventDefault(); event.stopPropagation(); openMemberProfile(member); }}>
                    Edit profile links
                  </button>
                ) : (
                  <button type="button" className="btn small" style={{ marginTop: '0.9rem' }} onClick={(event) => { event.preventDefault(); event.stopPropagation(); openMemberProfile(member); }}>
                    Add profile links
                  </button>
                )}
              </div>;
            })}
          </div>
        ) : <p className="muted">No members assigned to this team yet.</p>}
      </div>

    </>
  );
}
