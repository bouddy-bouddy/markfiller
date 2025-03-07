// Add module declarations for webpack hot module replacement
declare const module: {
  hot: {
    accept(path: string, callback: () => void): void;
  };
};
