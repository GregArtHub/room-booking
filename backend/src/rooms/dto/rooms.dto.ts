import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { SortablePaginationQueryDto, ToBoolean } from '../../common/dto/pagination.dto';

export class RoomsQueryDto extends SortablePaginationQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  minCapacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  floor?: number;

  /** id удобств через запятую: "1,3" */
  @IsOptional()
  @IsString()
  amenities?: string;

  @IsOptional()
  @ToBoolean()
  @IsBoolean()
  includeInactive?: boolean;
}

export class CreateRoomDto {
  @IsString({ message: 'Название обязательно' })
  @MinLength(2, { message: 'Название должно быть не короче 2 символов' })
  @MaxLength(100, { message: 'Название должно быть не длиннее 100 символов' })
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Описание должно быть не длиннее 1000 символов' })
  description?: string;

  @Type(() => Number)
  @IsInt({ message: 'Вместимость должна быть целым числом' })
  @Min(1, { message: 'Вместимость должна быть не меньше 1' })
  @Max(200, { message: 'Вместимость должна быть не больше 200' })
  capacity: number;

  @Type(() => Number)
  @IsInt({ message: 'Этаж должен быть целым числом' })
  floor: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  amenityIds?: number[];
}

export class UpdateRoomDto {
  @IsOptional()
  @IsString()
  @MinLength(2, { message: 'Название должно быть не короче 2 символов' })
  @MaxLength(100, { message: 'Название должно быть не длиннее 100 символов' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(1000, { message: 'Описание должно быть не длиннее 1000 символов' })
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Вместимость должна быть целым числом' })
  @Min(1, { message: 'Вместимость должна быть не меньше 1' })
  @Max(200, { message: 'Вместимость должна быть не больше 200' })
  capacity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: 'Этаж должен быть целым числом' })
  floor?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  amenityIds?: number[];
}

export class AvailabilityQueryDto {
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'Дата должна быть в формате YYYY-MM-DD' })
  date: string;

  /** Смещение часового пояса клиента в минутах к востоку от UTC (по умолчанию 0). */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(-840)
  @Max(840)
  offset: number = 0;
}
