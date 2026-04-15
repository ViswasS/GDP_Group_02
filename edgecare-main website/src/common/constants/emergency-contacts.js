const US_EMERGENCY_CONTACTS = Object.freeze([
  {
    label: "Emergency",
    number: "911",
    description: "Police, fire, or ambulance emergencies",
  },
  {
    label: "Crisis Support",
    number: "988",
    description: "Suicide and Crisis Lifeline",
  },
  {
    label: "Poison Help",
    number: "1-800-222-1222",
    description: "Poison Control",
  },
]);

function withTelHref(contacts = US_EMERGENCY_CONTACTS) {
  return contacts.map((contact) => ({
    ...contact,
    href: `tel:${String(contact.number || "").replace(/\s+/g, "")}`,
  }));
}

module.exports = {
  US_EMERGENCY_CONTACTS,
  withTelHref,
};
