export type ReportStatus = "draft" | "submitted" | "approved" | "reopened";
export interface ReportTask { evidenceFiles?:string[]; crmTaskId?:string; title: string; expectedOutput: string; actualOutput: string; priority: "high" | "medium" | "low"; dueDate: string; progress: number; status: "done" | "in_progress" | "late" | "overdue"; evidenceUrl: string; note: string; }
export interface ReportKpi { code: string; target: number; actual: number; resultPercent?: number | null; }
export interface Review { result: number; responsibility: number; competency: number; improvement: number; comment: string; reviewerId: string; reviewedAt: string; version: number; }
export interface WorkReport {
 employeeCode?: string; jobTitle?: string;
 id: string; authorId: string; authorName: string; departmentId: string; department: string; date: string; title: string; summary: string; status: ReportStatus; score: number | null; reviewer: string | null;
 tasks: ReportTask[]; kpis: ReportKpi[]; blockerType: string; blockerText: string; supportRequest: string; tomorrowPlan: string; selfScore: number; focus: string; attitude: string; lesson: string;
 version: number; createdAt: string; updatedAt: string; submittedAt: string | null; approvedAt: string | null; reviews: Review[];
}
