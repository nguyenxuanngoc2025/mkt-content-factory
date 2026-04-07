# Hướng dẫn thiết lập hệ thống Auto FB Post V6

Đây là toàn bộ mã nguồn của hệ thống MKT CONTENT FACTORY (V6).
Nó cho phép gửi bài viết (có ảnh/không ảnh) từ máy khách lên một Telegram Bot. Từ trên điện thoại, bạn có thể bấm [✅ Đăng luôn] hoặc [📅 Lên lịch], một VPS chứa máy ảo ẩn (Puppeteer) sẽ tự động mở tài khoản Facebook Cá nhân của bạn và đánh chữ/đăng ảnh.

## Danh sách Tệp & Chức năng
1. **`database_schema.sql`**: Chứa câu lệnh để tạo bảng `mkt_content_queue` trên Supabase (Database).
2. **`workflow-instructions.md`**: File kịch bản/quy trình hoàn chỉnh dành cho AI đọc để biết cách sinh ý tưởng và gọi API. Nếu dùng OpenSpace hoặc IDE có AI, hãy cấp cho nó file này.
3. **`send_for_review.js`**: Script mẫu (Data Loader) để Test gửi 1 bài viết kèm nút bấm Telegram. (Chạy ở máy khách rảnh rỗi).
4. **`callback_handler.js`**: Webhook lắng nghe lúc bạn bấm nút `[Đăng luôn]` trên Telegram. (Luôn chạy trên VPS).
5. **`publish_queue.js`**: Script xử lý nghiệp vụ tìm bài cần đăng, đẩy vào hàng đợi và nhắn Report lên Telegram. (Chạy trên VPS).
6. **`fb_poster.js`**: Module lõi dùng Puppeteer mở Facebook giả lập người dùng. Đóng vai trò là bàn tay nhân viên bấm đăng bài.
7. **`setup_vps.sh`**: File mẫu hướng dẫn cài đặt thư viện cho VPS Ubuntu (Node.js, Puppeteer, PM2).

---

## Các Bước Cài Đặt (Cho Developer)

### Bước 1: Chuẩn bị Môi trường
- 1 Bot Telegram Token.
- 1 Supabase Project (tạo free). Chạy file `database_schema.sql` trong SQL Editor của Supabase.
- 1 VPS Cloud (VD: Hetzner / DigitalOcean - Ubuntu).

### Bước 2: Config Key vào File
Mở các file `.js` và thay thế toàn bộ các biến số ở trên cùng file:
- `<YOUR_TELEGRAM_BOT_TOKEN>`
- `<YOUR_TELEGRAM_CHAT_ID>`
- `<YOUR_SUPABASE_API_KEY_SERVICE_ROLE>`
- `YOUR_SUPABASE_HOSTNAME_HERE`

### Bước 3: Đưa Lên VPS
1. Đưa `setup_vps.sh` lên VPS và chạy: `bash setup_vps.sh`
2. Đưa `fb_poster.js`, `publish_queue.js`, `callback_handler.js` thả vào 1 thư mục (VD: `/root/mkt_factory`).
3. Khởi tạo phiên làm việc Facebook:
   - Trên VPS hoặc một máy tính local, trích xuất file `cookies.json` của tài khoản Facebook bạn muốn dùng.
   - Thả file `cookies.json` nằm cùng thư mục với `fb_poster.js`.

### Bước 4: Chạy Lắng Nghe Nút Bấm
Sử dụng PM2 để chạy webhook ẩn trên VPS 24/7:
```bash
pm2 start callback_handler.js --name "fb-tele-bot"
```

### Bước 5: Chạy Auto Lên Lịch (Tùy chọn)
Nếu bạn muốn dùng nút [📅 Lên lịch], hãy thêm lệnh crontab trên VPS (mỗi phút chạy kiểm tra hàng chờ 1 lần):
```bash
* * * * * /usr/bin/node /root/mkt_factory/publish_queue.js --scheduled >> /root/mkt_factory/cron_scheduled.log 2>&1
```

### Bước 6: Thử Nghiệm
Chạy trên máy khách:
```bash
node send_for_review.js --text "Test hệ thống Automation!"
```
Bạn sẽ thấy Telegram nổ tin nhắn. Bấm [✅ Đăng luôn]. Đợi 30s mở Facebook ra và xem phép màu!
