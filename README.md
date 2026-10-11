# LYNO × Thiên Khuê — Báo cáo công việc

Next.js cho giao diện, NestJS cho API, SQLite cho báo cáo, người dùng và nhật ký thay đổi. Các thay đổi được đối chiếu với đặc tả MVP v1.0 và HTML bàn giao trong thư mục gốc.

## Chạy local

Yêu cầu Node.js **22.13+** (có `node:sqlite`) và npm.

```bash
npm install
npm run dev
```

Web: http://localhost:3000 · API: http://localhost:4000/api

Mật khẩu dùng thử: `LynoDemo2026!`.

| Vai trò | Email | Phạm vi |
|---|---|---|
| CEO | ceo@lyno.demo | Toàn công ty, duyệt và mở lại |
| Admin | admin@lyno.demo | Toàn công ty, quản lý vai trò |
| Trưởng phòng | manager@lyno.demo | Marketing |
| Nhân sự | employee@lyno.demo | Báo cáo của mình |
| Trưởng phòng | lien@lyno.demo | Sale/CSKH |
| Nhân sự | thao@lyno.demo | Hành chính/HR |

Chọn ngày **10/10/2026** để xem báo cáo mẫu. Ngày mặc định của ứng dụng theo Asia/Ho_Chi_Minh.

## Đã triển khai

- Dashboard theo ngày/phòng: đã nộp/tổng nhân sự, tổng đầu việc, hoàn thành, chậm/quá hạn, tỷ lệ theo số task, điểm trung bình từ báo cáo đã duyệt và số mẫu.
- Báo cáo nhiều đầu việc: đầu ra kỳ vọng, kết quả, ưu tiên, hạn, tiến độ, trạng thái, HTTPS minh chứng, ghi chú; thêm/xóa dòng và chuyển việc tồn từ ngày trước.
- KPI theo phòng, mục tiêu/thực đạt, tính tỷ lệ tại server; mục tiêu 0 trả null. Vướng mắc, hỗ trợ, kế hoạch tối đa 3 dòng, tự đánh giá, tập trung, thái độ và bài học.
- Lưu/sửa nháp, gửi, duyệt, mở lại; khóa báo cáo đã gửi/duyệt; mở lại cần lý do; giữ các phiên bản đánh giá cũ.
- Kiểm tra điểm 40/30/20/10, nhận xét bắt buộc, kiểm tra quyền tại server và ngăn tự duyệt.
- Unique người/ngày, kiểm tra dữ liệu, trả 409 khi phiên bản cũ; thời gian do server cấp.
- Tổng hợp phòng ban, KPI cùng mã/đơn vị/phòng, vướng mắc và cảnh báo quá hạn/thiếu minh chứng.
- Xuất CSV UTF-8 BOM, JSON theo bộ lọc/phạm vi; in chi tiết; nhập **bản nháp của chính mình** qua JSON, kiểm tra toàn bộ trước khi ghi trong một giao dịch.
- JWT và phân quyền employee/manager/ceo/admin; quyền được đọc lại ở mỗi request.
- SQLite lưu bền báo cáo, vai trò, các phiên bản duyệt và audit; dữ liệu không mất khi khởi động lại.

## API

`/reports` và `/daily-reports` đều hỗ trợ danh sách/chi tiết, tạo, PUT cập nhật, submit, approve, reopen và history. Bộ lọc: `date`, `department_id`, `search` (tên hoặc mã nhân sự).

API bổ sung: `GET /me`, `GET /dashboard/overview`, `GET /kpi-definitions`, `GET /reports/export?format=csv|json`, `POST /reports/import`.

Cập nhật/gửi/duyệt/mở lại phải gửi `version` hiện tại. Server từ chối trường dư, quyền ngoài phạm vi và ghi đè báo cáo đã khóa. Admin/CEO chưa được ủy quyền tạo báo cáo thay người khác.

## Kiểm tra

```bash
npm run typecheck
npm run build
npm run test:uat
```

UAT tự mở API ở port riêng và tạo CSDL trong thư mục tạm; kiểm tra RBAC, dữ liệu không hợp lệ, trùng ngày, chu trình báo cáo, xung đột, audit, import nguyên tử và lưu dữ liệu sau khởi động lại. Không sửa CSDL ứng dụng đang chạy. Bộ UAT còn kiểm tra phục hồi từ bản sao SQLite.

Kiểm tra trình duyệt: sau build, chạy npm run test:browser (Windows có Microsoft Edge). Test dùng API/CSDL/port riêng; ảnh desktop 1366px và mobile 390px lưu ở artifacts/.

## Lưu trữ và sao lưu

Khi chạy `npm run dev`, CSDL mặc định là `apps/api/data/lyno.sqlite`. Biến `DATABASE_PATH` đổi vị trí CSDL; đường dẫn tương đối được tính từ thư mục chạy API. API tự nạp .env.local/.env trong thư mục chạy API; biến môi trường của tiến trình được ưu tiên. Xem `apps/api/.env.example`.

```bash
npm run backup
```

