// Add module declarations for webpack hot module replacement
declare interface NodeModule {
  hot: {
    accept(path: string, callback: () => void): void;
  };
}
