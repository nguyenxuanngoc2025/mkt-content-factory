---
description: [MKT_CONTENT_FACTORY] Kích hoạt nhà máy sản xuất nội dung tự động từ Keyword đến Facebook.
---

# MKT_CONTENT_FACTORY (Phiên bản V6 Hoàn Thiện)
Quy trình End-to-End từ việc cung cấp Từ khóa/Insight đến khi đăng bài viết tự động lên tài khoản Facebook Cá Nhân.

## Các quy chuẩn hệ thống (MANDATORY)
- **ID Bài viết (`post_id`)**: Sử dụng chuẩn `YYYYMMDD_[từ_khóa]_[loại]`. (Ví dụ: `20260407_ai_agent_case_study`).
- **Batch ID (`batch_id`)**: Phân nhóm hàng loạt `batch_YYYYMMDD_[từ_khóa]` (VD: `batch_20260407_ai`).
- **Thư mục ảnh (`image_path`)**: `outputs/images/[post_id].png`.
- **Database**: Supabase `mkt_content_queue`.
- **Automation VPS**: `145.79.8.92` (Xử lý Callback Telegram & Chạy Puppeteer đăng Facebook).

---

// turbo-all
## CÁC BƯỚC THỰC THI CHUẨN

👉 Lệnh kích hoạt ví dụ: `/mkt-factory [Từ khóa hoặc URL YouTube]`

### Bước 1: Deep Research & Khai thác tri thức
1. AI sử dụng công cụ `notebooklm` (MCP Server) để nạp URLs hoặc sử dụng tính năng `research_start` với [Từ khóa].
2. Chờ trạng thái ready. Tiếp tục dùng `notebook_query` để trích xuất:
   - "Top 3 vấn đề thị trường đang làm sai / hiểu lầm."
   - "5 Key Insights đắt giá nhất để giải quyết."
   - "Case Study hoặc dữ liệu chứng thực thực tế."

### Bước 2: AI Viết Content (Content Creation)
1. Đọc tệp Brand Voice: `projects/MKT_CONTENT_FACTORY/IDENTITY_CONFIG.json` (Giọng Nguyễn Ngọc 10x, xưng "Tôi", chuyên gia).
2. Tạo **2 - 4 bài đăng chuyên sâu** (không lan man, tập trung tạo ra giá trị thẳng thắn, mạnh mẽ).
3. Các dạng bài gợi ý: `Case Study`, `Industry Insight`, `Behind the Scene`, `Mindset`.
4. Gán cho từng bài 1 ID đạt chuẩn (e.g. `20260407_ai_case_study`).
5. Nếu bài viết cần ảnh minh hoạ, AI sử dụng tool `generate_image` tạo 1 bức ảnh sắc nét, premium, lưu vào `outputs/images/[post_id].png`.

### Bước 3: Đẩy Dữ Liệu Lên VPS (SCP Phase)
Do VPS đảm nhiệm tự động đăng bài, nên toàn bộ hình ảnh (nếu có) phải đưa lên Server TRƯỚC.
1. AI chạy lệnh Terminal `scp` để đẩy file ảnh lên thư mục của VPS:
   `scp -o StrictHostKeyChecking=no outputs/images/*.png root@145.79.8.92:/root/mkt_factory/outputs/social-posts/YYYY-MM-DD/`

### Bước 4: Tạo Script Bắn Lên Telegram & Supabase
1. AI tự động sinh một script Node.js ngắn (ví dụ: `load_batch_20260407_ai.js`) trong thư mục dự án cục bộ.
2. Script này có nhiệm vụ:
   - Map từng bài viết.
   - Gọi Telegram API (`sendPhoto` hoặc `sendMessage`) với nội dung bài kèm Dàn nút Inline Keyboard: `[ ✅ Đăng luôn | 📅 Lên lịch | ❌ Loại ]`. Callback_data mang format chuẩn `NOW__[post_id]`, v.v...
   - Đồng thời, PATCH API Supabase `mkt_content_queue` lưu bản ghi có `post_id`, `content_text`, text, ID tin nhắn Telegram trả về (`message_id`) và SET `status = 'pending_review'`.
3. AI tự động chạy script (`node load_batch_....js`) bằng công cụ `run_command`.

### Bước 5: Review Phase (Người dùng duyệt bài)
1. Người dùng (Nguyễn Ngọc) nhận trực tiếp bài viết qua ứng dụng Telegram trên điện thoại/máy tính.
2. Bấm `✅ Đăng luôn`: Lập tức chuyển sang Bước 6.
3. Hoặc bấm `📅 Lên lịch`: Nhập hẹn để bot chạy sau.
4. Hoặc bấm `❌ Loại`: Xoá bỏ khỏi bộ bài.
> Luồng này được `mkt-callback` (PM2) tự động túc trực 24/7 trên VPS, AI không cần xử lý thêm.

### Bước 6: Delivery (Đăng Facebook)
1. Sau khi người dùng bấm "Đăng", VPS tự động khởi chạy chuỗi ẩn (`publish_queue.js` chạy Puppeteer Node).
2. Mở Facebook Cá Nhân (Session Bypass = `cookies.json`), nhập chính xác từng ký tự chữ, tick chọn hình ảnh đã được SCP ở Bước 3.
3. Nhập "Đăng". Chụp hình báo cáo `debug_after_click.png`.
4. Bắn thông báo `📊 Báo cáo đăng bài FB` với chữ `✅ Thành công` ngược trở lại Telegram cho Người dùng yên tâm.

---
## Tóm tắt Nhiệm Vụ của Bot khi chạy Workflow:
- Chỉ cần bám sát việc **Research → Sinh nội dung + Ảnh → SCP Ảnh lên VPS → Code Script Loader (Node.JS) đẩy vào Telegram / Supabase → Chạy Cú Chót**.
- Từ Bước 5 trở đi hệ thống VPS đã tự động hoàn thành.
