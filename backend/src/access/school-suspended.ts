import { ForbiddenException } from '@nestjs/common';

export const SCHOOL_SUSPENDED_CODE = 'SCHOOL_SUSPENDED';
export const SCHOOL_SUSPENDED_MESSAGE =
  'โรงเรียนนี้ถูกระงับการใช้งานชั่วคราว ไม่สามารถสั่งอาหารหรือใช้รหัสเชิญได้';

/** 403 with a stable code so clients can show a dedicated "school suspended" screen. */
export const schoolSuspendedException = () =>
  new ForbiddenException({
    message: SCHOOL_SUSPENDED_MESSAGE,
    code: SCHOOL_SUSPENDED_CODE,
  });
