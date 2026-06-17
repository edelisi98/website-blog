export async function GET() {
  return Response.json({
    ok: true,
    message: "Elire resource API is running.",
    generated: new Date().toISOString(),
    hasWebflowToken: Boolean(process.env.WEBFLOW_API_TOKEN),
  });
}
