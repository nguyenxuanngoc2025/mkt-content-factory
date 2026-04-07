/**
 * publish_queue.js — Bước 4: Đọc DB, đăng lên Facebook, cập nhật status, báo cáo
 *
 * Chạy trên VPS (hoặc local):
 *   node publish_queue.js              # Đăng tất cả 'approved' (không hết hạn)
 *   node publish_queue.js --scheduled  # Đăng các bài 'scheduled' đã đến giờ
 *   node publish_queue.js --post_id X  # Đăng ngay 1 bài cụ thể (dùng từ callback)
 *   node publish_queue.js --dry-run    # Giả lập không đăng thật
 */

const https = require('https');
const TG_TOKEN = '<YOUR_TELEGRAM_BOT_TOKEN>';
const TG_CHAT  = '<YOUR_TELEGRAM_CHAT_ID>';
const SUPABASE_KEY = '<YOUR_SUPABASE_API_KEY_SERVICE_ROLE>';

const isDryRun = process.argv.includes('--dry-run');
const isScheduled = process.argv.includes('--scheduled');
const singlePostId = (() => {
  const idx = process.argv.indexOf('--post_id');
  return idx !== -1 ? process.argv[idx + 1] : null;
})();

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

const supabase = (method, spath, body) => request({
  hostname: 'studio.ngocnguyenxuan.com',
  method,
  path: `/rest/v1${spath}`,
  headers: {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
    Prefer: 'return=representation',
    'Content-Type': 'application/json',
  },
}, body);

// ─── Facebook poster (dùng lại fb_poster.js) ──────────────────────────────────
async function postToFacebook(content_text, image_path) {
  if (isDryRun) {
    console.log(`   [DRY-RUN] Sẽ đăng: "${content_text.substring(0, 60)}..." (có ảnh: ${!!image_path})`);
    return true;
  }
  const { postToFacebook: fbPost } = require('./fb_poster.js');
  return fbPost(content_text, image_path);
}

// ─── Gửi báo cáo Telegram ──────────────────────────────────────────────────────
async function sendReport(posted, failed) {
  const lines = [
    `<b>📊 Báo cáo đăng bài Facebook</b>`,
    `🕐 ${new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}`,
    ``,
    `✅ Đăng thành công: <b>${posted.length} bài</b>`,
    ...posted.map(p => `  • <code>${p.post_id}</code> — ${p.post_type || 'Post'}`),
  ];
  if (failed.length > 0) {
    lines.push(``, `❌ Thất bại: <b>${failed.length} bài</b>`);
    lines.push(...failed.map(f => `  • <code>${f.post_id}</code>: ${f.reason}`));
  }
  if (isDryRun) lines.push(``, `⚠️ <i>DRY-RUN mode — chưa đăng bài thật</i>`);

  await tg('sendMessage', {
    chat_id: TG_CHAT,
    parse_mode: 'HTML',
    text: lines.join('\n'),
  });
}

// ─── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`🚀 Publisher bắt đầu ${isDryRun ? '(DRY-RUN)' : ''}`);

  // Lấy danh sách bài cần đăng từ Supabase
  let query;
  if (singlePostId) {
    query = `/mkt_content_queue?post_id=eq.${singlePostId}&select=*`;
  } else if (isScheduled) {
    const now = new Date().toISOString();
    query = `/mkt_content_queue?status=eq.scheduled&scheduled_at=lte.${now}&order=scheduled_at.asc&limit=5&select=*`;
  } else {
    query = `/mkt_content_queue?status=eq.approved&order=created_at.asc&limit=5&select=*`;
  }

  const res = await supabase('GET', query);
  const items = res.body;

  if (!Array.isArray(items) || items.length === 0) {
    console.log('📭 Không có bài nào cần đăng');
    return;
  }

  console.log(`📋 Tìm thấy ${items.length} bài cần đăng`);

  const posted = [];
  const failed = [];

  for (const item of items) {
    console.log(`\n📝 Đăng bài: ${item.post_id} (${item.post_type})`);

    // Đánh dấu đang xử lý
    await supabase('PATCH', `/mkt_content_queue?post_id=eq.${item.post_id}`, {
      status: 'posting',
      updated_at: new Date().toISOString(),
    });

    try {
      await postToFacebook(item.content_text, item.image_url);

      // Thành công → update posted
      await supabase('PATCH', `/mkt_content_queue?post_id=eq.${item.post_id}`, {
        status: 'posted',
        posted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      console.log(`   ✅ Đăng xong: ${item.post_id}`);
      posted.push(item);

    } catch (e) {
      console.error(`   ❌ Lỗi khi đăng ${item.post_id}:`, e.message);

      // Thất bại → update failed
      await supabase('PATCH', `/mkt_content_queue?post_id=eq.${item.post_id}`, {
        status: 'failed',
        fail_reason: e.message,
        retry_count: (item.retry_count || 0) + 1,
        updated_at: new Date().toISOString(),
      });

      failed.push({ ...item, reason: e.message });
    }

    // Delay giữa các bài (tránh Facebook detect spam)
    if (items.indexOf(item) < items.length - 1) {
      console.log('   ⏳ Chờ 30s trước bài tiếp theo...');
      await new Promise(r => setTimeout(r, 30000));
    }
  }

  // Gửi báo cáo
  await sendReport(posted, failed);
  console.log(`\n📊 Hoàn tất: ${posted.length} thành công, ${failed.length} thất bại`);
}

main().catch(async (e) => {
  console.error('💥 Fatal error:', e);
  await tg('sendMessage', {
    chat_id: TG_CHAT,
    text: `💥 Publisher crash: ${e.message}`,
  }).catch(() => {});
  process.exit(1);
});

