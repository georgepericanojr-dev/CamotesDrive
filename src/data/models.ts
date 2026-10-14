import type { ImageSourcePropType } from "react-native";
export type Row = Record<string, unknown>;
export type Mode = "Renter" | "Owner" | "Driver";
export const asRow = (value: unknown): Row =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as Row)
    : {};
export const rows = (value: unknown): Row[] =>
  Array.isArray(value) ? value.map(asRow) : [];
export const text = (value: unknown) => (value == null ? "" : String(value));
export const number = (value: unknown) => Number(value) || 0;
export const money = (value: number) =>
  new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: "PHP",
    maximumFractionDigits: 2,
  }).format(value);
export const php = (centavos: unknown) => money(number(centavos) / 100);
export const beach = require("../../assets/images/vehicles/beach.jpg");
export const titleCase = (s: unknown) =>
  text(s)
    .replaceAll("_", " ")
    .replace(/^./, (c) => c.toUpperCase());
export const dateLabel = (date: string) =>
  new Date(
    date.length === 10 ? `${date}T12:00:00+08:00` : date,
  ).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
export const manilaDate = (offset = 0) =>
  new Date(Date.now() + offset * 86400000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Manila",
  });
export type Vehicle = {
  id: string;
  name: string;
  category: string;
  type: string;
  year: number;
  price: number;
  deposit: number;
  seats: number;
  transmission: string;
  fuel: string;
  area: string;
  rating: string;
  reviews: number;
  image: ImageSourcePropType;
  tag: string;
  owner: string;
  raw: Row;
};
export type Trip = {
  id: string;
  vehicleId: string;
  status: string;
  payment: string;
  start: string;
  end: string;
  days: number;
  pickup: string;
  method: string;
  driver: boolean;
  reviewed: boolean;
  vehicle: Vehicle;
  raw: Row;
};
export function mapVehicle(
  v: Row,
  photoUrl: (path: string) => string,
): Vehicle {
  const photos = Array.isArray(v.photos) ? v.photos : [];
  return {
    id: text(v.id),
    name: text(v.name),
    category:
      (
        {
          car: "Cars",
          suv: "SUVs",
          motorcycle: "Motorcycles",
          van: "Vans",
        } as Record<string, string>
      )[text(v.vehicle_type)] || "Cars",
    type: titleCase(v.vehicle_type),
    year: number(v.year),
    price: number(v.daily_rate_centavos) / 100,
    deposit: number(v.deposit_centavos) / 100,
    seats: number(v.seats),
    transmission: titleCase(v.transmission),
    fuel: titleCase(v.fuel_type),
    area: text(v.pickup_town),
    rating: v.rating == null ? "New" : text(v.rating),
    reviews: number(v.review_count),
    image: photos[0]
      ? { uri: photoUrl(text(photos[0])) }
      : require("../../assets/images/vehicles/car.jpg"),
    tag:
      v.status === "approved"
        ? "VERIFIED LOCAL RIDE"
        : titleCase(v.status).toUpperCase(),
    owner: text(v.owner_name) || "Local owner",
    raw: v,
  };
}
export function mapTrip(b: Row, photoUrl: (path: string) => string): Trip {
  return {
    id: text(b.id),
    vehicleId: text(b.vehicle_id),
    status: titleCase(b.status),
    payment: titleCase(b.payment_status),
    start: text(b.starts_at),
    end: text(b.ends_at),
    days: number(b.rental_days),
    pickup: text(b.pickup_name),
    method: titleCase(b.payment_method),
    driver: b.service_type === "chauffeured",
    reviewed: !!b.reviewed,
    vehicle: mapVehicle(asRow(b.vehicle), photoUrl),
    raw: b,
  };
}
