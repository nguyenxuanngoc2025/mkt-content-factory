Hôm nay mình vừa test hoàn thiện một công cụ nội bộ để tự động hóa quy trình sản xuất & đăng tải nội dung cá nhân (MKT Content Factory V6). Thấy luồng chạy mượt mà ổn định nên quyết định đóng gói lại và share mã nguồn mở (Open-source) cho cộng đồng.

### ⚙️ Bản chất Tool này là gì?
Đây là hệ thống End-to-End Automation điều khiển toàn bộ bằng AI:
1. Bạn nhập từ khóa → AI cào 50 Video YouTube viral nhất, tóm tắt qua NotebookLM để múc Insight.
2. AI áp dụng "Brand Voice" để viết 4 kiểu bài đăng chuyên biệt và sinh sẵn Hình ảnh minh hoạ (qua API tạo ảnh).
3. Hệ thống lưu kết quả vào Database và bắn thông báo tới Telegram của bạn kèm 3 nút: **[ Đăng ngay | Lên lịch | Bỏ qua ]**.
4. Bạn chạm nút `[ ✅ Đăng ngay ]`, một script chạy ngầm sẽ bật trình duyệt ảo giả lập (Puppeteer), tự động login vào Facebook Cá nhân của bạn, dán bài và post ảnh (chính xác như thao tác người thật).

Tóm lại: Máy móc làm 100% công sức tay chân. Bạn chỉ là người Sếp duyệt thành phẩm cuối.

### 🤔 Trả lời nhanh một số câu hỏi của anh em:
**1. Không có máy chủ (VPS) thì có chạy ngầm trên máy tính (Local) được không?**
→ **Hoàn toàn ĐƯỢC.** Các tệp mã nguồn dùng cơ chế Polling (liên tục quét Database). Anh em chỉ cần cài Node.js rồi treo màn hình đen trên máy tính cá nhân là chạy bình thường (không cần thiết lập mở Port mạng phức tạp).

**2. Tool này đang tự động Up Ảnh, tôi muốn nó tự động làm Video được không?**
→ Hệ thống của tôi tách làm 2 pha. Ở "Pha Đăng Bài", bộ giả lập Facebook hỗ trợ load MP4 một cách dễ dàng. Tuy nhiên, ở "Pha Sản xuất", mã nguồn tôi đang bọc để gọi API tạo Ảnh. Nếu anh em muốn tự động sinh Video AI, anh em sẽ cần biết một chút Code để thọc tay cài thêm API gọi các lõi Video (như Kling, Runway, Pika) vào thay thế phần Ảnh.

**3. Tải bộ Code này về tôi có tùy biến đem đi làm dịch vụ hay bán được không?**
→ **ĐƯỢC 100%.** Đây là Javascript mã nguồn mở. Anh em mang về tự do cấu trúc lại: Lắp thêm quy trình dịch thụât, up sang Instagram, clone ra làm hệ thống Fanpage hàng loạt...

### 💰 Chi phí & Công cụ để duy trì hệ thống:
Sự kinh khủng của hệ thống này là chi phí vận hành nền tảng siêu rẻ, gần bằng không:
- **Telegram Bot / API:** Miễn phí 100%.
- **Cơ sở dữ liệu (Supabase):** Dùng gói Free (lưu trữ văn bản dư sức cả năm).
- **Trí tuệ Nhân tạo:** Phân tích Insight qua NotebookLM (Google Free). Tiền gọi API để sinh chữ/ảnh cực kì rẻ (chỉ tính bằng cents).
- **Máy chủ đăng bài:** Treo miễn phí trên Laptop hoặc tậu Cloud VPS Ubuntu rẻ nhất (~100k/tháng) nuôi nó cày 24/7.
- **Session ID:** Vài dòng Cookie lấy từ trình duyệt Facebook của bạn.

*(Đặc biệt: Trong tệp ZIP tải về tôi đã tự soạn một "Cẩm nang hướng dẫn" dành cho Non-Tech. Bạn chỉ ném tệp đó cho con AI của bạn (VD: Cursor / Claude), nó sẽ đọc sơ đồ và Deploy setup thay bạn).*

Anh em Marketer, Quản lý doanh nghiệp nhỏ hay dân chơi Hệ thống nếu hứng thú với kiến trúc này thì chấm (.) hoặc để lại bình luận để mình inbox gửi thẳng link tải cục mã nguồn này về vọc vạch nhé!
