CREATE TABLE mkt_content_queue (
  post_id text PRIMARY KEY,
  batch_id text,
  post_type text,
  content_text text,
  image_url text,
  slot_label text,
  status text DEFAULT 'pending',
  scheduled_at timestamp with time zone,
  posted_at timestamp with time zone,
  telegram_message_id bigint,
  telegram_chat_id bigint,
  fail_reason text,
  retry_count integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
