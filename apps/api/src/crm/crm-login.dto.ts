import { IsEmail, IsString, MinLength } from "class-validator";
export class CrmLoginDto {
 @IsEmail() email!:string;
 @IsString() @MinLength(1) password!:string;
}
