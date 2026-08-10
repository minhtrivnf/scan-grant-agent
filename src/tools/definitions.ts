import { z } from "zod";

export const logScanExcelSchema = z.object({
  entry: z.object({
    ten_chuong_trinh: z.string().describe("Tên chương trình grant cần ghi log."),
    loai: z.string().optional().describe("Loại chương trình (grant/competition/accelerator)."),
    quy_mo: z.string().optional().describe("Quy mô chương trình."),
    don_vi_to_chuc: z.string().optional().describe("Đơn vị tổ chức."),
    muc_do_uu_tien: z.string().optional().describe("Mức độ ưu tiên."),
    status: z.string().optional().describe("Trạng thái (đang mở / sắp mở / đã đóng)."),
    mo_dk: z.string().optional().describe("Ngày mở đăng ký (dd/mm/yyyy)."),
    dong_dk: z.string().optional().describe("Ngày đóng đăng ký (dd/mm/yyyy)."),
    chung_ket: z.string().optional().describe("Ngày chung kết (dd/mm/yyyy)."),
    dia_diem: z.string().optional().describe("Địa điểm."),
    thuong_ty_vnd: z.union([z.string(), z.number()]).optional().describe("Thưởng tỷ VND."),
    co_cau_giai: z.string().optional().describe("Cơ cấu giải."),
    linh_vuc_retriv: z.string().optional().describe("Lĩnh vực RetriV."),
    linh_vuc_vnf: z.string().optional().describe("Lĩnh vực VNF."),
    noi_dung_khac: z.string().optional().describe("Nội dung khác."),
    retriv_dang_ky: z.string().optional().describe("RetriV đăng ký."),
    retriv_ket_qua: z.string().optional().describe("RetriV kết quả."),
    vnf_dang_ky: z.string().optional().describe("VNF đăng ký."),
    vnf_ket_qua: z.string().optional().describe("VNF kết quả."),
    challenge_phu_hop_nhat: z.string().optional().describe("Challenge phù hợp nhất."),
    quan_quan: z.string().optional().describe("Quán quân."),
    de_xuat: z.string().describe("Đề xuất: GO / MAYBE / SKIP."),
    watchlist: z.boolean().optional().describe("Có theo dõi vòng sau không."),
    ly_do: z.string().optional().describe("Lý do nếu MAYBE/SKIP (bắt buộc)."),
    owner_follow_up: z.string().optional().describe("Owner follow-up nếu MAYBE/SKIP (bắt buộc)."),
    ghi_chu_1: z.string().optional().describe("Ghi chú 1."),
    ghi_chu_2: z.string().optional().describe("Ghi chú 2."),
    ref: z.string().optional().describe("Link nguồn."),
    link_bao_cao: z.string().optional().describe("Đường dẫn file báo cáo Word."),
    retriv_scores: z.record(z.string(), z.union([z.string(), z.number()])).optional().describe("Điểm RetriV: khop_linh_vuc, doi_moi, tac_dong_mt, tiem_nang_qt, dat_giai."),
    vnf_scores: z.record(z.string(), z.union([z.string(), z.number()])).optional().describe("Điểm VNF: khop_linh_vuc, doi_moi, tac_dong_mt, tiem_nang_qt, dat_giai."),
  }).describe("Dữ liệu một dòng grant cần append vào Excel log."),
  output: z.string().describe("Đường dẫn file Excel log đầu ra (ví dụ: output/Grant_Scan_Tracker_RetriV_VNF.xlsx)."),
  today: z.string().optional().describe("Ngày chạy dạng dd/mm/yyyy, mặc định là hôm nay."),
});

export const marketScanExcelSchema = z.object({
  payload: z.object({
    chu_de: z.string().optional().describe("Chủ đề tìm kiếm."),
    nguon_chu_de: z.string().optional().describe("Nguồn chủ đề (User cung cấp / Mặc định theo hồ sơ)."),
    ngay_scan: z.string().optional().describe("Ngày scan dd/mm/yyyy."),
    candidates: z.array(
      z.object({
        ten_chuong_trinh: z.string().describe("Tên chương trình."),
        nha_tai_tro: z.string().optional().describe("Nhà tài trợ."),
        linh_vuc: z.string().optional().describe("Lĩnh vực."),
        funding: z.string().optional().describe("Funding/award."),
        deadline: z.string().optional().describe("Deadline (dd/mm/yyyy hoặc Rolling / Chưa rõ)."),
        geography: z.string().optional().describe("Geography."),
        eligibility_retriv: z.string().optional().describe("Eligibility sơ bộ RetriV: Có thể / Không / Chưa rõ."),
        eligibility_vnf: z.string().optional().describe("Eligibility sơ bộ VNF: Có thể / Không / Chưa rõ."),
        website: z.string().optional().describe("Website."),
        nguon_tim_thay: z.string().optional().describe("Nguồn tìm thấy."),
        da_deep_scan: z.boolean().optional().describe("Đã deep-scan chưa."),
        ghi_chu: z.string().optional().describe("Ghi chú."),
      })
    ).describe("Danh sách candidate tìm được."),
  }).describe("Payload Market Scan."),
  output: z.string().describe("Đường dẫn file Excel Market Scan đầu ra."),
  today: z.string().optional().describe("Ngày scan dd/mm/yyyy."),
});

export const qaCheckSchema = z.object({
  reports: z.array(z.string()).optional().describe("Các đường dẫn file báo cáo Word cần QA."),
  excel: z.string().optional().describe("Đường dẫn file Excel log chính."),
  marketExcel: z.string().optional().describe("Đường dẫn file Excel Market Scan (nếu có)."),
}).describe("Kiểm tra QA sau khi tạo báo cáo và Excel log.");

export type LogScanExcelInput = z.infer<typeof logScanExcelSchema>;
export type MarketScanExcelInput = z.infer<typeof marketScanExcelSchema>;
export type QACheckInput = z.infer<typeof qaCheckSchema>;

export const TOOL_DEFINITIONS = {
  log_scan_excel: {
    name: "log_scan_excel",
    description: "Ghi 1 dòng grant vào file Excel log chung (6 sheet: Dashboard, Database, Deadlines, Scoring, Links & Notes, AI Automation Guide). Chấm điểm song song RetriV & VNF. BẮT BUỘC điền ly_do và owner_follow_up khi de_xuat là MAYBE hoặc SKIP.",
    schema: logScanExcelSchema,
  },
  market_scan_excel: {
    name: "market_scan_excel",
    description: "Xuất Excel A — danh sách toàn bộ candidate tìm được trong Market Scan (Chế độ B), kèm eligibility sơ bộ RetriV/VNF. File độc lập với Excel log chính.",
    schema: marketScanExcelSchema,
  },
  qa_check: {
    name: "qa_check",
    description: "Chạy QA bắt buộc sau khi tạo báo cáo Word và Excel log: kiểm tra logo nhúng, TOC field, đủ 8 mục nội dung, đủ 6 sheet, điền Lý do/Owner/Link đầy đủ. Trả về PASS/FAIL.",
    schema: qaCheckSchema,
  },
} as const;
