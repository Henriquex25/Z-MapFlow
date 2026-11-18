import { createContext } from "react";
// Closing content remains mounted briefly for animation, but must stop accepting
// drops immediately: its clipped descendants can still have nonzero DOM bounds.
export const ResourceVisibility = createContext(true);
