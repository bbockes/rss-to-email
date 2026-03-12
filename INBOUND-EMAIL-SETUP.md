# Inbound Email Setup (brendan@brendanbockes.com)

This doc explains how receiving and forwarding works for **brendan@brendanbockes.com** so you can reference it later (e.g. when asking an AI or a colleague).

## What’s going on

- **Resend** has “Enable Receiving” on for **brendanbockes.com**. Inbound mail is received by Resend (MX points to AWS).
- Resend does **not** provide an IMAP inbox for that address. There’s no mailbox to add in Spark or another client.
- This project **forwards** every received email to your Gmail via a webhook + Vercel serverless function. You read (and reply) from Gmail (or Spark with that Gmail account).

## Flow when someone emails you

1. Someone sends to **brendan@brendanbockes.com**.
2. Resend receives it (inbound).
3. Resend sends a webhook POST to your Vercel endpoint with an `email.received` event (includes `email_id`, not the full body).
4. The Vercel function (`api/inbound-email.js`) calls Resend’s “forward received email” API with that `email_id` and your `FORWARD_INBOUND_TO` address.
5. Resend sends a new email **to your Gmail** with the original content and attachments.
6. You see it in Gmail (or Spark, if Spark is logged into that Gmail).

## What you need configured

### 1. Resend (dashboard)

- **Domains** → brendanbockes.com → **Enable Receiving** = ON (MX record verified).
- **Webhooks** → Add webhook:
  - **Endpoint URL:** `https://<your-vercel-app>.vercel.app/api/inbound-email`  
    (Get the exact URL from Vercel: Project → Domains or the “Visit” link after deploy, then add `/api/inbound-email`.)
  - **Events:** `email.received`
  - Save.

### 2. Vercel (project)

- This repo is deployed as a Vercel project (so the `api/inbound-email.js` route is live).
- **Settings → Environment Variables** for that project:
  - **RESEND_API_KEY** – Your Resend API key (same one used for the RSS cron).
  - **FORWARD_INBOUND_TO** – Your Gmail address (e.g. `you@gmail.com`).
  - **INBOUND_FROM_EMAIL** (optional) – e.g. `Brendan <brendan@brendanbockes.com>` for the “From” when forwarding. Defaults to that if unset.

Redeploy after changing env vars so the function sees them.

### 3. Finding your webhook URL in Vercel

- Vercel dashboard → your project.
- Domain is shown under **Domains** or on the project overview (e.g. `rss-to-email.vercel.app`).
- Full endpoint: **`https://<that-domain>/api/inbound-email`**.

## Replying so the reply comes from brendan@brendanbockes.com

By default, replying in Gmail sends from your Gmail address. To have replies come **from brendan@brendanbockes.com**:

1. Gmail → **Settings** (gear) → **See all settings** → **Accounts and Import**.
2. **Send mail as** → **Add another email address**.
3. Email: **brendan@brendanbockes.com**, name as you like.
4. Choose **Send through smtp.resend.com**:
   - **SMTP server:** `smtp.resend.com`
   - **Port:** `587` (TLS)
   - **Username:** `resend`
   - **Password:** your **Resend API key**
5. Complete verification.

When you reply, pick **“From: brendan@brendanbockes.com”** and the message is sent via Resend; the recipient sees it from brendan@brendanbockes.com.

## Files in this repo

- **api/inbound-email.js** – Vercel serverless POST handler: receives Resend’s `email.received` webhook and calls Resend’s forward API to send the email to `FORWARD_INBOUND_TO`.
- **README.md** – Has a “Forwarding inbound email to Gmail” section with a shorter version of this setup.

## Quick reference

| Thing | Where / value |
|-------|----------------|
| Inbound received by | Resend (MX → AWS); no IMAP inbox |
| Forward target | Gmail (or any address in `FORWARD_INBOUND_TO`) |
| Webhook handler | `api/inbound-email.js` (Vercel) |
| Webhook URL | `https://<vercel-project-domain>/api/inbound-email` |
| Resend webhook event | `email.received` |
| Send replies as brendan@… | Gmail “Send mail as” + Resend SMTP (`smtp.resend.com`, port 587, user `resend`, password = API key) |

---

When you have a question about this setup, you can point to this file: **INBOUND-EMAIL-SETUP.md**.