Lệnh tạo bản sao SQLite nhất quán bằng VACUUM INTO, gồm người dùng, báo cáo và audit, ở thư mục backups cạnh CSDL. Có thể cấu hình DATABASE_PATH/BACKUP_DIR. Để phục hồi: dừng API, giữ bản sao CSDL hiện tại, đặt bản sao lưu ở đường dẫn mới và cấp DATABASE_PATH trỏ tới đó, rồi chạy lại API. Không chỉ chép file .sqlite đang ghi vì SQLite dùng WAL.

JSON xuất từ giao diện là dữ liệu theo bộ lọc/quyền, **không phải bản sao toàn bộ CSDL**. Import JSON không được thay điểm hoặc lịch sử duyệt; phục hồi đầy đủ bằng bản sao SQLite.

## Phần cần hoàn thiện trước production

Đăng nhập demo bị tắt khi NODE_ENV=production. Đăng nhập tài khoản CRM/Supabase đã có khi cấu hình kết nối. Khi vận hành thật cần HTTPS, JWT secret, chính sách phiên/lưu dữ liệu, sao lưu định kỳ và kiểm thử phục hồi.

P1 chưa triển khai: upload/quét tệp, email/app nhắc nộp và xu hướng 7–30 ngày, quản trị KPI/phòng ban, KPI nghịch chiều có công thức được chốt. Chưa có lịch nghỉ/ca để tính nộp muộn, ủy quyền gửi thay, hoặc nhật ký đào tạo theo mã kỹ năng. KPI seed hiện đều thuận chiều; không áp dụng công thức Actual/Target cho chỉ số nghịch chiều.

SQLite phù hợp chạy một API trên một máy với lưu trữ bền; khi mở nhiều instance cần chuyển sang PostgreSQL/MySQL và cơ chế đồng bộ phù hợp. Xem [đối chiếu đặc tả](SPEC_REVIEW.md).


## Việc từ CRM và tiến độ nhân viên

Cấu hình apps/api/.env.local (không commit):

```dotenv
CRM_API_URL=http://localhost:3220/api
CRM_SUPABASE_URL=http://127.0.0.1:54321
CRM_SUPABASE_ANON_KEY=<anon key của đúng Supabase>
```

Dùng ANON key, không dùng service-role key. API CRM và Supabase phải thuộc cùng môi trường. Khởi động lại API sau khi cấu hình.

Khi kết nối được cấu hình, màn hình đăng nhập có lựa chọn CRM. Nhập email/mật khẩu CRM; server xác thực qua Supabase và đọc hồ sơ từ GET /api/auth/me. Token CRM/refresh token chỉ giữ ở bộ nhớ server, không trả ra trình duyệt hoặc ghi vào CSDL. Sau khi restart API, tài khoản CRM cần đăng nhập lại. Vai trò/phòng của tài khoản CRM được kiểm lại từ CRM mỗi request; role CEO tại báo cáo chỉ giữ khi tài khoản nguồn vẫn là admin CRM.

Nhấn Tạo báo cáo: tự lấy GET /api/viec, chỉ chọn việc đang mở có giao_cho = ID CRM của người đăng nhập. Không lấy việc của người khác hoặc việc nhóm chưa nhận. CRM trả tối đa 100 việc mở; để xử lý việc bị giới hạn cần mở rộng API CRM/phân trang. GET /reports/crm-tasks cũng hỗ trợ tải lại; việc trùng được gộp theo crmTaskId, giữ nội dung và tiến độ đã nhập.

Mỗi đầu việc có textarea “Nội dung việc đã làm” (tối đa 2.000 ký tự) và dropdown 0%, 10%, …, 100%. Báo cáo cũ có giá trị khác vẫn giữ được. Chọn 100% chuyển trạng thái sang done, cần nội dung kết quả; giảm % từ done chuyển về in_progress. % này là tiến độ do nhân viên báo cáo, không tự ghi trạng thái ngược về CRM.

Dashboard Manager/CEO có từng thẻ việc: tên nhân viên, tên việc, nội dung đã làm và progress bar dùng đúng số % được lưu. Bộ lọc ngày/phòng/tên và phạm vi quyền áp dụng cho cả các thẻ này. Chỉ số tỷ lệ task hoàn thành trên dashboard vẫn là done/tổng task theo đặc tả; thanh tiến độ từng việc dùng phần trăm nhân viên chọn.

Kiểm tra: npm run test:crm dùng CRM/Supabase giả lập theo hợp đồng thật và CSDL riêng; không gọi hoặc ghi dữ liệu CRM thật. Test trình duyệt kiểm tra nội dung + thanh 50% ở Manager/CEO và dropdown của nhân viên.

Việc lặp lại: GET /api/viec/lap-lai/tien-do?ngay=YYYY-MM-DD được lấy cùng việc thường. Chỉ lấy bản thực hiện có nguoi_id khớp nhân viên và ngay khớp ngày báo cáo, kể cả bản đã hoàn thành; hiển thị nhãn CRM · Lặp lại. CRM cần sinh bản thực hiện theo lịch trước; ứng dụng báo cáo chỉ đọc, không tự sinh hoặc cập nhật việc trên CRM. Nội dung và % do nhân viên nhập ở báo cáo. Mỗi bản thực hiện chỉ thêm một lần và không được chuyển sang ngày báo cáo khác.

