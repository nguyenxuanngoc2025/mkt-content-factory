/**
 * send_for_review.js — Bước 2: Gửi content lên Telegram để duyệt
 *
 * Usage:
 *   node send_for_review.js                         # Review tất cả pending chưa gửi
 *   node send_for_review.js --text "Nội dung..."    # Gửi nhanh 1 bài inline
 *   node send_for_review.js --file outputs/bai1.md  # Gửi từ file markdown
 *
 * Callback buttons:
 *   ✅ Đăng luôn  → status = 'approved', scheduled_at = null
 *   📅 Lên lịch   → status = 'scheduled', scheduled_at = next_slot
 *   ❌ Loại       → status = 'rejected'
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Hardcode credentials (tránh dotenvx inject lỗi trên VPS)
const TG_TOKEN = '8670136699:AAGCkkHXcut_2kOcR38F4wKcc75SfWqu9cg';
const TG_CHAT  = '5884430619';
const SUPABASE_URL  = 'https://studio.ngocnguyenxuan.com/rest/v1';
const SUPABASE_KEY  = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzIxMjUyMDAsImV4cCI6MTkyOTg5MTYwMH0.EswkDe7Zm8fNHw2pc08qoDYz5ahrk8koVHydLDQQSYU';

// ─── HTTP helper ───────────────────────────────────────────────────────────────
function request(opts, body) {
  return new Promise((resolve, reject) => {
    const s = body ? JSON.stringify(body) : undefined;
    const req = https.request({
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        ...(s ? { 'Content-Length': Buffer.byteLength(s) } : {}),
        ...opts.headers,
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (s) req.write(s);
    req.end();
  });
}

const tg = (method, body) => request(
  { hostname: 'api.telegram.org', method: 'POST', path: `/bot${TG_TOKEN}/${method}` },
  body
);

const supabase = (method, path, body, extra = {}) => request({
  hostname: 'studio.ngocnguyenxuan.com',
  method,
  path: `/rest/v1${path}`,
  headers: {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    Prefer: 'return=representation',
    ...extra,
  },
}, body);

// ─── HTTP multipart helper cho Telegram ───────────────────────────────────────
function tgSendPhoto(chat_id, image_path, captionStr = '') {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('chat_id', chat_id);
    form.append('photo', fs.createReadStream(image_path));
    if (captionStr) form.append('caption', captionStr);
    form.append('parse_mode', 'HTML');

    const req = https.request({
      hostname: 'api.telegram.org',
      method: 'POST',
      path: `/bot${TG_TOKEN}/sendPhoto`,
      headers: form.getHeaders(),
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    form.pipe(req);
  });
}

// ─── Inline keyboard ───────────────────────────────────────────────────────────
function buildKeyboard(post_id) {
  return {
    inline_keyboard: [[
      { text: '✅ Đăng luôn',  callback_data: `NOW__${post_id}` },
      { text: '📅 Lên lịch',   callback_data: `SCHED__${post_id}` },
      { text: '❌ Loại',       callback_data: `REJECT__${post_id}` },
    ]],
  };
}

// ─── Gửi 1 bài lên Telegram + lưu vào Supabase ────────────────────────────────
async function sendForReview({ post_id, batch_id, post_type, content_text, image_path, slot_label }, skipInsert = false) {

  // Upsert vào Supabase (chỉ khi insert mới — mode --text/--file)
  if (!skipInsert) {
    const insertRes = await supabase('POST', '/mkt_content_queue', {
      post_id,
      batch_id: batch_id || null,
      post_type: post_type || 'Facebook Post',
      content_text,
      image_url: image_path || null,
      status: 'pending',
      retry_count: 0,
    }, { Prefer: 'resolution=merge-duplicates' });

    if (insertRes.status >= 300) {
      console.error('❌ UPSERT lỗi:', insertRes.body);
      return;
    }
    console.log(`✅ Đã lưu ${post_id} vào DB`);
  }

  // Gửi text + keyboard
  const slotLine = slot_label ? `\n📅 <i>Slot: ${slot_label}</i>` : '';
  const caption = `<b>📝 ${post_type || 'Post'}</b>\n<code>${post_id}</code>${slotLine}`;

  // Nếu có image_path, gửi ảnh thành 1 tin nhắn riêng biệt ngay phía trên
  if (image_path && fs.existsSync(image_path)) {
    const photoRes = await tgSendPhoto(TG_CHAT, image_path);
    if (!photoRes.body.ok) {
      console.error('❌ Gửi ảnh Telegram lỗi:', photoRes.body.description);
    } else {
      console.log(`📸 Đã gửi ảnh thumbnail đính kèm.`);
    }
  }

  const textRes = await tg('sendMessage', {
    chat_id: TG_CHAT,
    parse_mode: 'HTML',
    text: `${caption}\n\n${content_text.substring(0, 3000)}`,
    reply_markup: buildKeyboard(post_id),
  });

  if (!textRes.body.ok) {
    console.error('❌ Gửi Telegram lỗi:', textRes.body.description);
    return;
  }

  // Lưu telegram_message_id + cập nhật status → pending_review
  const msg_id = textRes.body.result.message_id;
  await supabase('PATCH', `/mkt_content_queue?post_id=eq.${post_id}`, {
    telegram_message_id: msg_id,
    telegram_chat_id: TG_CHAT,
    status: 'pending_review',
    updated_at: new Date().toISOString(),
  });

  console.log(`📨 Đã gửi Telegram msg#${msg_id} cho ${post_id} → status: pending_review`);
}

// ─── Parse CLI args ────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);

  let image_path = null;
  if (args.includes('--image')) {
    const imgIdx = args.indexOf('--image') + 1;
    image_path = args[imgIdx];
  }

  // FORCE IMAGE VALIDATION
  if (!image_path || !fs.existsSync(image_path)) {
    console.error('❌ LỖI NGHIÊM TRỌNG: Bắt buộc phải đính kèm ảnh bằng cờ --image <path> và file ảnh phải tồn tại. Hệ thống từ chối lưu bài viết thiếu ảnh tĩnh.');
    process.exit(1);
  }

  if (args.includes('--text')) {
    // Gửi nhanh inline
    const textIdx = args.indexOf('--text') + 1;
    const content_text = args[textIdx];
    const post_id = `quick_${Date.now()}`;
    await sendForReview({ post_id, post_type: 'Quick Post', content_text, image_path });

  } else if (args.includes('--file')) {
    // Gửi từ file markdown
    const fileIdx = args.indexOf('--file') + 1;
    const filePath = args[fileIdx];
    const content_text = fs.readFileSync(filePath, 'utf-8').trim();
    const post_id = `file_${path.basename(filePath, '.md')}_${Date.now()}`;
    await sendForReview({ post_id, post_type: 'Post từ file', content_text, image_path });

  } else {
    // Đọc từ Supabase — gửi các bài pending_review chưa có telegram_message_id
    const rows = await supabase('GET',
      '/mkt_content_queue?status=eq.pending&telegram_message_id=is.null&order=created_at.asc&limit=10'
    );
    const items = rows.body;
    if (!Array.isArray(items) || items.length === 0) {
      console.log('📭 Không có bài nào cần gửi review');
      return;
    }
    console.log(`📋 Tìm thấy ${items.length} bài cần gửi review`);
    for (const item of items) {
      await sendForReview(item, true); // skipInsert = true: row đã có trong DB
      await new Promise(r => setTimeout(r, 1000)); // Tránh rate limit
    }
  }
}

main().catch(console.error);
