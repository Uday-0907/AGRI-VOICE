import { customType } from 'drizzle-orm/pg-core';

/**
 * PostGIS 2D Point geometry type: geometry(Point, 4326)
 * Represents longitude (x) and latitude (y) using WGS 84 SRID 4326.
 */
export const geometryPoint = customType<{
  data: { x: number; y: number } | string;
  driverData: string;
}>({
  dataType() {
    return 'geometry(Point, 4326)';
  },
  toDriver(value) {
    if (typeof value === 'string') return value;
    return `SRID=4326;POINT(${value.x} ${value.y})`;
  },
  fromDriver(value) {
    return value;
  },
});

/**
 * PostGIS 2D Polygon geometry type: geometry(Polygon, 4326)
 * Represents field perimeters/boundaries using WGS 84 SRID 4326.
 */
export const geometryPolygon = customType<{
  data: string;
  driverData: string;
}>({
  dataType() {
    return 'geometry(Polygon, 4326)';
  },
  toDriver(value) {
    return value;
  },
  fromDriver(value) {
    return value;
  },
});
