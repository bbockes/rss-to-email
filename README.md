# RSS to Email Newsletter

Automatically send your latest blog posts to your email subscribers every morning.

## What This Does

This project monitors your blog's RSS feed and automatically emails your newest post to all your subscribers. It runs every morning at 5:00 AM EST, checks if you've published anything new, and sends it out if you have. A separate 4 AM cron job ensures your blog rebuilds daily to catch any scheduled posts.

## How It Works (Simple Explanation)

Think of this as a friendly robot that:

1. **You schedule posts in Sanity** - Write and schedule your blog post for 3:00 AM EST
2. **Post publishes at 3 AM** - Sanity automatically publishes it
3. **Netlify rebuild at 4 AM** - Scheduled cron job triggers Netlify to rebuild your blog
4. **RSS feed updates** - Your blog's RSS feed gets the new post
5. **Robot wakes up at 5 AM** - Render's email cron job runs
6. **Checks your blog** for new posts (reads your RSS feed)
7. **Remembers what it already sent** (using a Supabase database)
8. **Sends new posts to subscribers** (via Resend broadcast)
9. **Goes back to sleep** until tomorrow

**Note:** Scheduled publishes in Sanity don't trigger webhooks automatically, so we use a daily 4 AM cron job to ensure Netlify rebuilds your site before the 5 AM email send.

### Visual Flow

```
┌─────────────────────────────────────────────────────────────┐
│         You Schedule a Post in Sanity for 3:00 AM          │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    3:00 AM - Post Publishes                 │
│              (Sanity scheduled publish runs)                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  4:00 AM - Netlify Rebuild                  │
│              (Render Cron Job triggers Netlify)             │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────────┐
                    │  Netlify Rebuilds    │
                    │  Your Blog (~2 min)  │
                    └──────────────────────┘
                              │
                              ▼
                    ┌──────────────────────┐
                    │  RSS Feed Updates    │
                    │  with New Post       │
                    └──────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                  5:00 AM - Email Send Job                   │
│              (Render Cron Job runs index.js)                │
└─────────────────────────────────────────────────────────────┘
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

- **[Sanity](https://sanity.io)** - Headless CMS for managing blog content
- **[Netlify](https://netlify.com)** - Hosts the blog frontend and handles automatic rebuilds
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

### Cron Schedules

There are **two** scheduled jobs that run every morning:

**1. Netlify Build Trigger - 4:00 AM EST**
```
0 9 * * *
```
This triggers Netlify to rebuild your blog, which updates the RSS feed with any scheduled posts.

**2. Email Send Job - 5:00 AM EST**
```
0 10 * * *
```
This checks the RSS feed for new posts and sends them to subscribers.

**Cron expression breakdown:**
- `0` = Minute 0 (top of the hour)
- `9` or `10` = Hour in UTC (9 AM UTC = 4 AM EST, 10 AM UTC = 5 AM EST)
- `* * *` = Every day, every month, every day of the week

**Note:** Render uses UTC time. Adjust for daylight saving time if needed (EST is UTC-5, EDT is UTC-4).

### Typical Publishing Flow

**Your workflow:**
1. Write a blog post in Sanity Studio (anytime)
2. Schedule it to publish at **3:00 AM EST** (this is now the default for new posts!)
3. Go to sleep 😴

**What happens automatically:**
1. **3:00 AM** - Your blog post publishes in Sanity (scheduled publish)
2. **4:00 AM** - Netlify rebuild cron job triggers a deploy
3. **4:02 AM** - Netlify finishes rebuilding, RSS feed updates with new post
4. **5:00 AM** - Email cron job runs, detects the new post, and sends it to subscribers
5. **5:00:30 AM** - Subscribers receive your post in their inbox ✉️

**Why the 4 AM rebuild?** Scheduled publishes in Sanity don't automatically trigger webhooks. The 4 AM cron job ensures your site rebuilds daily to catch any scheduled posts that published earlier that morning.

## Setup Instructions

### Prerequisites

1. A blog with Sanity (headless CMS) hosted on Netlify
2. An RSS feed at your blog (e.g., `/feed.xml`)
3. A Resend account with an audience set up
4. A Supabase account (free tier works great)
5. A Render account (free tier works great) - you'll create **two** cron jobs

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

### Sanity Webhook Setup (Optional but Recommended)

**What this does:** When you manually publish a post in Sanity, this webhook immediately triggers Netlify to rebuild your site and update the RSS feed.

**Important Note:** Scheduled publishes in Sanity don't trigger webhooks. That's why we use the 4 AM Netlify rebuild cron job - it catches any scheduled posts that published at 3 AM. However, setting up this webhook is still useful for when you manually publish posts outside of the scheduled time.

#### Step 1: Create a Deploy Hook in Netlify

1. Go to your Netlify dashboard at `https://app.netlify.com`
2. Click on your blog site
3. Go to **Site configuration** (or **Site settings**)
4. In the left sidebar, click **Build & deploy**
5. Scroll down to **Build hooks**
6. Click **Add build hook**
7. Fill in:
   - **Build hook name**: "Sanity Publish"
   - **Branch to build**: `main` (or whatever your production branch is)
8. Click **Save**
9. **Copy the webhook URL** - it looks like:
   ```
   https://api.netlify.com/build_hooks/[some-long-id]
   ```

#### Step 2: Add the Webhook to Sanity

1. Go to `https://sanity.io/manage`
2. Select your blog project
3. Click **API** in the left sidebar
4. Click **Webhooks**
5. Click **Create webhook**
6. Fill in:
   - **Name**: "Netlify Deploy on Publish"
   - **URL**: Paste your Netlify webhook URL from Step 1
   - **Dataset**: `production` (or your dataset name)
   - **Trigger on**: Check ✅ Create, ✅ Update, ✅ Delete
   - **Filter** (optional): `_type == "post"` (only trigger on blog posts)
   - **HTTP method**: POST
