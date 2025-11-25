/// <reference types="vite/client" />

declare module 'stringify-object' {
  interface Options {
    indent?: string
    singleQuotes?: boolean
    inlineCharacterLimit?: number
  }
  
  function stringifyObject(obj: any, options?: Options): string
  export default stringifyObject
}

declare module 'json-cycle' {
  export function decycle(obj: any): any
  export function retrocycle(obj: any): any
}

declare module '@webcontainer/api' {
  export class WebContainer {
    static boot(): Promise<WebContainer>
    spawn(command: string, args?: string[]): Promise<WebContainerProcess>
    fs: FileSystemAPI
  }

  export interface WebContainerProcess {
    exit: Promise<number>
    output: ReadableStream<string>
    kill(): void
  }

  export interface FileSystemAPI {
    writeFile(path: string, content: string): Promise<void>
    readFile(path: string): Promise<string>
    mkdir(path: string, options?: { recursive?: boolean }): Promise<void>
    rm(path: string, options?: { recursive?: boolean }): Promise<void>
  }
}
