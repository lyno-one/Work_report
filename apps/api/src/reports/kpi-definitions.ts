export const KPI_DEFINITIONS = [
 ["marketing","video","Video đạt chuẩn","video"],["marketing","posts","Bài đăng","bài"],["marketing","leads","Khách hàng tiềm năng","khách"],
 ["sales","revenue","Doanh số","VNĐ"],["sales","orders","Đơn chốt","đơn"],["sales","customers","Khách được tư vấn","khách"],
 ["it","features","Chức năng hoàn thành","chức năng"],["it","bugs","Lỗi đã xử lý","lỗi"],["it","delivery","Bàn giao đúng hạn","hạng mục"],
 ["hr","candidates","Ứng viên đạt sàng lọc","người"],["hr","files","Hồ sơ xử lý","hồ sơ"],["hr","ontime","Việc hành chính đúng hạn","việc"],
 ["operations","processed","Đơn xử lý","đơn"],["operations","accurate","Đơn không lỗi","đơn"],["operations","inventory","Tồn kho đối soát","mục"],
 ["design","samples","Mẫu hoàn thiện","mẫu"],["design","approved","Mẫu được duyệt","mẫu"],["design","briefs","Brief đúng hạn","brief"]
].map(([departmentId,code,name,unit]) => ({departmentId,code,name,unit,direction:"forward" as const}));
