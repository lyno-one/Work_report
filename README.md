# LYNO Báo cáo công việc — demo phân quyền

Demo độc lập dựa trên HTML và đặc tả do PM bàn giao. Ứng dụng dùng Next.js cho giao diện và NestJS cho API. Trọng tâm của bản demo là đăng nhập mẫu, ma trận RBAC và kiểm tra quyền/phạm vi dữ liệu ở máy chủ.

## Chạy local

Yêu cầu Node.js 20+ và npm.

```bash
npm install
npm run dev
```

- Web: http://localhost:3000
- API: http://localhost:4000/api

Tài khoản dùng thử:

| Vai trò | Email | Mật khẩu |
|---|---|---|
| Admin | `admin@lyno.demo` | `LynoDemo2026!` |
| Manager | `manager@lyno.demo` | `LynoDemo2026!` |
| Employee | `employee@lyno.demo` | `LynoDemo2026!` |

Các tài khoản demo bổ sung: `lien@lyno.demo` (Manager, Sale/CSKH), `thao@lyno.demo` (Employee, Hành chính/HR), cùng mật khẩu demo.

## Phạm vi quyền trong demo

- **Admin:** xem báo cáo toàn công ty, duyệt báo cáo, xem danh sách nhân sự và thay đổi vai trò.
- **Manager:** xem báo cáo và duyệt báo cáo đã gửi trong phòng ban được gán; không được quản lý vai trò.
- **Employee:** chỉ xem báo cáo của mình, tạo/gửi báo cáo; không được duyệt hoặc thay đổi vai trò.
- Admin/Manager chấm điểm theo nhóm trọng số `40–30–20–10` trước khi duyệt; Manager chỉ duyệt báo cáo cùng phòng ban.
- Phần **Phân quyền** hiển thị ma trận cho cả ba vai trò. API từ chối truy cập trái quyền và tự giới hạn dữ liệu trả về theo người dùng/phòng ban.

API phát hành access token ký bởi NestJS. Token chỉ mang định danh người dùng; vai trò và phạm vi được đọc lại từ nguồn dữ liệu ở server cho từng request, nên thao tác đổi quyền của Admin có hiệu lực ngay. Admin không thể tự gửi báo cáo trừ khi có cơ chế ủy quyền riêng (chưa nằm trong demo).

## Lệnh kiểm tra

```bash
npm run typecheck
npm run build
```

## Giới hạn bản demo

Dữ liệu người dùng và báo cáo hiện được seed trong bộ nhớ để demo luồng; dữ liệu mới và thay đổi vai trò sẽ trở về mặc định khi khởi động lại API. Mật khẩu demo giống nhau cho các tài khoản. Cần thay bằng cơ sở dữ liệu dùng chung, quản lý mật khẩu an toàn, nhật ký audit, chính sách phiên và cấu hình production trước khi sử dụng thật. Không dùng dữ liệu nhân sự nhạy cảm trong bản demo này.
