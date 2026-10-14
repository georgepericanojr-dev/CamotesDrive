import React, { createContext, useContext, useState } from "react";
import { initialTrips, Mode, Trip } from "@/data/mock";
export type ListingDraft = {
  name: string;
  plate: string;
  rate: string;
  deposit: string;
  category: string;
};
type Demo = {
  mode: Mode;
  setMode: (mode: Mode) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  trips: Trip[];
  addTrip: (trip: Trip) => void;
  updateTrip: (id: string, change: Partial<Trip>) => void;
  notice: string;
  toast: (message: string) => void;
  name: string;
  setName: (name: string) => void;
  chauffeur: boolean;
  setChauffeur: (value: boolean) => void;
  signedIn: boolean;
  setSignedIn: (value: boolean) => void;
  listingDraft: ListingDraft | null;
  setListingDraft: (draft: ListingDraft | null) => void;
  submittedListings: ListingDraft[];
  setSubmittedListings: (listings: ListingDraft[]) => void;
};
const Context = createContext<Demo | null>(null);
export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [mode, setMode] = useState<Mode>("Renter");
  const [favorites, setFavorites] = useState<string[]>(["honda"]);
  const [trips, setTrips] = useState(initialTrips);
  const [notice, toast] = useState("");
  const [name, setName] = useState("Alex Morgan");
  const [chauffeur, setChauffeur] = useState(false);
  const [signedIn, setSignedIn] = useState(true);
  const [listingDraft, setListingDraft] = useState<ListingDraft | null>(null);
  const [submittedListings, setSubmittedListings] = useState<ListingDraft[]>(
    [],
  );
  return (
    <Context.Provider
      value={{
        mode,
        setMode,
        favorites,
        toggleFavorite: (id) =>
          setFavorites((old) =>
            old.includes(id) ? old.filter((x) => x !== id) : [...old, id],
          ),
        trips,
        addTrip: (trip) => setTrips((old) => [trip, ...old]),
        updateTrip: (id, change) =>
          setTrips((old) =>
            old.map((t) => (t.id === id ? { ...t, ...change } : t)),
          ),
        notice,
        toast,
        name,
        setName,
        chauffeur,
        setChauffeur,
        signedIn,
        setSignedIn,
        listingDraft,
        setListingDraft,
        submittedListings,
        setSubmittedListings,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useDemo() {
  const value = useContext(Context);
  if (!value) throw new Error("DemoProvider is required");
  return value;
}
