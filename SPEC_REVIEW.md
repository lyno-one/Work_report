# Đối chiếu đặc tả MVP v1.0

Nguồn: LYNO_ThienKhue_DacTaChucNang_WebBaoCao.docx, ngày 10/10/2026; tham khảo HTML cùng thư mục.

| Yêu cầu | Thay đổi / tình trạng |
|---|---|
| FR-01/02 | Dashboard/bộ lọc theo dữ liệu server và phạm vi tài khoản. Tỷ lệ hoàn thành = done / tổng task; điểm trung bình chỉ từ approved, có số mẫu. |
| FR-03/04/05 | Thêm đầu việc và đầy đủ thông tin kết quả, hạn, minh chứng; KPI theo phòng; vướng mắc, kế hoạch mai, tự đánh giá. |
| FR-06 | Nháp, gửi, khóa, mở lại, giữ dữ liệu khi restart. Trùng người/ngày trả 409. |
| FR-07 | 40/30/20/10, nhận xét và lý do mở lại bắt buộc; reviewer/time/review version được lưu; các phiên bản cũ không bị sửa. |
| FR-08 | Tổng hợp phòng ban, KPI riêng theo mã/đơn vị/phòng, vướng mắc và cảnh báo. |
| FR-09 | CSV BOM, xuất JSON/in; nhập nháp cá nhân nguyên tử. Sao lưu/phục hồi đầy đủ CSDL bằng SQLite, không phục hồi điểm duyệt qua JSON UI. |
| FR-10 | JWT/RBAC server, bốn vai trò; phiên 4 giờ; quyền cập nhật có hiệu lực ngay. Đã thêm đăng nhập CRM/Supabase theo tài khoản nguồn; kết nối production/SSO cần cấu hình. |
| FR-11 | SQLite dùng chung tại API, giao dịch ghi dữ liệu+audit; kiểm soát version trên thao tác thay đổi. |
| FR-12/13/14 | Chưa làm upload/quét tệp, nhắc nộp/email, xu hướng 7–30 ngày, quản trị cấu hình KPI/phòng ban. |
| TC-01…03 | Lưu nháp nhiều việc; gửi không task bị chặn; done cần 100% và actual output. |
| TC-04…08 | HTTPS hợp lệ; chặn vượt điểm/thiếu nhận xét; khóa sau duyệt; API ngoài quyền trả 403. |
| TC-09/10 | Tổng hợp thống nhất bộ lọc; version cũ trả 409. |
| TC-11 | CSV UTF-8 BOM; chống công thức trong dữ liệu CSV. |
| TC-12 và yêu cầu JSON | Kiểm tra quyền, cấu trúc/nested DTO và dữ liệu trước khi import; không nhập đè trạng thái đã gửi/duyệt; cập nhật nháp cần đúng version. |

Lệnh nghiệm thu: npm run typecheck, npm run build, npm run test:uat. Bộ test dùng CSDL riêng, bao gồm restart persistence. Không thay đổi tài liệu Word hoặc bản HTML bàn giao.

Chưa thể kết luận toàn bộ đặc tả production đã đạt: cần cấu hình tài khoản CRM thật, vận hành sao lưu hằng ngày, thông tin lịch nghỉ/ca, chính sách lưu dữ liệu và cấu hình hạ tầng. Nhân sự chưa có luồng yêu cầu mở lại tự động; hiện liên hệ quản lý để mở lại. Chưa quản trị nhân sự/phòng ban qua UI hoặc theo dõi hướng dẫn từng kỹ năng.

Cập nhật theo yêu cầu mới: lấy việc CRM được giao, nhập nội dung đã làm và dropdown % hoàn thành; dashboard Manager/CEO hiển thị nội dung và thanh tiến độ theo đúng % đã lưu. API không thay đổi trạng thái việc trên CRM.

## Kiểm tra lại API và đặc tả — 11/10/2026

Đã đọc lại tài liệu Word và chạy kiểm tra luồng báo cáo, xác thực CRM, phân quyền, BXH, dữ liệu sau restart và khôi phục sao lưu. CRM local /api/viec và /api/viec/lap-lai/tien-do nối theo hợp đồng hiện tại; lấy việc đúng tài khoản, việc lặp lại đúng ngày. Kiểm tra CRM thật dùng tài khoản test local và CSDL báo cáo tạm, không ghi task CRM. Việc lặp lại trong kiểm tra giả lập bao gồm đúng/sai người, sai ngày, đã xong và trùng ID; dữ liệu local hiện chưa cung cấp mẫu việc lặp lại để xác minh trực tiếp trường hợp đó.

