import { assertEquals, assertStringIncludes } from 'jsr:@std/assert';
import { sendErrorAlert } from './errorAlert.ts';

type FetchCall = { url: string; init: RequestInit };

function mockFetch(status = 200): { calls: FetchCall[]; restore: () => void } {
  const calls: FetchCall[] = [];
  const original = globalThis.fetch;
  globalThis.fetch = (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return Promise.resolve(new Response('{}', { status }));
  };
  return { calls, restore: () => { globalThis.fetch = original; } };
}

function withEnv(vars: Record<string, string>, fn: () => Promise<void>): Promise<void> {
  for (const [k, v] of Object.entries(vars)) Deno.env.set(k, v);
  return fn().finally(() => {
    for (const k of Object.keys(vars)) Deno.env.delete(k);
  });
}

const ENV = {
  RESEND_API_KEY: 'test-key',
  NEWS_ALERT_EMAIL_FROM: 'alerts@example.com',
  NEWS_ALERT_EMAIL_TO: 'dev@example.com',
};

Deno.test('sendErrorAlert: POSTs to Resend with correct subject and body', async () => {
  const { calls, restore } = mockFetch();
  await withEnv(ENV, () => sendErrorAlert('my-function: test error', new Error('something broke')));
  restore();

  assertEquals(calls.length, 1);
  assertEquals(calls[0].url, 'https://api.resend.com/emails');

  const payload = JSON.parse(calls[0].init.body as string);
  assertEquals(payload.subject, '[Goodgame] Error: my-function: test error');
  assertStringIncludes(payload.text, 'something broke');
  assertStringIncludes(payload.text, 'my-function: test error');
  assertEquals(payload.from, 'alerts@example.com');
  assertEquals(payload.to, ['dev@example.com']);
});

Deno.test('sendErrorAlert: includes extra details in body', async () => {
  const { calls, restore } = mockFetch();
  await withEnv(ENV, () =>
    sendErrorAlert('ctx', 'raw error string', { gameId: 'abc-123', statusCode: 503 })
  );
  restore();

  const payload = JSON.parse(calls[0].init.body as string);
  assertStringIncludes(payload.text, 'gameId: abc-123');
  assertStringIncludes(payload.text, 'statusCode: 503');
});

Deno.test('sendErrorAlert: handles comma-separated TO addresses', async () => {
  const { calls, restore } = mockFetch();
  await withEnv(
    { ...ENV, NEWS_ALERT_EMAIL_TO: 'a@example.com, b@example.com' },
    () => sendErrorAlert('ctx', 'err')
  );
  restore();

  const payload = JSON.parse(calls[0].init.body as string);
  assertEquals(payload.to, ['a@example.com', 'b@example.com']);
});

Deno.test('sendErrorAlert: does not fetch when env vars missing', async () => {
  const { calls, restore } = mockFetch();
  await sendErrorAlert('ctx', 'err'); // no env vars set
  restore();

  assertEquals(calls.length, 0);
});

Deno.test('sendErrorAlert: does not throw when Resend returns error status', async () => {
  const { restore } = mockFetch(500);
  await withEnv(ENV, () => sendErrorAlert('ctx', 'err'));
  restore();
  // no assertion needed — test passes if no throw
});

Deno.test('sendErrorAlert: does not throw when fetch itself throws', async () => {
  const original = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error('network down'));
  await withEnv(ENV, () => sendErrorAlert('ctx', 'err'));
  globalThis.fetch = original;
});
