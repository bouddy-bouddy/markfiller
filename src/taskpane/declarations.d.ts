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
}
