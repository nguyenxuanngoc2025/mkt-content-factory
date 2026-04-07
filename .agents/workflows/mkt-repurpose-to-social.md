---
description: Repurpose script/transcript thành bài viết Facebook, Instagram carousel, LinkedIn — review rồi đăng qua Blotato
argument-hint: [path to script or transcript file]
allowed-tools: Read, Write, Edit, Glob, Grep, Skill, Agent, Bash(mkdir:*)
---

# Repurpose Script to Social Posts

Nhận 1 file script/transcript tham khảo, repurpose thành content cho 3 nền tảng (Facebook, Instagram carousel, LinkedIn). User review xong thì đăng qua Blotato.

## Input

**Argument:** `$ARGUMENTS`

1. Nếu user truyền path cụ thể: đọc file đó
2. Nếu không truyền: hỏi user path đến file script/transcript

Đọc file input và xác nhận nội dung với user trước khi bắt đầu.

## Phase 0: Cấu hình Danh tính (Identity Setup)

1. Đọc file `projects/MKT_CONTENT_FACTORY/IDENTITY_CONFIG.json` để xác định:
   - Danh nhân xưng: `Tôi`
   - Chế độ: `Stealth Mode`
   - Các thực thể được phép nhắc tên: (dựa trên config)
2. Nếu không tìm thấy, mặc định dùng phong cách Chuyên gia, xưng "Tôi".

## Phase 1: Hỏi user chọn nền tảng

**TRƯỚC KHI làm bất cứ gì**, hỏi user:

```
Bạn muốn tạo content cho nền tảng nào?
1. Facebook
2. Instagram (carousel)
3. LinkedIn
4. Tất cả

Chọn số hoặc tên nền tảng (có thể chọn nhiều, ví dụ: 1,3)
```

Chỉ spawn sub-agents cho các nền tảng user đã chọn. Không tạo content cho nền tảng không được chọn.

## Output Structure

```
workspace/content/YYYY-MM-DD/social-posts/
├── <slug>-facebook.md
├── <slug>-ig-carousel.md
└── <slug>-linkedin.md
```

## Workflow

### Phase 2: Đọc và phân tích input

1. Đọc file script/transcript
2. Đọc brand voice: `MY RESOURCES/BRANDVOICE.MD`
3. Tạo folder output: `mkdir -p workspace/content/$(date +%Y-%m-%d)/social-posts`
4. Xác định slug từ tên file hoặc nội dung chính

### Phase 3: Tạo content cho 3 nền tảng (parallel sub-agents)

Spawn **3 sub-agents song song**, mỗi agent tạo content cho 1 nền tảng:

#### Agent 1: Facebook Post
Sử dụng skill `mkt-video-to-facebook-posts` hoặc `mkt-content-repurposer` để tạo Facebook post.

Prompt cho agent:
```
Đọc file script: <path>
Đọc brand voice: MY RESOURCES/BRANDVOICE.MD

Sử dụng bộ kỹ năng Marketing trong E:\ANTIGRAVITY\00_PLATFORM_DIEU_HANH\skills\skills để phân tích nội dung và tạo Facebook post.
Nếu nội dung không phải transcript video, hãy dùng skill mkt-content-repurposer với focus platform = Facebook.

Yêu cầu:
- Viết tiếng Việt có dấu
- Áp dụng brand voice (Tôi/Expert) từ IDENTITY_CONFIG.json
- Content phải copy-paste ready
- Lưu vào: workspace/content/<YYYY-MM-DD>/social-posts/<slug>-facebook.md
```

#### Agent 2: Instagram Carousel
Sử dụng skill `mkt-carousel-creator` để tạo carousel slides cho Instagram.

Prompt cho agent:
```
Đọc file script: <path>
Đọc brand voice: MY RESOURCES/BRANDVOICE.MD

Sử dụng skill mkt-carousel-creator để tạo Instagram carousel (mode: IG 1:1).
Input là nội dung từ script/transcript trên.

Yêu cầu:
- Write in ENGLISH (Instagram uses English for global audience)
- Tối thiểu 5 slides, tối đa 10 slides
- Mỗi slide có text + visual direction
- Lưu vào: workspace/content/<YYYY-MM-DD>/social-posts/<slug>-ig-carousel.md
```

