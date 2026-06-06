const RESEND_API_URL = 'https://api.resend.com/emails';

function getEnv(name: string): string | null {
  const value = Deno.env.get(name);
  if (!value) {
    console.error(`Error alert not sent: missing ${name}`);
    return null;
  }
  return value;
}

export async function sendErrorAlert(
  context: string,
  error: unknown,
  details?: Record<string, unknown>
): Promise<void> {
  const apiKey = getEnv('RESEND_API_KEY');
  const from = getEnv('NEWS_ALERT_EMAIL_FROM');
  const to = getEnv('NEWS_ALERT_EMAIL_TO');

  if (!apiKey || !from || !to) return;

  const message = error instanceof Error ? error.message : String(error);
  const detailLines = details
    ? Object.entries(details).map(([k, v]) => `${k}: ${v}`)
    : [];

  const body = [
    `Context: ${context}`,
    `Error: ${message}`,
    ...detailLines,
    `Occurred at: ${new Date().toISOString()}`,
  ].join('\n');

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: to.split(',').map((a) => a.trim()).filter(Boolean),
        subject: `[Goodgame] Error: ${context}`,
        text: body,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error(`Error alert email failed: ${response.status} ${text}`);
    }
  } catch (err) {
    console.error('Error alert email failed:', err);
  }
}
