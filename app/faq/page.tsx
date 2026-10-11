export const metadata = { title: "FAQ — GIVE Step Challenge" };

const FAQS = [
  {
    q: "Do I need to enter steps manually?",
    a: "You don't type a number. Just screenshot your phone's step counter each day and upload it — we read the step count from the image automatically (OCR).",
  },
  {
    q: "What if the step count isn't detected correctly?",
    a: "You'll see a clear error and can retry right away with a clearer screenshot. Nothing is saved unless a valid step count is detected.",
  },
  {
    q: "Can I upload more than once a day?",
    a: "Yes — re-uploading on the same day replaces that day's entry rather than adding a duplicate.",
  },
  {
    q: "Is there a team leaderboard?",
    a: "No. The campaign uses one overall leaderboard without team, department or location segmentation.",
  },
  {
    q: "What counts toward the leaderboard?",
    a: "Total steps from screenshots uploaded Monday through Sunday of the current challenge week, summed across all your days.",
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
