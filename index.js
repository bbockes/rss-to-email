// RSS to Email Service using Resend Broadcasts
// File: index.js

import 'dotenv/config';
import Parser from 'rss-parser';
import { Resend } from 'resend';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs/promises';

const RSS_FEED_URL = 'https://blog.brendanbockes.com/feed.xml';

// Initialize
const parser = new Parser();
const resend = new Resend(process.env.RESEND_API_KEY);

// Initialize Supabase
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

// Check if a post has been sent
async function isPostSent(postUrl) {
  const { data, error } = await supabase
    .from('sent_posts')
    .select('post_url')
    .eq('post_url', postUrl)
    .single();
  
  if (error && error.code !== 'PGRST116') { // PGRST116 = not found (which is ok)
    console.error('Error checking sent posts:', error);
    throw error;
  }
  
  return !!data; // Returns true if post exists
}

// Mark a post as sent
async function markPostAsSent(postUrl, postTitle) {
  const { error } = await supabase
    .from('sent_posts')
    .insert([
      { 
        post_url: postUrl,
        post_title: postTitle,
        sent_at: new Date().toISOString()
      }
    ]);
  
  if (error) {
    console.error('Error saving sent post:', error);
    throw error;
  }
}

// Get count of sent posts
async function getSentPostsCount() {
  const { count, error } = await supabase
    .from('sent_posts')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    console.error('Error getting sent posts count:', error);
    return 0;
  }
  
  return count || 0;
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

// Process HTML content to ensure links are properly styled for email clients
function processLinksForEmail(htmlContent) {
  if (!htmlContent) return '';
  
  // Match all <a> tags, including those with existing attributes
  // This regex handles: <a>, <a href="...">, <a class="..." href="...">, etc.
  return htmlContent.replace(
    /<a\s*([^>]*?)>/gi,
    (match, attributes) => {
      // Trim attributes and handle empty case
      attributes = attributes.trim();
      
      // Check if style attribute already exists
      const styleMatch = attributes.match(/style\s*=\s*["']([^"']*?)["']/i);
      
      if (styleMatch) {
        // If style exists, merge our link styles with existing ones
        const existingStyles = styleMatch[1];
        
        // Check if color or text-decoration is already set
        const hasColor = /color\s*:/i.test(existingStyles);
        const hasTextDecoration = /text-decoration\s*:/i.test(existingStyles);
        
        let newStyles = existingStyles.trim();
        if (!hasColor) {
          newStyles += (newStyles ? ' ' : '') + 'color:#3b82f6;';
        }
        if (!hasTextDecoration) {
          newStyles += (newStyles ? ' ' : '') + 'text-decoration:underline;';
        }
        
        // Replace the style attribute with the updated one
        return match.replace(
          /style\s*=\s*["'][^"']*?["']/i,
          `style="${newStyles}"`
        );
      } else {
        // If no style attribute, add one with email-compatible link styles
        // Preserve existing attributes and add style
        return `<a${attributes ? ' ' + attributes + ' ' : ' '}style="color:#3b82f6; text-decoration:underline;">`;
      }
    }
  );
}

// Send email as a broadcast to audience
async function sendEmailBroadcast(post) {
  // Load the template
  const template = await loadTemplate();
  
  // Use content:encoded first (full content), then fallback to content, then snippet
  let fullContent = post['content:encoded'] || post.content || post.contentSnippet || '';
  
  // Process links to ensure they're properly styled for email clients
  fullContent = processLinksForEmail(fullContent);
  
  // Extract preview text (first ~150 chars, strip HTML tags)
  const previewText = fullContent
    .replace(/<[^>]*>/g, '') // Strip HTML tags
    .replace(/\s+/g, ' ') // Replace multiple spaces with single space
    .trim()
    .substring(0, 150) // Limit to 150 characters
    + (fullContent.length > 150 ? '...' : ''); // Add ellipsis if truncated
  
  // Replace placeholders with actual content
  const html = template
    .replace(/{{POST_TITLE}}/g, post.title)
    .replace(/{{POST_LINK}}/g, post.link)
    .replace(/{{POST_CONTENT}}/g, fullContent)
    .replace(/{{POST_TITLE_ENCODED}}/g, encodeURIComponent(post.title))
    .replace(/{{PREVIEW_TEXT}}/g, previewText);

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
      from: 'Brendan\'s Blog <blog@brendanbockes.com>',
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

  // Send the broadcast - schedule 30 seconds in the future
  const sendResponse = await fetch(`https://api.resend.com/broadcasts/${createData.id}/send`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      scheduled_at: new Date(Date.now() + 30000).toISOString()
    })
  });

  const sendData = await sendResponse.json();
  
  if (!sendResponse.ok) {
    console.error('Error sending broadcast:', sendData);
    throw new Error(`Failed to send broadcast: ${JSON.stringify(sendData)}`);
  }

  console.log('✓ Broadcast scheduled to send in 30 seconds!');
  return sendData;
}

// Main function
async function checkFeedAndSend() {
  try {
    console.log('Checking RSS feed...');
    
    // Get count of previously sent posts
    const sentCount = await getSentPostsCount();
    console.log(`Previously sent ${sentCount} posts`);
    
    // Parse the feed
    const feed = await parser.parseURL(RSS_FEED_URL);
    
    // Get the most recent post
    const mostRecentPost = feed.items[0];
    
    if (!mostRecentPost) {
      console.log('No posts found in feed.');
      return;
    }
    
    console.log(`Most recent post: ${mostRecentPost.title}`);
    console.log(`Published: ${mostRecentPost.pubDate}`);
    
    // Use the post link as a unique identifier
    const postUrl = mostRecentPost.link;
    
    // Check if we've already sent this post
    const alreadySent = await isPostSent(postUrl);
    
    if (alreadySent) {
      console.log('This post has already been sent. Skipping.');
      return;
    }
    
    console.log('New post detected! Sending email...');
    
    await sendEmailBroadcast(mostRecentPost);
    
    // Mark this post as sent in the database
    await markPostAsSent(postUrl, mostRecentPost.title);
    
    console.log('✓ Broadcast sent and recorded!');
    console.log('Done!');
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run the check
checkFeedAndSend();