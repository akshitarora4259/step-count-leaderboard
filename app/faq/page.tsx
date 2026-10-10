export const metadata = { title: "FAQ — GIVE Step Challenge" };

const FAQS = [
  {
    q: "Do I need to enter steps manually?",
    a: "No. Connect Fitbit once and the experience is designed to sync step totals automatically.",
  },
  {
    q: "Can I disconnect?",
    a: "Yes. Use the Disconnect control on the connected (/me) page to opt out at any time.",
  },
  {
    q: "Is there a team leaderboard?",
    a: "No. The campaign uses one overall leaderboard without team, department or location segmentation.",
  },
  {
    q: "What counts toward the leaderboard?",
    a: "Total steps synced from Monday through Sunday of the current challenge week, summed across all your connected days.",
  },
];

export default function FaqPage() {
  return (
    <section id="faq" className="view active-view simple-page">
      <h1>Frequently asked questions</h1>
      {FAQS.map((item, i) => (
        <details key={item.q} open={i === 0}>
          <summary>{item.q}</summary>
          <p>{item.a}</p>
        </details>
      ))}
    </section>
  );
}
