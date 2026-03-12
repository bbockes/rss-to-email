// Resend inbound webhook: forwards received emails to your Gmail (or any address).
// Deploy to Vercel and set FORWARD_INBOUND_TO + RESEND_API_KEY in project env.

export async function POST(request) {
  try {
    const event = await request.json();

    if (event?.type !== 'email.received') {
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const to = process.env.FORWARD_INBOUND_TO;
    const from = process.env.INBOUND_FROM_EMAIL || 'Brendan <brendan@brendanbockes.com>';
    const apiKey = process.env.RESEND_API_KEY;

    if (!to) {
      console.error('FORWARD_INBOUND_TO is not set');
      return new Response('Forward address not configured', { status: 500 });
    }
    if (!apiKey) {
      console.error('RESEND_API_KEY is not set');
      return new Response('Resend API key not configured', { status: 500 });
    }

    const emailId = event.data?.email_id;
    if (!emailId) {
      return new Response(JSON.stringify({ error: 'Missing email_id' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const res = await fetch(`https://api.resend.com/emails/receiving/${emailId}/forward`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ to, from }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('Resend forward error:', res.status, body);
      return new Response(JSON.stringify(body), {
        status: res.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('Webhook error:', err);
    return new Response(JSON.stringify({ error: String(err.message) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
