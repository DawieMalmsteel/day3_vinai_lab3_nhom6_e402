/// <reference types="vite/client" />

declare module "react-dom/client" {
  import { Root } from "react-dom";
  import { ReactNode } from "react";

  export interface CreateRootOptions {
    onRecoverableError?: (error: unknown, errorInfo: { componentStack?: string }) => void;
    identifierPrefix?: string;
  }

  export function createRoot(container: Element | DocumentFragment, options?: CreateRootOptions): Root;
  export function hydrateRoot(container: Element | DocumentFragment, initialChildren: ReactNode, options?: any): Root;
}
