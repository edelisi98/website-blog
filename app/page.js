export default function Page() {
  return (
    <main style={{ fontFamily: "sans-serif", padding: "2rem" }}>
      <h1>Elire Resource API</h1>
      <p>This private synchronization helper is running.</p>
      <p>
        Health: <code>/resource-api-v2/api/health</code>
      </p>
      <p>
        Public resource index: <code>/resource-api-v2/api/resources</code>
      </p>
    </main>
  );
}
