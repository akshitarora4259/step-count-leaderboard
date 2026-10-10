export const metadata = { title: "FAQ — GIVE Step Challenge" };

const FAQS = [
  {
    q: "Do I need a Fitbit to take part?",
    a: "A Fitbit makes syncing automatic, but there's no hard requirement — ask the organizers about manual options if you don't have one.",
  },
  {
    q: "Is my step data shared outside this event?",
    a: "No. Your name and step counts are only used for this event's leaderboard, and you can disconnect at any time to remove your synced data.",
  },
  {
    q: "What counts toward the leaderboard?",
    a: "Total steps synced from Monday through Sunday of the current challenge week, summed across all your connected days.",
  },
  {
    q: "Can I disconnect and rejoin later?",
    a: "Yes — disconnecting removes your synced data, and reconnecting with the same name picks up tracking again going forward.",
  },
];

export default function FaqPage() {
  return (
    <main className="content-section page-container">
      <h1>Frequently Asked Questions</h1>
      <div className="steps-grid" style={{ marginTop: 24, gridTemplateColumns: "1fr" }}>
        {FAQS.map((item) => (
          <article className="step-card faq-item" key={item.q}>
            <h3>{item.q}</h3>
            <p>{item.a}</p>
          </article>
        ))}
      </div>
    </main>
  );
}
