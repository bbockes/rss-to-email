import { Resend } from 'resend';

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

    const resend = new Resend(apiKey);

    // Fetch full email content so we can forward html/text and set reply-to
    const { data: email, error: fetchError } = await resend.emails.receiving.get(emailId);
    if (fetchError) {
      console.error('Error fetching received email:', fetchError);
      return new Response(JSON.stringify(fetchError), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    // Send to inbox with reply-to set to the original sender,
    // so hitting reply goes directly back to them
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject: email.subject || '(no subject)',
      html: email.html || undefined,
      text: email.text || undefined,
      replyTo: email.from,
    });

    if (error) {
      console.error('Resend send error:', error);
      return new Response(JSON.stringify(error), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify(data), {
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
