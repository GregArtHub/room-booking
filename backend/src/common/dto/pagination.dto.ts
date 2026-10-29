import { Transform, Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'page должен быть целым числом' })
  @Min(1, { message: 'page должен быть не меньше 1' })
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'limit должен быть целым числом' })
  @Min(1, { message: 'limit должен быть не меньше 1' })
  @Max(100, { message: 'limit должен быть не больше 100' })
  limit: number = 10;
}

export class SortablePaginationQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  sort?: string;
}

/** 'true' / 'false' из query-строки -> boolean. */
export const ToBoolean = () =>
  Transform(({ value }) => {
    if (value === true || value === 'true') return true;
    if (value === false || value === 'false') return false;
    return undefined;
  });
