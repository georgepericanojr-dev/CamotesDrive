export const money = (n: number) => `₱${n.toLocaleString("en-PH")}`;
export const beach = require("../../assets/images/vehicles/beach.jpg");
export const vehicles = [
  {
    id: "fortuner",
    name: "Toyota Fortuner",
    category: "SUVs",
    type: "SUV",
    year: 2024,
    price: 2800,
    deposit: 5000,
    seats: 7,
    transmission: "Automatic",
    fuel: "Diesel",
    area: "San Francisco",
    rating: "4.9",
    reviews: 28,
    image: require("../../assets/images/vehicles/suv.jpg"),
    tag: "POPULAR CHOICE",
    owner: "Miguel Santos",
  },
  {
    id: "vios",
    name: "Toyota Vios",
    category: "Cars",
    type: "Sedan",
    year: 2023,
    price: 1500,
    deposit: 3000,
    seats: 5,
    transmission: "Automatic",
    fuel: "Gasoline",
    area: "Poro",
    rating: "4.8",
    reviews: 42,
    image: require("../../assets/images/vehicles/car.jpg"),
    tag: "GREAT VALUE",
    owner: "Ana Reyes",
  },
  {
    id: "honda",
    name: "Honda Click 125i",
    category: "Motorcycles",
    type: "Scooter",
    year: 2024,
    price: 450,
    deposit: 1500,
    seats: 2,
    transmission: "Automatic",
    fuel: "Gasoline",
    area: "San Francisco",
    rating: "4.9",
    reviews: 64,
    image: require("../../assets/images/vehicles/motorcycle.jpg"),
    tag: "ISLAND FAVORITE",
    owner: "Carlo Dela Cruz",
  },
  {
    id: "hiace",
    name: "Toyota Hiace",
    category: "Vans",
    type: "Van",
    year: 2023,
    price: 3500,
    deposit: 5000,
    seats: 12,
    transmission: "Manual",
    fuel: "Diesel",
    area: "Tudela",
    rating: "4.8",
    reviews: 19,
    image: require("../../assets/images/vehicles/suv.jpg"),
    tag: "FOR THE WHOLE CREW",
    owner: "Miguel Santos",
  },
];
export type Vehicle = (typeof vehicles)[number];
export type Mode = "Renter" | "Owner" | "Driver";
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
  reference?: string;
  reviewed?: boolean;
  driver?: boolean;
  authorizedDriver?: string;
};
export const initialTrips: Trip[] = [
  {
    id: "CD-1028",
    vehicleId: "fortuner",
    status: "Confirmed",
    payment: "Unpaid",
    start: "2026-10-22",
    end: "2026-10-24",
    days: 2,
    pickup: "Consuelo Port",
    method: "Cash on pickup",
  },
  {
    id: "CD-0981",
    vehicleId: "honda",
    status: "Completed",
    payment: "Paid",
    start: "2026-10-10",
    end: "2026-10-12",
    days: 2,
    pickup: "Santiago Bay",
    method: "GCash",
  },
];
export const pickupPoints = [
  "Consuelo Port",
  "Santiago Bay",
  "Poro Port",
  "San Francisco town center",
  "Tudela town center",
];
export const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00+08:00`).toLocaleDateString("en-PH", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Manila",
  });
