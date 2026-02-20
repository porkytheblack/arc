import { createContext, useContext } from "react";

type SendMessageFn = (text: string) => void;

const SendMessageContext = createContext<SendMessageFn | null>(null);

export const SendMessageProvider = SendMessageContext.Provider;

export function useSendMessage(): SendMessageFn | null {
  return useContext(SendMessageContext);
}
