/// <reference types="vite/client" />

declare module 'stringify-object' {
  interface Options {
    indent?: string;
    singleQuotes?: boolean;
    inlineCharacterLimit?: number;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function stringifyObject(obj: any, options?: Options): string;
  export default stringifyObject;
}

declare module 'json-cycle' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function decycle(obj: any): any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export function retrocycle(obj: any): any;
}
