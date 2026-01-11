# RSS to Email Newsletter

Automatically send your latest blog posts to your email subscribers every morning.

## What This Does

This project monitors your blog's RSS feed and automatically emails your newest post to all your subscribers. It runs every morning at 8:00 AM EST, checks if you've published anything new, and sends it out if you have.

## How It Works (Simple Explanation)

Think of this as a friendly robot that:

1. **Wakes up every morning at 8 AM** (via Render's scheduled job)
2. **Checks your blog** for new posts (reads your RSS feed)
3. **Remembers what it already sent** (using a Supabase database)
4. **Sends new posts to subscribers** (via Resend broadcast)
5. **Goes back to sleep** until tomorrow

### Visual Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     Every Day at 8:00 AM EST                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Render Cron Job │
                    │  runs index.js   │
                    └──────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  1. Fetch RSS Feed                      │
        │     https://blog.brendanbockes.com/     │
        │     feed.xml                            │
        └─────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │  2. Check Supabase Database             │
        │     "Have I sent this post before?"     │
        └─────────────────────────────────────────┘
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
        ┌───────────────┐         ┌──────────────────┐
        │  Already Sent │         │  New Post Found! │
        │  Skip It      │         └──────────────────┘
        └───────────────┘                   │
                                            ▼
                              ┌──────────────────────────┐
                              │  3. Send via Resend      │
                              │     Broadcast to all     │
                              │     subscribers          │
                              └──────────────────────────┘
                                            │
                                            ▼
                              ┌──────────────────────────┐
                              │  4. Save to Database     │
                              │     Mark as sent         │
                              └──────────────────────────┘
                                            │
                                            ▼
                                    ┌──────────────┐
                                    │  All Done!   │
                                    │  ✓ Sent      │
                                    └──────────────┘
```

## Tech Stack

### Services Used

- **[Render](https://render.com)** - Runs the scheduled job every morning (Cron Job)
- **[Resend](https://resend.com)** - Email service that sends broadcasts to your audience
- **[Supabase](https://supabase.com)** - PostgreSQL database that remembers which posts have been sent

### Code & Dependencies

- **Node.js** - JavaScript runtime
- **rss-parser** - Reads your blog's RSS feed
- **@supabase/supabase-js** - Connects to the database
- **resend** - Sends email broadcasts
- **dotenv** - Loads environment variables

## Files in This Project

```
rss-to-email/
├── index.js                  # Main script (all the logic)
├── email-template.html       # HTML template for the email
├── package.json              # Node.js dependencies
├── .env                      # Environment variables (not in git)
├── setup-database.sql        # SQL to create the database table
└── README.md                 # This file
```

### `index.js`

The main script that:
- Fetches your RSS feed
- Checks Supabase for previously sent posts
- Sends new posts via Resend broadcasts
- Records sent posts in the database

### `email-template.html`

A beautiful, responsive email template that displays your blog post with:
- Your blog logo
- Full post content
- A link to view online
- Unsubscribe link

## How the Scheduling Works

### Cron Schedule

The job runs at **8:00 AM EST** every day using this cron expression:

```
0 13 * * *
```

This means:
- `0` = Minute 0 (top of the hour)
- `13` = Hour 13 (1 PM UTC = 8 AM EST)
- `* * *` = Every day, every month, every day of the week

**Note:** Render uses UTC time, so 8 AM EST = 1 PM UTC (or 10 AM UTC during daylight saving time)

### Typical Publishing Flow

**Your workflow:**
1. Write a blog post (anytime)
2. Schedule it to publish at **3:00 AM EST**
3. Go to sleep 😴

**What happens automatically:**
1. **3:00 AM** - Your blog post goes live
2. **8:00 AM** - This script runs, detects the new post, and sends it to subscribers
3. **8:00:30 AM** - Subscribers receive your post in their inbox ✉️

## Setup Instructions

### Prerequisites

1. A blog with an RSS feed
2. A Resend account with an audience set up
3. A Supabase account (free tier works great)
4. A Render account (free tier works great)

### Environment Variables

You need these environment variables set in Render:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxxx        # From Resend > API Keys
RESEND_AUDIENCE_ID=xxxxxxxx-xxxx-xxxx  # From Resend > Audiences
SUPABASE_URL=https://xxx.supabase.co   # From Supabase > Settings > API
SUPABASE_KEY=xxxxxxxxxxxxx             # From Supabase > Settings > API (anon/public key)
```

### Database Setup

Run this SQL in your Supabase SQL Editor:

```sql
CREATE TABLE sent_posts (
  id BIGSERIAL PRIMARY KEY,
  post_url TEXT UNIQUE NOT NULL,
  post_title TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_sent_posts_url ON sent_posts(post_url);
CREATE INDEX idx_sent_posts_sent_at ON sent_posts(sent_at DESC);
```

### Render Configuration

**Service Type:** Cron Job

**Build Command:** `npm install`

**Start Command:** `npm start`

**Schedule:** `0 13 * * *` (8:00 AM EST)

## Testing

### Test Locally

```bash
npm test
```

This will:
- Check your RSS feed
- Show if the most recent post has been sent
- Send it if it's new

### Test on Render

1. Go to your Render dashboard
2. Navigate to your Cron Job
3. Click "Trigger Job" to run it manually
4. Check the logs to see the output

## Troubleshooting

### "No posts found in feed"
- Check that your RSS feed URL is correct
- Make sure your blog has at least one published post

### "API key is invalid"
- Verify your `RESEND_API_KEY` in environment variables
- Make sure the API key has "Broadcasts" permission enabled

### "This post has already been sent"
- This is normal! It means the post is already in the database
- To resend, delete the entry from the Supabase `sent_posts` table

### Email sends multiple times
- This shouldn't happen with Supabase (persistent storage)
- Check that your environment variables are set correctly in Render

## Cost

**Free tier is sufficient for everything:**

- ✅ **Render Cron Job** - Free (750 hours/month)
- ✅ **Supabase** - Free (500 MB database, plenty for thousands of posts)
- ✅ **Resend** - Free tier: 3,000 emails/month, 100 emails/day

Unless you have thousands of subscribers and post multiple times daily, you'll stay well within free limits.

## License

MIT

---

**Built with ❤️ for [Brendan's Blog](https://blog.brendanbockes.com)**
