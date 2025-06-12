import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';

// export const Roles = Reflector.createDecorator<string[]>();
export const ROLES_KEY = 'roles';
export const Roles = (roles: string[]) => SetMetadata(ROLES_KEY, roles);
// export const Roles = (roles: string[]) => SetMetadata('roles', roles);