#### Agent 3: LinkedIn Post
Sử dụng skill `mkt-linkedin-post-creator` để tạo LinkedIn post.

Prompt cho agent:
```
Đọc file script: <path>
Đọc brand voice: MY RESOURCES/BRANDVOICE.MD

Sử dụng skill mkt-linkedin-post-creator để tạo LinkedIn post từ nội dung script.

Yêu cầu:
- Write in ENGLISH (LinkedIn uses English for global audience)
- Professional tone phù hợp LinkedIn
- Áp dụng brand voice (Tôi/Expert) từ IDENTITY_CONFIG.json
- Content phải copy-paste ready
- Lưu vào: workspace/content/<YYYY-MM-DD>/social-posts/<slug>-linkedin.md
```

### Phase 4: Hiển thị kết quả để user review

Sau khi 3 agents hoàn thành, hiển thị cho user:

```
## Content đã tạo — sẵn sàng review

### 1. Facebook Post
📄 File: workspace/content/YYYY-MM-DD/social-posts/<slug>-facebook.md
<Hiển thị preview 5 dòng đầu>

### 2. Instagram Carousel
📄 File: workspace/content/YYYY-MM-DD/social-posts/<slug>-ig-carousel.md
<Hiển thị số slides và tiêu đề>

### 3. LinkedIn Post
📄 File: workspace/content/YYYY-MM-DD/social-posts/<slug>-linkedin.md
<Hiển thị preview 5 dòng đầu>

---
Hãy review các file trên. Khi sẵn sàng, cho tôi biết:
- Muốn chỉnh sửa bài nào?
- Muốn đăng lên nền tảng nào? (Facebook / Instagram / LinkedIn / tất cả)
```

### Phase 5: Publish (Blotato hoặc Telegram Delivery)

**KIỂM TRA MÔI TRƯỜNG:**
- Nếu `BLOTATO_API_KEY` tồn tại trong `.env` → Chạy **Flow A (Blotato Auto-post)**
- Nếu không → Chạy **Flow B (Telegram Delivery)**

**Flow A — Blotato Auto-post (khi có API key):**
Sử dụng Blotato MCP tools:
- `mcp__blotato__blotato_list_accounts` — lấy danh sách accounts đã kết nối
- `mcp__blotato__blotato_create_post` — tạo bài đăng
- `mcp__blotato__blotato_get_post_status` — kiểm tra trạng thái

**Flow B — Telegram Delivery (fallback khi chưa có Blotato):**
   **Phương án 2: Telegram Push (Manual Review & Copy-Paste)**
   - Sử dụng **NodeJS backend script** (`send_tele_unified.js`) để vòng qua firewall cục bộ của Windows (không dùng curl/PowerShell để gửi multipart file vì hay treo).
   - **Định dạng cấu trúc tin nhắn Telegram:**
     1. Chạy lệnh: `sendPhoto` (Gửi cover image, không dùng caption dài).
     2. Gõ lệnh: `sendMessage` (Gửi 100% full nội dung markdown ngay dưới ảnh, dùng `parse_mode: 'HTML'` để giữ format in đậm/nghiêng).
   - Báo cáo cho tôi qua Tele: "Tôi đã bắn {X} bài và {X} ảnh lên Tele cho đợt {tuần này}. Nội dung hiển thị dạng [Ảnh trên] -> [Bài full dưới]. Anh check và copy nhé!"

## Rules

- **PHẢI** đọc brand voice trước khi tạo content
- **PHẢI** viết tiếng Việt CÓ DẤU
- **PHẢI** hỏi user review trước khi đăng — KHÔNG tự động đăng
- **PHẢI** hỏi user chọn nền tảng cụ thể trước khi đăng
- **KHÔNG** đăng bài mà chưa được user xác nhận
- Content phải copy-paste ready — không placeholder, không TODO
- Nếu user muốn chỉnh sửa, chỉnh file rồi hiển thị lại để review
