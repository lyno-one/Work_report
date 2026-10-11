import { IsInt, MinLength, IsString, Max, MaxLength, Min } from "class-validator";

import { VersionDto } from "./create-report.dto";

export class ReviewReportDto extends VersionDto {
  @IsInt()
  @Min(0)
  @Max(40)
  result!: number;

  @IsInt()
  @Min(0)
  @Max(30)
  responsibility!: number;

  @IsInt()
  @Min(0)
  @Max(20)
  competency!: number;

  @IsInt()
  @Min(0)
  @Max(10)
  improvement!: number;

  @MinLength(1)
  @IsString()
  @MaxLength(1000)
  comment!: string;
}
