export function serializeAbout(content) {
  if (!content) {
    return { title: 'About TechNova', introduction: '', imageUrl: '', imageFileName: '', leads: [], coLeads: [] };
  }

  const { key, storedName, leads = [], coLeads = [], ...visible } = content;
  const serializePerson = ({ imageStoredName, ...person }) => person;
  return {
    ...visible,
    leads: leads.map(serializePerson),
    coLeads: coLeads.map(serializePerson),
  };
}