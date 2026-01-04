// RSS to Email Service using Resend
// File: index.js

import Parser from 'rss-parser';
import { Resend } from 'resend';
import fs from 'fs/promises';
import { createClient } from '@sanity/client';
import { toHTML } from '@portabletext/to-html';

const RSS_FEED_URL = 'https://blog.brendanbockes.com/feed.xml';
const SENT_POSTS_FILE = './sent-posts.json';

// Initialize
const parser = new Parser();
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Sanity client
const sanityClient = createClient({
  projectId: 'wxzoc64y',
  dataset: 'production',
  useCdn: true,
  apiVersion: '2024-01-01'
});

// Load previously sent post IDs
async function loadSentPosts() {
  try {
    const data = await fs.readFile(SENT_POSTS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    // File doesn't exist yet, return empty array
    return [];
  }
}

// Save sent post IDs
async function saveSentPosts(sentPosts) {
  await fs.writeFile(SENT_POSTS_FILE, JSON.stringify(sentPosts, null, 2));
}

// Load email template
async function loadTemplate() {
  try {
    return await fs.readFile('./email-template.html', 'utf8');
  } catch (error) {
    console.error('Error loading email template:', error);
    throw error;
  }
}

// Fetch full post content from Sanity
async function fetchPostContentFromSanity(postUrl) {
  try {
    console.log(`Fetching content from Sanity for: ${postUrl}`);
    
    // Extract slug from URL
    // URL format: https://blog.brendanbockes.com/posts/slug-name
    const slug = postUrl.split('/posts/')[1];
    if (!slug) {
      console.error('Could not extract slug from URL:', postUrl);
      return null;
    }
    
    console.log('Looking for post with slug:', decodeURIComponent(slug));
    
    // Query Sanity for the post by slug
    const query = `*[_type == "post" && slug.current == $slug][0]{
      title,
      body,
      publishedAt
    }`;
    
    const post = await sanityClient.fetch(query, { slug: decodeURIComponent(slug) });
    
    if (!post || !post.body) {
      console.warn('Post not found or has no body content');
      return null;
    }
    
    console.log('✓ Found post in Sanity');
    
    // Convert Portable Text to HTML
    const html = toHTML(post.body, {
      components: {
        marks: {
          link: ({value, children}) => {
            const href = value?.href || '';
            return `<a href="${href}" style="color: #3b82f6; text-decoration: underline;">${children}</a>`;
          }
        },
        block: {
          normal: ({children}) => `<p style="margin: 0 0 1em 0;">${children}</p>`,
          h1: ({children}) => `<h1 style="margin: 1.5em 0 0.5em 0; font-size: 2em; font-weight: 700;">${children}</h1>`,
          h2: ({children}) => `<h2 style="margin: 1.5em 0 0.5em 0; font-size: 1.5em; font-weight: 700;">${children}</h2>`,
          h3: ({children}) => `<h3 style="margin: 1.5em 0 0.5em 0; font-size: 1.25em; font-weight: 700;">${children}</h3>`,
          blockquote: ({children}) => `<blockquote style="margin: 1.5em 0; padding-left: 1em; border-left: 3px solid #e5e7eb; color: #6b7280;">${children}</blockquote>`
        },
        list: {
          bullet: ({children}) => `<ul style="margin: 1em 0; padding-left: 2em;">${children}</ul>`,
          number: ({children}) => `<ol style="margin: 1em 0; padding-left: 2em;">${children}</ol>`
        },
        listItem: {
          bullet: ({children}) => `<li style="margin: 0.25em 0;">${children}</li>`,
          number: ({children}) => `<li style="margin: 0.25em 0;">${children}</li>`
        }
      }
    });
    
    return html;
  } catch (error) {
    console.error('Error fetching from Sanity:', error);
    return null;
  }
}

// Send email for a new post
async function sendEmail(post) {
  // Load the template
  const template = await loadTemplate();
  
  // Fetch full post content from Sanity
  const fullContent = await fetchPostContentFromSanity(post.link);
  const content = fullContent || post.contentSnippet || post.content || '';
  
  // Replace placeholders with actual content
  const html = template
    .replace(/{{POST_TITLE}}/g, post.title)
    .replace(/{{POST_LINK}}/g, post.link)
    .replace(/{{POST_CONTENT}}/g, content)
    .replace(/{{POST_TITLE_ENCODED}}/g, encodeURIComponent(post.title));

  const { data, error } = await resend.emails.send({
    from: 'Brendan\'s Blog <onboarding@resend.dev>', // Change this after verifying your domain
    to: process.env.RECIPIENT_EMAIL,
    subject: `New Post: ${post.title}`,
    html: html
  });

  if (error) {
    throw error;
  }

  return data;
}

// Main function
async function checkFeedAndSend() {
  try {
    console.log('Checking RSS feed...');
    
    // Parse the feed
    const feed = await parser.parseURL(RSS_FEED_URL);
    
    // Load sent posts
    const sentPosts = await loadSentPosts();
    
    // Check for new posts
    const newPosts = feed.items.filter(item => !sentPosts.includes(item.guid || item.link));
    
    if (newPosts.length === 0) {
      console.log('No new posts found.');
      return;
    }
    
    // Only send the most recent post
    const mostRecentPost = newPosts[0];
    
    console.log(`Found ${newPosts.length} new post(s). Sending only the most recent.`);
    console.log(`Sending email for: ${mostRecentPost.title}`);
    
    await sendEmail(mostRecentPost);
    sentPosts.push(mostRecentPost.guid || mostRecentPost.link);
    console.log('✓ Email sent!');
    
    // Save updated sent posts
    await saveSentPosts(sentPosts);
    console.log('Done!');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the check
checkFeedAndSend();