-- Create table for tracking sent posts
CREATE TABLE sent_posts (
  id BIGSERIAL PRIMARY KEY,
  post_url TEXT UNIQUE NOT NULL,
  post_title TEXT NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on post_url for faster lookups
CREATE INDEX idx_sent_posts_url ON sent_posts(post_url);

-- Create index on sent_at for analytics
CREATE INDEX idx_sent_posts_sent_at ON sent_posts(sent_at DESC);
