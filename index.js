// RSS to Email Service using Resend Broadcasts
// File: index.js

import Parser from 'rss-parser';
import { Resend } from 'resend';
import fs from 'fs/promises';

const RSS_FEED_URL = 'https://blog.brendanbockes.com/feed.xml';
const SENT_POSTS_FILE = './sent-posts.json';

// Initialize
const parser = new Parser();
const resend = new Resend(process.env.RESEND_API_KEY);

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

// Send email as a broadcast to audience
async function sendEmailBroadcast(post) {
  // Load the template
  const template = await loadTemplate();
  
  // Use content:encoded first (full content), then fallback to content, then snippet
  const fullContent = post['content:encoded'] || post.content || post.contentSnippet || '';
  
  // Replace placeholders with actual content
  const html = template
    .replace(/{{POST_TITLE}}/g, post.title)
    .replace(/{{POST_LINK}}/g, post.link)
    .replace(/{{POST_CONTENT}}/g, fullContent)
    .replace(/{{POST_TITLE_ENCODED}}/g, encodeURIComponent(post.title));

  console.log('Creating broadcast for audience...');

  // Create the broadcast using fetch (Resend SDK doesn't support broadcasts yet)
  const createResponse = await fetch('https://api.resend.com/broadcasts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      audience_id: process.env.RESEND_AUDIENCE_ID,
      from: 'Brendan\'s Blog <onboarding@resend.dev>',
      subject: `New Post: ${post.title}`,
      html: html,
      name: `Blog Post: ${post.title}`
    })
  });

  const createData = await createResponse.json();
  
  if (!createResponse.ok) {
    console.error('Error creating broadcast:', createData);
    throw new Error(`Failed to create broadcast: ${JSON.stringify(createData)}`);
  }

  console.log('Broadcast created:', createData.id);
  console.log('Sending broadcast now...');

  // Send the broadcast immediately (1 second from now)
  const scheduledAt = new Date(Date.now() + 1000).toISOString();
  
  const sendResponse = await fetch(`https://api.resend.com/broadcasts/${createData.id}/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      scheduled_at: scheduledAt
    })
  });

  const sendData = await sendResponse.json();
  
  if (!sendResponse.ok) {
    console.error('Error sending broadcast:', sendData);
    throw new Error(`Failed to send broadcast: ${JSON.stringify(sendData)}`);
  }

  console.log('✓ Broadcast scheduled successfully!');
  return sendData;
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
    
    await sendEmailBroadcast(mostRecentPost);
    sentPosts.push(mostRecentPost.guid || mostRecentPost.link);
    console.log('✓ Broadcast sent!');
    
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