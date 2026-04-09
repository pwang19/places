import React, {
  useState,
  useContext,
  createContext,
  type ReactNode,
  type Dispatch,
  type SetStateAction,
} from "react";

/** Loose row shape from list/detail APIs (Supabase or legacy). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- API rows vary by endpoint
export type PlaceListEntry = Record<string, any>;

/** Detail view payload from GET /places/:id (shape varies from list endpoint). */
export type SelectedPlaceDetail = {
  place?: Record<string, any>;
  reviews?: any[];
  places?: any[];
} | null;

export type PlacesContextValue = {
  places: PlaceListEntry[];
  setPlaces: Dispatch<SetStateAction<PlaceListEntry[]>>;
  addPlaces: (place: PlaceListEntry) => void;
  selectedPlace: SelectedPlaceDetail;
  setSelectedPlace: Dispatch<SetStateAction<SelectedPlaceDetail>>;
};

export const PlacesContext = createContext<PlacesContextValue | undefined>(
  undefined
);

export function usePlacesContext(): PlacesContextValue {
  const ctx = useContext(PlacesContext);
  if (ctx === undefined) {
    throw new Error("usePlacesContext must be used within PlacesContextProvider");
  }
  return ctx;
}

export function PlacesContextProvider({ children }: { children: ReactNode }) {
  const [places, setPlaces] = useState<PlaceListEntry[]>([]);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlaceDetail>(null);

  const addPlaces = (place: PlaceListEntry) => {
    setPlaces((prev) => [...prev, place]);
  };

  return (
    <PlacesContext.Provider
      value={{
        places,
        setPlaces,
        addPlaces,
        selectedPlace,
        setSelectedPlace,
      }}
    >
      {children}
    </PlacesContext.Provider>
  );
}
