export const metadata = { title: "About — GIVE Step Challenge" };

export default function AboutPage() {
  return (
    <main className="content-section page-container">
      <h1>About the Give Step Challenge</h1>
      <p className="hero-description" style={{ margin: "16px 0 0", maxWidth: 720 }}>
        The GIVE Step Challenge is a one-week, internal Microsoft event that turns everyday
        movement into a shared act of giving. Connect your Fitbit, walk for your health, and watch
        your steps climb the leaderboard alongside your colleagues — all in support of a healthier,
        kinder community. There&apos;s no login required beyond your name, and you can disconnect
        at any time.
      </p>
    </main>
  );
}
