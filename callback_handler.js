/**
 * callback_handler.js — Lắng nghe callback từ Telegram, update Supabase
 *
 * Chạy: node callback_handler.js
 * Dừng: Ctrl+C
 *
 * Actions:
 *   NOW__<post_id>    → status = 'approved', đăng FB ngay lập tức
 *   SCHED__<post_id>  → status = 'scheduled', scheduled_at = slot tiếp theo
 *   REJECT__<post_id> → status = 'rejected'
 */

const https = require('https');
const path = require('path');

// Hardcode credentials (tránh dotenvx inject lỗi)
const TG_TOKEN = '8670136699:AAGCkkHXcut_2kOcR38F4wKcc75SfWqu9cg';
const TG_CHAT  = '5884430619';
const SUPABASE_URL = 'https://studio.ngocnguyenxuan.com/rest/v1';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIiwiaXNzIjoic3VwYWJhc2UiLCJpYXQiOjE3NzIxMjUyMDAsImV4cCI6MTkyOTg5MTYwMH0.EswkDe7Zm8fNHw2pc08qoDYz5ahrk8koVHydLDQQSYU';

// ─── Lịch đăng bài (dựa theo IDENTITY_CONFIG.json) ────────────────────────────
const SCHEDULE_SLOTS = [
  { day: 2, hour: 7,  minute: 30 }, // Thứ 3 07:30
  { day: 3, hour: 12, minute: 0  }, // Thứ 4 12:00
  { day: 5, hour: 19, minute: 30 }, // Thứ 6 19:30
  { day: 0, hour: 20, minute: 30 }, // Chủ nhật 20:30
];

async function getNextSlot() {
  const now = new Date();
  
  // Lấy thời gian scheduled_at xa nhất chưa đăng (status=scheduled, scheduled_at >= now)
  const queryPath = `/mkt_content_queue?status=eq.scheduled&scheduled_at=gte.${now.toISOString()}&order=scheduled_at.desc&limit=1`;
  const res = await supabase('GET', queryPath);
  
  let baseTime = now;
  if (res.status === 200 && res.body && res.body.length > 0) {
    const dbLast = new Date(res.body[0].scheduled_at);
    if (dbLast > baseTime) baseTime = dbLast;
  }

  // baseTime là mốc thời gian. Cần tìm slot ngay sau baseTime.
  // Giả lập timezone VN bằng cách cộng 7 tiếng vào timestamp UTC.
  const baseTimeVN = new Date(baseTime.getTime() + 7 * 3600 * 1000);

  const candidates = [];
  for (let week = 0; week <= 2; week++) {
    for (const slot of SCHEDULE_SLOTS) {
      const d = new Date(baseTimeVN.getTime());
      const currentDay = d.getUTCDay();
      const dayDiff = (slot.day - currentDay + 7) % 7 + week * 7;
      
      d.setUTCDate(d.getUTCDate() + dayDiff);
      d.setUTCHours(slot.hour, slot.minute, 0, 0);
      
      if (d > baseTimeVN) {
        // d đang ở VN Time. Trừ ngược 7 tiếng để ra UTC thật.
        candidates.push(new Date(d.getTime() - 7 * 3600 * 1000));
      }
    }
  }
  
  candidates.sort((a, b) => a - b);
  return candidates[0] || new Date(now.getTime() + 24 * 3600 * 1000);
}

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

const supabase = (method, path, body) => request({
  hostname: 'studio.ngocnguyenxuan.com',
  method,
  path: `/rest/v1${path}`,
  headers: {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    Prefer: 'return=representation',
    'Content-Type': 'application/json',
  },
}, body);