## Bảng xếp hạng

Menu Bảng xếp hạng dành cho người đã đăng nhập: chọn toàn công ty/phòng ban, tháng và xếp theo điểm tháng/năm. GET /api/leaderboard?month=YYYY-MM&department_id=... chỉ trả danh tính hiển thị và điểm tổng hợp, không mở quyền đọc báo cáo người khác. Tổng là điểm các báo cáo đang ở trạng thái approved, tính theo ngày báo cáo (không phải ngày duyệt); chưa duyệt/mở lại không tính, duyệt lại thay điểm cũ. Điểm 0 vẫn là báo cáo hợp lệ, bằng điểm cùng hạng. Phạm vi phòng dùng phòng lưu trên báo cáo tại thời điểm tạo. Sang tháng mới tự chọn tháng mới theo giờ Việt Nam khi xem tháng hiện tại; tổng năm vẫn giữ các tháng cùng năm. Có thể chọn tháng/năm cũ; không xóa dữ liệu khi chuyển tháng hoặc năm. Giao diện tải lại mỗi phút và có nút Làm mới.

Quản lý phân quyền chỉ dành cho phiên CRM có email luanduiga2605@gmail.com hoặc nguyenvanthanh1501bmt@gmail.com; tài khoản demo và CRM khác không truy cập được API quản trị. Vai trò nhân viên/quản lý CRM thay tại CRM; ứng dụng báo cáo chỉ hỗ trợ gán CEO cho admin CRM. Xem kết quả kiểm tra và các phần đặc tả chưa hoàn tất trong SPEC_REVIEW.md.

## File minh chứng

Mỗi đầu việc có hai ô file độc lập; tải lên rồi lưu/gửi báo cáo để gắn file. Hỗ trợ PDF, PNG, JPG/JPEG, TXT, tối đa 5 MB/file. Server kiểm tra đuôi, MIME, chữ ký định dạng; đây không phải quét antivirus. POST /api/attachments dùng multipart field file; GET /api/attachments/:id/info đọc metadata; GET /api/attachments/:id tải file có JWT, không có URL công khai. Chủ file hoặc người có quyền xem báo cáo chứa file mới được tải. Báo cáo đã gửi/duyệt không thay file cho đến khi được mở lại. File và metadata lưu trong SQLite, đi cùng sao lưu/phục hồi CSDL; file đã gỡ khỏi báo cáo vẫn giữ phục vụ lịch sử, chưa có chính sách tự dọn file chưa gắn. JSON xuất báo cáo chứa ID tham chiếu, không chứa nội dung file; sao lưu đầy đủ bằng SQLite.

## Cần trợ giúp và thông báo

Nhấn Cần trợ giúp để nhập Tiêu đề (120 ký tự), Lời nhắn (2.000 ký tự) và Gửi. POST /api/support/requests lấy danh tính/phòng từ phiên đăng nhập. Manager hiện tại của phòng và Admin thấy yêu cầu trong Thông báo trợ giúp; giao diện kiểm tra thông báo mỗi 15 giây, có số chưa đọc và nút đánh dấu đã đọc. GET /api/support/notifications và POST /api/support/notifications/:id/read kiểm tra vai trò/phòng trên server; trạng thái đọc riêng cho từng người. Dữ liệu lưu cùng SQLite và được sao lưu/phục hồi cùng CSDL. Yêu cầu CRM chỉ hiện cho tài khoản CRM; yêu cầu demo chỉ hiện cho tài khoản demo. Quyền nhận dùng hồ sơ hiện tại nên Manager/Admin chưa từng đăng nhập cũng thấy yêu cầu phù hợp sau khi đăng nhập. Thông báo trong ứng dụng, chưa gửi email hoặc push ngoài ứng dụng.

## KPI theo phòng CRM

KPI được ánh xạ từ tên phòng CRM (Marketing, Sale/Sales/CSKH, IT, HR/Hành chính/Nhân sự, Kho/Vận hành, Thiết kế) sang bộ chỉ số mẫu, nhưng lưu và lọc bằng UUID phòng thật. Không khớp tên thì không tự gán KPI; có thể cấu hình CRM_KPI_DEPARTMENT_MAP bằng JSON UUID -> marketing/sales/it/hr/operations/design và restart API. Tên phòng được đồng bộ khi đăng nhập CRM; đổi phòng cần đăng nhập lại để cập nhật tên phòng. Phòng đã đồng bộ được lưu để tổng hợp cả dữ liệu lịch sử. KPI phòng = tổng thực đạt/tổng mục tiêu*100, cùng mã chỉ số trong cùng UUID phòng; mục tiêu 0 hiển thị —. Vẫn tính theo bộ lọc và cả nháp/gửi/duyệt như luồng hiện tại; KPI không tự cộng vào BXH.
