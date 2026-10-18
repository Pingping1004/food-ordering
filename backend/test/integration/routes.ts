import { DiscoveryService, MetadataScanner } from '@nestjs/core';
import { PATH_METADATA, METHOD_METADATA } from '@nestjs/common/constants';
import { RequestMethod } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';

export interface RouteInfo { method: string; path: string; key: string }

const join = (...parts: string[]) =>
  '/' + parts.flatMap((p) => p.split('/')).filter(Boolean).join('/');

/** Every HTTP route the running app exposes, discovered from controller metadata (global prefix `api`). */
export function discoverRoutes(app: INestApplication): RouteInfo[] {
  const discovery = app.get(DiscoveryService);
  const scanner = app.get(MetadataScanner);
  const routes: RouteInfo[] = [];
  for (const w of discovery.getControllers()) {
    const { instance, metatype } = w;
    if (!instance || !metatype) continue;
    const base = Reflect.getMetadata(PATH_METADATA, metatype) ?? '';
    const basePaths: string[] = Array.isArray(base) ? base : [base];
    const proto = Object.getPrototypeOf(instance);
    for (const name of scanner.getAllMethodNames(proto)) {
      const handler = proto[name];
      const methodId = Reflect.getMetadata(METHOD_METADATA, handler);
      if (methodId === undefined) continue;
      const sub = Reflect.getMetadata(PATH_METADATA, handler) ?? '';
      const subs: string[] = Array.isArray(sub) ? sub : [sub];
      for (const b of basePaths) for (const s of subs) {
        const method = RequestMethod[methodId];
        const path = join('api', b, s);
        routes.push({ method, path, key: `${method} ${path}` });
      }
    }
  }
  return routes.sort((a, b) => a.key.localeCompare(b.key));
}
