import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsNumber, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
export class TaskDto {
 @IsOptional() @IsArray() @ArrayMaxSize(2) @IsString({each:true}) @MaxLength(36,{each:true}) evidenceFiles?:string[];
 @IsOptional() @IsString() @MinLength(1) @MaxLength(100) crmTaskId?:string;
 @IsString() @MinLength(1) @MaxLength(130) title!: string;
 @IsString() @MinLength(1) @MaxLength(160) expectedOutput!: string;
 @IsString() @MaxLength(2000) actualOutput!: string;
 @IsIn(["high","medium","low"]) priority!: "high" | "medium" | "low";
 @Matches(/^\d{4}-\d{2}-\d{2}$/) dueDate!: string;
 @IsNumber() @Min(0) @Max(100) progress!: number;
 @IsIn(["done","in_progress","late","overdue"]) status!: "done" | "in_progress" | "late" | "overdue";
 @IsString() @MaxLength(1000) evidenceUrl!: string;
 @IsString() @MaxLength(240) note!: string;
}
export class KpiDto {
 @IsString() @MinLength(1) @MaxLength(80) code!: string;
 @IsNumber() @Min(0) target!: number;
 @IsNumber() @Min(0) actual!: number;
}
export class CreateReportDto {
 @Matches(/^\d{4}-\d{2}-\d{2}$/) date!: string;
 @IsString() @MinLength(1) @MaxLength(120) title!: string;
 @IsString() @MaxLength(1000) summary!: string;
 @IsIn(["draft","submitted"]) status!: "draft" | "submitted";
 @IsArray() @ArrayMaxSize(100) @ValidateNested({each:true}) @Type(() => TaskDto) tasks!: TaskDto[];
 @IsArray() @ArrayMaxSize(50) @ValidateNested({each:true}) @Type(() => KpiDto) kpis!: KpiDto[];
 @IsIn(["none","skill","information","tools","dependency","process","other"]) blockerType!: string;
 @IsString() @MaxLength(600) blockerText!: string;
 @IsString() @MaxLength(600) supportRequest!: string;
 @IsString() @MaxLength(1200) tomorrowPlan!: string;
 @IsInt() @Min(0) @Max(100) selfScore!: number;
 @IsIn(["Tốt","Trung bình","Cần cải thiện"]) focus!: string;
 @IsIn(["Chủ động","Bình thường","Bị động"]) attitude!: string;
 @IsString() @MaxLength(600) lesson!: string;
 @IsOptional() @IsInt() @Min(1) version?: number;
}
export class VersionDto { @IsInt() @Min(1) version!: number; }
export class ReopenReportDto extends VersionDto { @IsString() @MinLength(1) @MaxLength(600) reason!: string; }

export class ImportEntryDto extends CreateReportDto { @IsOptional() @IsString() authorId?: string; }
export class ImportReportsDto { @IsArray() @ArrayMaxSize(300) @ValidateNested({each:true}) @Type(() => ImportEntryDto) reports!: ImportEntryDto[]; }