7. Click **Save**

#### Step 3: Test It

1. Go to Sanity Studio
2. Make a small edit to any blog post
3. Click **Publish**
4. Go to Netlify dashboard → **Deploys** tab
5. You should see a new deploy start within seconds!

✅ **Now your blog will automatically rebuild whenever you manually publish, ensuring the RSS feed is always up to date.**

### Sanity Schema Configuration (Default 3 AM Publish Time)

To make scheduling easier, you can configure your Sanity post schema to automatically default new posts to 3:00 AM EST.

In your Sanity Studio project (typically in `studio-[yourproject]/schemaTypes/postType.ts`), update the `publishedAt` field:

```typescript
defineField({
  name: 'publishedAt',
  title: 'Published at',
  type: 'datetime',
  initialValue: () => {
    const now = new Date();
    // Set to 3:00 AM in local timezone
    const threeAM = new Date(now);
    threeAM.setHours(3, 0, 0, 0);
    
    // If it's already past 3 AM today, default to 3 AM tomorrow
    if (now > threeAM) {
      threeAM.setDate(threeAM.getDate() + 1);
    }
    
    return threeAM.toISOString();
  },
  validation: (rule) => rule.required(),
}),
```

After making this change, deploy your Sanity Studio:

```bash
cd studio-[yourproject]
npm run build
npm run deploy
```

Now when you create a new post, it will automatically default to 3:00 AM (today if it's before 3 AM, or tomorrow if it's after 3 AM).

### Render Configuration

You need **two** Render Cron Jobs:

#### Job 1: Netlify Build Trigger (4:00 AM EST)

**Service Type:** Cron Job

**Name:** Netlify Build Trigger

**Build Command:** `npm install`

**Start Command:** `curl -X POST -d {} https://api.netlify.com/build_hooks/[your-webhook-id]`

**Schedule:** `0 9 * * *` (4:00 AM EST = 9:00 AM UTC)

**Purpose:** Triggers Netlify to rebuild your blog, which updates the RSS feed with any posts that were scheduled to publish earlier that morning.

#### Job 2: Email Send Job (5:00 AM EST)

**Service Type:** Cron Job

**Name:** RSS to Email

**Build Command:** `npm install`

**Start Command:** `npm start`

**Schedule:** `0 10 * * *` (5:00 AM EST = 10:00 AM UTC)

**Purpose:** Checks the RSS feed for new posts and sends them to subscribers via Resend.

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

## Resending Old Posts

### Important: One Post Per Day Rule

This system **only sends the most recent post** from your RSS feed each day. This means you can strategically reschedule old posts to resend them as emails.

### How to Resend an Old Post

1. **Remove from Supabase Database**
   - Go to Supabase Table Editor
   - Find the post in the `sent_posts` table
   - Delete that row

2. **Update the Publish Date**
   - In your blog CMS, change the post's publish date to a future date
   - The post will appear as the "most recent" in your RSS feed

3. **Wait for the Scheduled Run**
   - At 4:00 AM EST, Netlify rebuilds (updating RSS feed)
   - At 5:00 AM EST, the email cron job runs
   - It sees your rescheduled post as the most recent
   - Checks Supabase (entry deleted, so it's "new")
   - Sends it to your subscribers

### Smart Content Strategy

You can use this to:
- **Resurface evergreen content** - Send your best posts again to new subscribers
- **Drip old content** - Schedule one post per day over several weeks
- **Reach new audiences** - People who joined recently never saw your older posts
- **Correct mistakes** - Fix typos and resend with updated publish date

**Example Schedule:**
- Jan 12: Old post A (reschedule date to Jan 12, remove from DB)
- Jan 13: Old post B (reschedule date to Jan 13, remove from DB)
- Jan 14: Old post C (reschedule date to Jan 14, remove from DB)

Each day at 5 AM, the system sends whichever post is "most recent" by publish date.

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

### "This post has already been sent" but my new post didn't send
- This means your RSS feed isn't updating with new posts
- **Check the 4 AM Netlify rebuild cron**: Go to Render → Netlify Build Trigger cron job and verify it ran at 4 AM
- **Check Netlify deploys**: Go to Netlify → Deploys and see if a rebuild was triggered at 4 AM
- **Manual fix**: Manually trigger the Netlify Build Trigger cron job in Render, wait 2 minutes, then manually trigger the Email Send cron job

### Post published but not in RSS feed
- The 4 AM Netlify rebuild cron might not be working
- Check Render → Netlify Build Trigger job logs to see if it ran successfully
- Check Netlify → Deploys to see if a build was triggered at 4 AM
- Manually trigger the Netlify Build Trigger cron job to force a rebuild
- Verify the webhook URL in the cron job command is correct

### Scheduled post didn't trigger Netlify rebuild
- This is expected! Scheduled publishes in Sanity don't trigger webhooks
- The 4 AM cron job is designed to handle this by rebuilding daily
- Make sure your posts are scheduled for 3 AM (or earlier) so the 4 AM rebuild catches them

## Cost

**Free tier is sufficient for everything:**

- ✅ **Sanity** - Free tier: 3 users, unlimited documents
- ✅ **Netlify** - Free tier: 300 build minutes/month, 100 GB bandwidth
- ✅ **Render Cron Job** - Free (750 hours/month)
- ✅ **Supabase** - Free (500 MB database, plenty for thousands of posts)
- ✅ **Resend** - Free tier: 3,000 emails/month, 100 emails/day

Unless you have thousands of subscribers and post multiple times daily, you'll stay well within free limits.

## License

MIT

---

**Built with ❤️ for [Brendan's Blog](https://blog.brendanbockes.com)**
