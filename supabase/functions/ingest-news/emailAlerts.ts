import type { NewsSource } from './types.ts';

const RESEND_API_URL = 'https://api.resend.com/emails';

interface FeedAlertDetails {
  source: NewsSource;
  reason: 'rate_limited' | 'paused_after_failures';
  statusCode?: number;
  error?: string;
  consecutiveFailures: number;
  nextFetchAt: string;
  occurredAt: string;
}

function getRequiredEnv(name: string): string | null {
  const value = Deno.env.get(name);
  if (!value) {
    console.error(`News alert email not sent: missing ${name}`);
    return null;
  }

  return value;
}

function formatSubject(details: FeedAlertDetails): string {
  if (details.reason === 'rate_limited') {
    return `[Goodgame] News feed rate limited: ${details.source.name}`;
  }

  return `[Goodgame] News feed paused: ${details.source.name}`;
}

function formatBody(details: FeedAlertDetails): string {
  const status = details.statusCode != null ? String(details.statusCode) : 'unknown';
  const error = details.error ?? 'none';

  return [
    'A Goodgame news source triggered an adaptive backoff alert.',
    '',
    `Reason: ${details.reason}`,
    `Source: ${details.source.name} (${details.source.id})`,
    `Feed URL: ${details.source.feed_url}`,
    `Homepage URL: ${details.source.homepage_url ?? 'none'}`,
    `Status code: ${status}`,
    `Error: ${error}`,
    `Consecutive failures: ${details.consecutiveFailures}`,
    `Occurred at: ${details.occurredAt}`,
    `Next fetch at: ${details.nextFetchAt}`,
  ].join('\n');
}

export async function sendFeedAlertEmail(details: FeedAlertDetails): Promise<void> {
  const apiKey = getRequiredEnv('RESEND_API_KEY');
  const from = getRequiredEnv('NEWS_ALERT_EMAIL_FROM');
  const to = getRequiredEnv('NEWS_ALERT_EMAIL_TO');

  if (!apiKey || !from || !to) return;

  try {
    const response = await fetch(RESEND_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: to.split(',').map((address) => address.trim()).filter(Boolean),
        subject: formatSubject(details),
        text: formatBody(details),
      }),
    });

    if (!response.ok) {
      const responseText = await response.text();
      console.error(
        `News alert email failed: ${response.status} ${response.statusText} ${responseText}`
      );
    }
  } catch (err) {
    console.error('News alert email failed:', err);
  }
}
