# Productivity Hub & Study Tracker ⚡

Hệ thống quản lý học tập, ghi chú, todo, lịch học và theo dõi tiến độ tự học với kiến trúc **Local-First (0ms)** & đồng bộ tự động lên **Google Sheets**.

## 1. Tính năng nổi bật
- **Siêu mượt (0ms delay)**: Bấm nút todo, lưu note, bấm giờ học phản hồi ngay lập tức trên giao diện và lưu vào `LocalStorage`.
- **Đồng bộ ngầm (Background Sync)**: Tự động gửi dữ liệu lên Google Sheets mà không làm giật lag giao diện.
- **Theo dõi tiến độ học tập**: Thống kê số giờ học trong ngày, tiến độ mục tiêu tháng, đếm giờ Pomodoro & Stopwatch.
- **Lịch học & Lịch rảnh**: Phân loại trực quan theo 7 ngày trong tuần.
- **Miễn phí 100%**: Lưu trữ trên Google Sheets và host web tĩnh miễn phí trọn đời trên GitHub Pages.

---

## 2. Cách đưa lên GitHub Pages (Host miễn phí)

### Cách A: Dùng giao diện web GitHub (Đơn giản nhất, không cần lệnh)
1. Đăng nhập vào [GitHub](https://github.com) và bấm nút **New Repository**.
2. Đặt tên repository: `productivity-hub` $\rightarrow$ Chọn **Public** $\rightarrow$ Bấm **Create repository**.
3. Tại trang repository vừa tạo, bấm **uploading an existing file**.
4. Kéo thả 3 file: `index.html`, `style.css`, `app.js` vào rồi bấm **Commit changes**.
5. Vào tab **Settings** của repository $\rightarrow$ Mục **Pages** ở cột trái.
6. Tại **Branch**, chọn nhánh `main` (hoặc `master`), thư mục `/ (root)` $\rightarrow$ Bấm **Save**.
7. Đợi 1 phút, GitHub sẽ cấp cho bạn một đường link web miễn phí: `https://<ten-user>.github.io/productivity-hub/`.

### Cách B: Dùng Git CLI
```bash
cd productivity-hub
git init
git add .
git commit -m "Initial productivity hub"
git branch -M main
git remote add origin https://github.com/<YOUR_USERNAME>/productivity-hub.git
git push -u origin main
```

---

## 3. Cách kết nối với Google Sheets

1. Mở trang web sau khi deploy (hoặc mở trực tiếp file `index.html` trên máy).
2. Bấm nút **⚙️ Cài đặt Sheet** ở góc trên bên phải.
3. Dán đường link **Web App URL** (lấy từ Google Apps Script, đuôi `/exec`) $\rightarrow$ Bấm **Lưu kết nối**.
4. Mọi thay đổi bạn thao tác trên web sẽ tự động ghi dòng vào Google Sheets!
