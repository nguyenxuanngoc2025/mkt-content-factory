const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());

const delay = ms => new Promise(res => setTimeout(res, ms));

/**
 * Tự động đăng nội dung lên Facebook cá nhân
 * @param {string} textToPost - Nội dung bài viết
 */
async function postToFacebook(textToPost, imagePath = null) {
    console.log(`[FB_POSTER] Đang bắt đầu đăng bài: "${textToPost.substring(0, 30)}..."`);
    // Chạy ẩn đi khi đã ổn định. Tạm thời để headless: false để debug nếu cần.
    // Nếu chạy trên background server/VPS thì nên để true hoặc 'new'
    const browser = await puppeteer.launch({
        headless: "new", // Để false để quan sát, sau này có thể để true
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-notifications', '--disable-gpu']
    });

    try {
        const page = await browser.newPage();
        
        // Đọc và set cookie để vác lên bất kỳ đâu
        const fs = require('fs');
        if (fs.existsSync('cookies.json')) {
            const cookiesString = fs.readFileSync('cookies.json');
            const cookies = JSON.parse(cookiesString);
            await page.setCookie(...cookies);
            console.log("[FB_POSTER] Đã Load Cookie vào trình duyệt ảo!");
        }

        // Set User-Agent to avoid mobile version or blocks
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 800 });

        console.log("[FB_POSTER] Truy cập trang chủ Facebook...");
        await page.goto('https://www.facebook.com/', { waitUntil: 'networkidle2' });

        // Chờ UI load xong
        await delay(3000);

        // Check đăng nhập
        if (page.url().includes('login')) {
            throw new Error("⚠️ Chưa đăng nhập hoặc bị check point. Vui lòng kiểm tra lại session.");
        }

        console.log("[FB_POSTER] Tìm trường 'Bạn đang nghĩ gì thế?'");
        const postBoxParams = [
            "div::-p-text(Bạn đang nghĩ gì thế)",
            "span::-p-text(Bạn đang nghĩ gì thế)",
            "::-p-xpath(//*[contains(translate(text(), 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', 'abcdefghijklmnopqrstuvwxyz'), 'bạn đang nghĩ gì thế')])",
            "div::-p-text(Bạn đang nghĩ gì)",
            "::-p-xpath(//*[contains(text(), 'Bạn đang nghĩ gì')])",
            "div::-p-text(What's on your mind)",
            "::-p-xpath(//*[contains(text(), \"What's on your mind\")])"
        ];

        let clickedPostBox = false;

        for (const selector of postBoxParams) {
            try {
                const elements = await page.$$(selector);
                if (elements.length > 0) {
                    await elements[0].click();
                    clickedPostBox = true;
                    break;
                }
            } catch (e) {}
        }
        
        if (!clickedPostBox) {
            throw new Error("❌ Không tìm thấy nút đăng bài. Có thể giao diện Facebook đã thay đổi.");
        }

        console.log("[FB_POSTER] Đã mở popup tạo bài viết, chờ textbox...");
        await delay(3000); // Chờ popup xuất hiện
        
        const contentEditableSelector = 'div[contenteditable="true"][role="textbox"]';
        await page.waitForSelector(contentEditableSelector, { timeout: 10000 });
        
        console.log("[FB_POSTER] Bắt đầu gõ phím...");
        
        // Dùng keyboard type để giả lập gõ phím mượt mà như người
        await page.type(contentEditableSelector, textToPost, { delay: 30 }); // 30ms cho mỗi phím

        if (imagePath && fs.existsSync(imagePath)) {
            console.log("[FB_POSTER] Đang đính kèm hình ảnh: " + imagePath);
            try {
                // Find all file inputs
                const fileInputs = await page.$$('input[type="file"]');
                if (fileInputs.length > 0) {
                    // Usually the first or last available input works, Facebook typically has one active.
                    // We upload to all hidden file inputs just to be safe, since they throw error if not active? No.
                    const fileInput = fileInputs[fileInputs.length - 1]; 
                    await fileInput.uploadFile(imagePath);
                    console.log("[FB_POSTER] Đã đính kèm ảnh!");
                    await delay(5000); // Chờ ảnh upload lên server
                } else {
                    console.log("[FB_POSTER] Không tìm thấy input upload ảnh.");
                }
            } catch(e) {
                console.log("[FB_POSTER] Lỗi khi upload ảnh:", e.message);
            }
        }

        console.log("[FB_POSTER] Gõ xong nội dung. Đang tìm nút Đăng...");
        await delay(2000);

        const postBtns = [
            "::-p-xpath(//div[@aria-label='Post' or @aria-label='Đăng'][@role='button'])",
            "::-p-xpath(//span[contains(text(), 'Đăng') or contains(text(), 'Post')]/ancestor::div[@role='button'])"
        ];

        let foundPostBtn = false;
        for (const btnSelector of postBtns) {
            const btns = await page.$$(btnSelector);
            if (btns.length > 0) {
                foundPostBtn = true;
                
                // CLICK ĐĂNG BÀI
                // Để test an toàn, nếu muốn đăng thật cứ un-comment dòng click:
                await page.screenshot({path: 'debug_before_click.png'});
                await btns[0].click(); 
                console.log("[FB_POSTER] ĐÃ CLICK ĐĂNG BÀI!");
                
                // Chờ Facebook upload bài viết (10s)
                await delay(10000);
                await page.screenshot({path: 'debug_after_click.png'});
                break;
            }
        }

        if (!foundPostBtn) {
            await page.screenshot({path: 'debug_no_btn.png'});
            throw new Error("❌ Không tìm thấy nút Đăng bài.");
        }

        console.log("[FB_POSTER] Đăng bài hoàn tất!");
        return true;

    } catch (e) {
        console.error("[FB_POSTER] LỖI:", e.message);
        throw e;
    } finally {
        await browser.close();
    }
}

module.exports = { postToFacebook };