// ─── Xử lý callback ────────────────────────────────────────────────────────────
async function handleCallback(cb) {
  const { data, message, from, id: callback_query_id } = cb;
  if (!data) return;

  const [action, post_id] = data.split('__');
  if (!action || !post_id) return;

  console.log(`\n📥 Callback: ${action} → ${post_id} (from: ${from.first_name})`);

  let update = {};
  let replyText = '';

  switch (action) {
    case 'NOW':
      update = { status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: from.first_name };
      replyText = `✅ <b>Đăng luôn!</b> Bài <code>${post_id}</code> sẽ được đăng lên Facebook ngay.`;
      break;

    case 'SCHED': {
      const nextSlot = await getNextSlot();
      const slotStr = nextSlot.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
      update = {
        status: 'scheduled',
        scheduled_at: nextSlot.toISOString(),
        reviewed_at: new Date().toISOString(),
        reviewed_by: from.first_name,
        slot_label: slotStr,
      };
      replyText = `📅 <b>Đã lên lịch!</b> Bài <code>${post_id}</code> sẽ đăng lúc <b>${slotStr}</b>\n\nBấm 🚀 Đăng ngay bên dưới nếu muốn đăng luôn.`;
      // Sau khi xử lý xong, sẽ thêm nút Đăng ngay vào message gốc
      break;
    }

    case 'REJECT':
      update = { status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: from.first_name };
      replyText = `❌ <b>Đã loại bài</b> <code>${post_id}</code>`;
      break;

    case 'POST_NOW':
      // Đăng ngay bài đã lên lịch
      update = { status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: from.first_name };
      replyText = `🚀 <b>Đang đăng ngay!</b> Bài <code>${post_id}</code> sẽ được publish lên Facebook.`;
      break;

    default:
      console.log('❓ Action không xác định:', action);
      return;
  }

  // Update Supabase
  const res = await supabase('PATCH', `/mkt_content_queue?post_id=eq.${post_id}`, update);
  if (res.status >= 300) {
    console.error('❌ Supabase PATCH lỗi:', res.body);
    await tg('answerCallbackQuery', { callback_query_id, text: '❌ Lỗi cập nhật DB!', show_alert: true });
    return;
  }

  console.log(`   ✅ DB cập nhật: status = ${update.status}`);

  // Trả lời Telegram
  await tg('answerCallbackQuery', { callback_query_id, text: '✅ Đã lưu!' });

  // Edit message: ẩn nút cũ, thêm nút phù hợp
  if (message) {
    // Với bài đã lên lịch → giữ nút Đăng ngay
    const newKeyboard = action === 'SCHED'
      ? { inline_keyboard: [[{ text: '🚀 Đăng ngay', callback_data: `POST_NOW__${post_id}` }]] }
      : { inline_keyboard: [] };

    await tg('editMessageReplyMarkup', {
      chat_id: message.chat.id,
      message_id: message.message_id,
      reply_markup: newKeyboard,
    });
    await tg('sendMessage', {
      chat_id: message.chat.id,
      parse_mode: 'HTML',
      text: replyText,
      reply_to_message_id: message.message_id,
    });
  }

  // Nếu là "Đăng luôn" hoặc "Đăng ngay" → trigger publisher
  if (action === 'NOW' || action === 'POST_NOW') {
    console.log(`🚀 Kích hoạt publisher cho ${post_id}`);
    const { exec } = require('child_process');
    exec(`node ${path.join(__dirname, 'publish_queue.js')} --post_id ${post_id}`, (err, stdout, stderr) => {
      if (err) console.error('Publisher error:', err.message);
      else console.log('Publisher output:', stdout.trim());
    });
  }
}

// ─── Long polling ──────────────────────────────────────────────────────────────
let offset = 0;

async function poll() {
  try {
    const res = await tg('getUpdates', { offset, timeout: 20, allowed_updates: ['callback_query'] });
    if (!res.body.ok) {
      console.error('getUpdates error:', res.body.description);
      return;
    }
    for (const update of res.body.result || []) {
      offset = update.update_id + 1;
      if (update.callback_query) {
        await handleCallback(update.callback_query);
      }
    }
  } catch (e) {
    console.error('Poll error:', e.message);
  }
}

console.log('🤖 Callback Handler đang chạy... (Ctrl+C để dừng)');
console.log(`   Bot token: ...${TG_TOKEN?.slice(-10)}`);
(async function loop() {
  while (true) {
    await poll();
    await new Promise(r => setTimeout(r, 500));
  }
})();
