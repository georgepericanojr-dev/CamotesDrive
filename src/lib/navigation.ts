import { Platform } from "react-native";

// The browser root is the admin entry; renter pages retain their own home URL.
export const renterHomeHref = Platform.OS === "web" ? "/explore" : "/";