Quyền quản lý là yêu cầu mới, thay cho quyền Admin chung: chỉ phiên CRM đang hoạt động có email luanduiga2605@gmail.com hoặc nguyenvanthanh1501bmt@gmail.com. GET /permissions, GET /users và PATCH /users/:id/role đều kiểm tra server; email ngoài danh sách và tài khoản demo trả 403. Giao diện dùng capability từ /auth/me và không tải API quản trị cho tài khoản không được cấp. Hồ sơ CRM được xác thực lại mỗi request nên đổi email/ngừng hoạt động mất quyền ngay. Chưa đăng nhập trực tiếp hai email thật (không có thông tin đăng nhập); kiểm tra hai danh tính này bằng CRM giả lập đúng hợp đồng.

Vai trò employee/manager CRM do CRM quyết định; thay ở báo cáo bị từ chối thay vì hiển thị thành công rồi bị CRM đồng bộ ghi đè. Admin CRM có thể được gán CEO tại báo cáo. Tài khoản demo không còn quản trị phân quyền.

Những khoảng trống còn lại:
- FR-04: KPI hiện gắn mã phòng seed (marketing/sales/...) trong khi CRM dùng UUID phòng; chưa có cấu hình ánh xạ chính thức nên tài khoản CRM có thể chưa thấy KPI đúng phòng. Chưa triển khai công thức KPI nghịch chiều.
- Mẫu số tổng nhân sự lấy từ người đã có trong CSDL báo cáo, chưa đồng bộ đầy đủ danh sách nhân viên CRM; chưa phù hợp dùng làm tỷ lệ nộp của toàn bộ CRM.
- FR-12/13/14: chưa upload/quét tệp, email/app nhắc nộp, lịch sử xu hướng 7–30 ngày, cấu hình KPI/phòng ban.
- SQLite lưu thực tế; kiến trúc PostgreSQL/MySQL, HTTPS, lịch sao lưu tự động và đo hiệu năng 100–300 người chưa được nghiệm thu.
- Việc thường CRM trả tối đa 100 việc mở; việc lặp lại phải được CRM sinh trước. Không ghi nội dung/% báo cáo ngược vào CRM.

Kết luận: các luồng đã triển khai được kiểm tra; chưa thể khẳng định toàn bộ đặc tả đã hoàn tất hoặc sẵn sàng production.

Bổ sung hai ô tải file minh chứng cho từng đầu việc: lưu cùng SQLite, xác thực tải xuống theo quyền báo cáo, kiểm tra tối đa 5 MB và định dạng PDF/PNG/JPEG/TXT; kiểm tra gắn file của người khác, khóa báo cáo đã duyệt, giữ file sau restart và phục hồi sao lưu. FR-12 đã có tải file/giới hạn/kiểm tra định dạng, chưa có quét antivirus. Các mô tả FR-12 chưa triển khai phía trên là tình trạng trước bổ sung này.

Bổ sung Cần trợ giúp: form Tiêu đề/Lời nhắn/Gửi; thông báo trong ứng dụng cho Manager cùng phòng và Admin, số chưa đọc, trạng thái đọc riêng từng người. Server lấy người/phòng từ phiên và chặn đọc thông báo ngoài quyền; tách nguồn CRM/demo. Thông báo lưu cùng SQLite và tồn tại qua restart/sao lưu. FR-13 hiện có thông báo trợ giúp trong ứng dụng; nhắc nộp tự động/email/push và xu hướng lịch sử vẫn chưa triển khai.

Đã bổ sung ánh xạ KPI phòng CRM theo tên phòng hoặc CRM_KPI_DEPARTMENT_MAP, giữ UUID phòng thật khi xác thực/lưu/tổng hợp. Kiểm tra thật trên CRM local Sale: KPI Doanh số mục tiêu 10, thực đạt 8, tổng phòng 80%. Kiểm tra giả lập thêm hai nhân viên 10/8 và 20/18 cho tổng 30/26 = 86,67%, phạm vi Manager/CEO và phòng chưa có ánh xạ. Nhận định KPI chưa ánh xạ ở trên là tình trạng trước bổ sung này. Bộ KPI vẫn là mẫu; chưa có quản trị cấu hình KPI hoặc công thức nghịch chiều.
