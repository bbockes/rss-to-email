// RSS to Email Service using Resend
// File: index.js

import Parser from 'rss-parser';
import { Resend } from 'resend';
import fs from 'fs/promises';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

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

// Fetch full post content from the blog
async function fetchPostContent(url) {
  try {
    console.log(`Fetching full content from: ${url}`);
    const response = await fetch(url);
    const html = await response.text();
    
    // Parse the HTML
    const $ = cheerio.load(html);
    
    // Extract the article content - adjust selector if needed
    // Common selectors: article, .post-content, .entry-content, main
    const articleContent = $('article').html() || 
                          $('.post-content').html() || 
                          $('main').html() ||
                          $('body').html();
    
    if (!articleContent) {
      console.warn('Could not find article content, using snippet');
      return null;
    }
    
    return articleContent;
  } catch (error) {
    console.error('Error fetching post content:', error);
    return null;
  }
}

// Send email for a new post
async function sendEmail(post) {
  // Load the template
  const template = await loadTemplate();
  
  // Fetch full post content
  const fullContent = await fetchPostContent(post.link);
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