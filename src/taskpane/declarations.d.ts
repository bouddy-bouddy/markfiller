// Add module declarations for webpack hot module replacement
declare const module: {
  hot: {
    accept(path: string, callback: () => void): void;
  };
};

// Add global type declarations
declare global {
  interface File {
    name: string;
    size: number;
    type: string;
    lastModified: number;
    arrayBuffer(): Promise<ArrayBuffer>;
    slice(start?: number, end?: number, contentType?: string): Blob;
    stream(): ReadableStream;
    text(): Promise<string>;
  }

  interface Console {
    log(...args: any[]): void;
    error(...args: any[]): void;
    warn(...args: any[]): void;
    info(...args: any[]): void;
  }

  const console: Console;

  // Add process for environment variables
  const process: {
    env: {
      [key: string]: string | undefined;
    };
  };

  // Add fetch for API calls
  function fetch(url: string, options?: RequestInit): Promise<Response>;

  // Add RequestInit interface
  interface RequestInit {
    method?: string;
    headers?: HeadersInit;
    body?:
      | string
      | FormData
      | ArrayBuffer
      | ArrayBufferView
      | Blob
      | File
      | URLSearchParams
      | ReadableStream<Uint8Array>;
  }

  // Add HeadersInit interface
  type HeadersInit = Headers | string[][] | Record<string, string>;

  // Add Response interface
  interface Response {
    ok: boolean;
    status: number;
    json(): Promise<any>;
    text(): Promise<string>;
  }

  // Add Headers interface
  interface Headers {
    append(name: string, value: string): void;
    delete(name: string): void;
    get(name: string): string | null;
    has(name: string): boolean;
    set(name: string, value: string): void;
  }

  // Add HTMLElement interface
  interface HTMLElement extends Element {
    value?: string;
  }

  // Add HTMLInputElement interface
  interface HTMLInputElement extends HTMLElement {
    value: string;
  }
}

// External libraries without bundled types
declare module "jspdf" {
  const jsPDF: any;
  export default jsPDF;
}

declare module "html2canvas" {
  const html2canvas: any;
  export default html2canvas;
}
