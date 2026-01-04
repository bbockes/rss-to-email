// RSS to Email Service using Resend
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

// Send email for a new post
async function sendEmail(post) {
  const { data, error } = await resend.emails.send({
    from: 'Your Blog <onboarding@resend.dev>', // Change this after verifying your domain
    to: process.env.RECIPIENT_EMAIL,
    subject: `New Post: ${post.title}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>${post.title}</h2>
        <p style="color: #666; font-size: 14px;">
          Published: ${new Date(post.pubDate).toLocaleDateString()}
        </p>
        <div style="margin: 20px 0;">
          ${post.contentSnippet || post.content || ''}
        </div>
        <a href="${post.link}" 
           style="display: inline-block; padding: 10px 20px; background: #000; color: #fff; text-decoration: none; border-radius: 5px;">
          Read More
        </a>
      </div>
    `
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
    
    console.log(`Found ${newPosts.length} new post(s)!`);
    
    // Send emails for new posts
    for (const post of newPosts) {
      console.log(`Sending email for: ${post.title}`);
      await sendEmail(post);
      sentPosts.push(post.guid || post.link);
      console.log('✓ Email sent!');
    }
    
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