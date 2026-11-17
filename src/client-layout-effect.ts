import { useEffect, useLayoutEffect } from "react";

/** useLayoutEffect in the browser; useEffect on the server, where React 18 warns about layout effects. */
export const useClientLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;
