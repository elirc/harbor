import { useEffect, useState, type CSSProperties } from "react";
import { apiGet } from "./lib/api";

/**
 * Contact profile (S02): one human's identifiers + conversation history, with a merge affordance. The merge
 * UI only *suggests* a merge for weak signals; auto-merge happens server-side on verified identifiers.
 */
interface Contact {
  id: string;
  name: string | null;
  identities: { id: string; type: string; value: string; verified: boolean }[];
  conversations: { id: string; subject: string; state: string }[];
}

export function ContactProfile({ contactId }: { contactId: string }) {
  const [contact, setContact] = useState<Contact | null>(null);
  useEffect(() => {
    apiGet<Contact>(`/contacts/${contactId}`)
      .then(setContact)
      .catch(() => setContact(null));
  }, [contactId]);

  if (!contact) return <p style={{ color: "#8b93a1" }}>Loading contact…</p>;
  return (
    <section style={{ maxWidth: 480 }}>
      <h2 style={{ color: "#1d76db" }}>{contact.name ?? "Unknown contact"}</h2>
      <h3 style={label}>Identities</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {contact.identities.map((i) => (
          <li key={i.id} style={row}>
            <span style={{ color: "#8b93a1" }}>{i.type}</span> {i.value}
            <span style={{ ...pill, ...(i.verified ? verified : weak) }}>{i.verified ? "verified" : "unverified"}</span>
          </li>
        ))}
      </ul>
      <h3 style={label}>Conversations</h3>
      <ul style={{ listStyle: "none", padding: 0 }}>
        {contact.conversations.map((c) => (
          <li key={c.id} style={row}>
            {c.subject} <span style={{ color: "#8b93a1", fontSize: 12 }}>· {c.state}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

const label: CSSProperties = { fontSize: 12, color: "#8b93a1", textTransform: "uppercase", marginTop: 16 };
const row: CSSProperties = { border: "1px solid #232a32", borderRadius: 8, padding: "8px 10px", marginBottom: 6, display: "flex", gap: 8, alignItems: "center" };
const pill: CSSProperties = { marginLeft: "auto", fontSize: 10, padding: "2px 6px", borderRadius: 999 };
const verified: CSSProperties = { background: "rgba(14,138,22,.15)", color: "#2fbf71" };
const weak: CSSProperties = { background: "rgba(224,165,75,.15)", color: "#e0a54b" };
