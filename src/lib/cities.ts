// Supported cities for multi-city civic tracking
export const CITIES = [
  "Delhi",
  "Mumbai",
  "Bangalore",
  "Hyderabad",
  "Chennai",
  "Kolkata",
  "Pune",
  "Ahmedabad",
  "Jaipur",
  "Lucknow",
  "Indore",
  "Bhopal",
  "Surat",
  "Nagpur",
] as const;

export type City = typeof CITIES[number];

export const DEFAULT_CITY: City = "Delhi";
