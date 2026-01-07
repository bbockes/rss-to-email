# Sanity CMS Post Scheduling Workaround

This guide explains how to implement post scheduling in your Sanity CMS blog without paying for Sanity's scheduled publishing feature.

## How It Works

Instead of using Sanity's paid scheduling feature, you'll filter posts on the **frontend** (your blog) based on a `publishedAt` date field. Posts with a future `publishedAt` date won't appear until that date/time arrives.

## Step 1: Ensure Your Sanity Schema Has a `publishedAt` Field

In your Sanity schema file (usually `schemas/post.js` or similar), make sure you have a `publishedAt` datetime field:

```javascript
{
  name: 'publishedAt',
  title: 'Published at',
  type: 'datetime',
  description: 'When the post should be published. Posts with future dates won\'t appear until this date.',
  validation: Rule => Rule.required()
}
```

## Step 2: Filter Posts in Your GROQ Query

When querying posts from Sanity, filter out posts where `publishedAt` is in the future:

### Example GROQ Query (Recommended)

```groq
*[_type == "post" && publishedAt <= now()] | order(publishedAt desc)
```

This query:
- Only returns posts where `publishedAt` is less than or equal to the current time
- Orders them by `publishedAt` descending (newest first)

### More Complete Example

```groq
*[_type == "post" 
  && publishedAt <= now() 
  && defined(publishedAt)
] | order(publishedAt desc) {
  _id,
  title,
  slug,
  publishedAt,
  body,
  // ... other fields
}
```

## Step 3: Frontend Implementation Examples

### Next.js Example (using `@sanity/client`)

```javascript
import { createClient } from '@sanity/client';

const client = createClient({
  projectId: 'your-project-id',
  dataset: 'production',
  useCdn: true,
  apiVersion: '2024-01-01',
});

// Query posts - only get published ones
export async function getPosts() {
  const query = `*[_type == "post" && publishedAt <= now()] | order(publishedAt desc)`;
  return await client.fetch(query);
}

// Or if you need to filter client-side (less efficient)
export async function getAllPosts() {
  const query = `*[_type == "post"] | order(publishedAt desc)`;
  const allPosts = await client.fetch(query);
  
  // Filter out future-dated posts
  const now = new Date().toISOString();
  return allPosts.filter(post => 
    post.publishedAt && new Date(post.publishedAt) <= new Date(now)
  );
}
```

### React Component Example

```javascript
import { useEffect, useState } from 'react';
import { createClient } from '@sanity/client';

const client = createClient({
  projectId: 'your-project-id',
  dataset: 'production',
  useCdn: true,
});

function BlogPosts() {
  const [posts, setPosts] = useState([]);

  useEffect(() => {
    async function fetchPosts() {
      // Query only posts that should be visible now
      const query = `*[_type == "post" && publishedAt <= now()] | order(publishedAt desc)`;
      const data = await client.fetch(query);
      setPosts(data);
    }
    fetchPosts();
  }, []);

  return (
    <div>
      {posts.map(post => (
        <article key={post._id}>
          <h2>{post.title}</h2>
          <p>{new Date(post.publishedAt).toLocaleDateString()}</p>
          {/* ... rest of post content */}
        </article>
      ))}
    </div>
  );
}
```

### Static Site Generation (SSG) Example

If you're using Next.js with static generation, the filtering happens at build time:

```javascript
// pages/blog.js or app/blog/page.js
export async function getStaticProps() {
  const query = `*[_type == "post" && publishedAt <= now()] | order(publishedAt desc)`;
  const posts = await client.fetch(query);
  
  return {
    props: {
      posts,
    },
    // Revalidate every hour to pick up newly published posts
    revalidate: 3600,
  };
}
```

## Step 4: RSS Feed Considerations

If your RSS feed is generated from Sanity, make sure it also filters out future-dated posts:

```javascript
// RSS feed generation
const query = `*[_type == "post" && publishedAt <= now()] | order(publishedAt desc) [0...10]`;
const posts = await client.fetch(query);

// Generate RSS XML with only published posts
```

## Important Notes

1. **Time Zone**: Make sure your `publishedAt` field stores dates in UTC or a consistent timezone. The `now()` function in GROQ uses UTC.

2. **Caching**: If you're using CDN caching (like Sanity's CDN), future-dated posts might appear briefly until the cache refreshes. Consider:
   - Using `useCdn: false` for queries that need real-time accuracy
   - Setting appropriate cache headers
   - Using ISR (Incremental Static Regeneration) with appropriate revalidation times

3. **Preview Mode**: If you want to preview future-dated posts while logged in, you can add a conditional:

```groq
*[_type == "post" && (
  publishedAt <= now() || 
  // Allow preview of future posts if user is authenticated
  $preview == true
)] | order(publishedAt desc)
```

4. **Email Notifications**: Your RSS-to-email service will automatically pick up posts once they appear in the RSS feed (which should only happen after `publishedAt` passes).

## Testing

1. Create a test post with `publishedAt` set to 5 minutes in the future
2. Verify it doesn't appear on your blog
3. Wait 5 minutes
4. Refresh your blog - the post should now appear
5. Check your RSS feed - it should also include the post

## Alternative: Server-Side Filtering

If you prefer to filter on the server side (e.g., in an API route):

```javascript
// api/posts.js
export default async function handler(req, res) {
  const query = `*[_type == "post" && publishedAt <= now()] | order(publishedAt desc)`;
  const posts = await client.fetch(query);
  res.json(posts);
}
```

This approach gives you more control and can be useful if you need additional filtering logic.

