import { createContext, useContext, type ReactNode } from "react";

const StreamingContext = createContext(false);

/**
 * Sets `streaming` for every tsquare component inside, such as the boards tsquareComponents makes
 * in react-markdown, while a model's reply is still arriving.
 */
export function WireframeStreaming({ value, children }: { value: boolean; children?: ReactNode }) {
  return <StreamingContext.Provider value={value}>{children}</StreamingContext.Provider>;
}

export const useStreaming = (prop: boolean | undefined) => {
  const inStream = useContext(StreamingContext);
  return prop ?? inStream;
};
