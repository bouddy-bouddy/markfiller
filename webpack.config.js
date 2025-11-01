/* eslint-disable no-undef */

const devCerts = require("office-addin-dev-certs");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");
const Dotenv = require("dotenv-webpack");
const CompressionPlugin = require("compression-webpack-plugin");
const TerserPlugin = require("terser-webpack-plugin");
const { BundleAnalyzerPlugin } = require("webpack-bundle-analyzer");

/**
 * Optimized Webpack Configuration
 * Features: compression, aggressive tree-shaking, smart chunk splitting, bundle analysis
 */

const urlDev = "https://localhost:3000/";
const urlProd = "https://markfiller.azurewebsites.net/"; // Set your production URL here

async function getHttpsOptions() {
  const httpsOptions = await devCerts.getHttpsServerOptions();
  return { ca: httpsOptions.ca, key: httpsOptions.key, cert: httpsOptions.cert };
}

module.exports = async (env, options) => {
  const dev = options.mode === "development";
  const config = {
    devtool: dev ? "eval-cheap-module-source-map" : "source-map",
    entry: {
      polyfill: ["core-js/stable", "regenerator-runtime/runtime"],
      vendor: ["react", "react-dom", "core-js", "@fluentui/react-components", "@fluentui/react-icons"],
      taskpane: ["./src/taskpane/index.tsx"],
      commands: "./src/commands/commands.ts",
    },
    output: {
      clean: true,
      filename: dev ? "[name].js" : "[name].[contenthash:8].js",
      chunkFilename: dev ? "[name].chunk.js" : "[name].[contenthash:8].chunk.js",
      pathinfo: false, // Disable path info in bundles for better performance
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".jsx", ".html"],
      // Optimize module resolution
      symlinks: false, // Disable symlink resolution for better performance
    },
    performance: {
      hints: dev ? false : "warning",
      maxEntrypointSize: 512000, // 500KB
      maxAssetSize: 512000, // 500KB
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: "ts-loader",
            options: {
              transpileOnly: dev, // Fast compilation in dev mode
              experimentalWatchApi: dev,
              compilerOptions: {
                module: "esnext", // Enable tree shaking
              },
            },
          },
          exclude: /node_modules/,
        },
        {
          test: /\.jsx?$/,
          use: {
            loader: "babel-loader",
          },
          exclude: /node_modules/,
        },
        {
          test: /\.html$/,
          exclude: /node_modules/,
          use: "html-loader",
        },
        {
          test: /\.(png|jpg|jpeg|ttf|woff|woff2|gif|ico)$/,
          type: "asset/resource",
          generator: {
            filename: "assets/[name][ext][query]",
          },
        },
      ],
    },
    plugins: [
      new Dotenv({
        systemvars: true, // Load all system variables as well
      }),
      new HtmlWebpackPlugin({
        filename: "taskpane.html",
        template: "./src/taskpane/taskpane.html",
        chunks: ["polyfill", "vendor", "taskpane"],
      }),
      new CopyWebpackPlugin({
        patterns: [
          {
            from: "assets/*",
            to: "assets/[name][ext][query]",
          },
          {
            from: "manifest*.xml",
            to: "[name]" + "[ext]",
            transform(content) {
              if (dev) {
                return content;
              } else {
                return content.toString().replace(new RegExp(urlDev, "g"), urlProd);
              }
            },
          },
        ],
      }),
      new HtmlWebpackPlugin({
        filename: "commands.html",
        template: "./src/commands/commands.html",
        chunks: ["polyfill", "commands"],
      }),
      new webpack.ProvidePlugin({
        Promise: ["es6-promise", "Promise"],
      }),
      new webpack.DefinePlugin({
        "process.env.NODE_ENV": JSON.stringify(dev ? "development" : "production"),
      }),
      // Compression plugin for production (gzip)
      ...(!dev
        ? [
            new CompressionPlugin({
              filename: "[path][base].gz",
              algorithm: "gzip",
              test: /\.(js|css|html|svg)$/,
              threshold: 10240, // Only compress files larger than 10KB
              minRatio: 0.8, // Only compress if compression ratio is better than 0.8
            }),
            new CompressionPlugin({
              filename: "[path][base].br",
              algorithm: "brotliCompress",
              test: /\.(js|css|html|svg)$/,
              threshold: 10240,
              minRatio: 0.8,
              compressionOptions: {
                level: 11, // Maximum Brotli compression
              },
            }),
          ]
        : []),
      // Bundle analyzer (only when ANALYZE env variable is set)
      ...(process.env.ANALYZE
        ? [
            new BundleAnalyzerPlugin({
              analyzerMode: "static",
              reportFilename: "bundle-report.html",
              openAnalyzer: true,
              generateStatsFile: true,
              statsFilename: "bundle-stats.json",
            }),
          ]
        : []),
    ],
    cache: {
      type: "filesystem",
      buildDependencies: {
        config: [__filename],
      },
    },
    optimization: {
      splitChunks: {
        chunks: "all",
        maxInitialRequests: 30,
        minSize: 20000,
        maxSize: 244000, // Split chunks larger than 244KB
        cacheGroups: {
          // React and React DOM - highest priority (rarely changes)
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,
            name: "react",
            priority: 40,
            reuseExistingChunk: true,
            enforce: true,
          },
          // Chart.js - large and lazy-loaded
          chartjs: {
            test: /[\\/]node_modules[\\/](chart\.js|react-chartjs-2)[\\/]/,
            name: "chartjs",
            priority: 35,
            reuseExistingChunk: true,
          },
          // Fluent UI components (large library)
          fluentui: {
            test: /[\\/]node_modules[\\/]@fluentui[\\/]/,
            name: "fluentui",
            priority: 30,
            reuseExistingChunk: true,
          },
          // Styled Components
          styledComponents: {
            test: /[\\/]node_modules[\\/]styled-components[\\/]/,
            name: "styled-components",
            priority: 25,
            reuseExistingChunk: true,
          },
          // Excel/Office libraries
          office: {
            test: /[\\/]node_modules[\\/](@microsoft|office-addin)[\\/]/,
            name: "office",
            priority: 20,
            reuseExistingChunk: true,
          },
          // Other vendor chunks
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            priority: 10,
            reuseExistingChunk: true,
          },
          // Common utilities and services (used in multiple places)
          common: {
            minChunks: 2,
            priority: 5,
            reuseExistingChunk: true,
            name: "common",
          },
        },
      },
      runtimeChunk: "single",
      minimize: !dev,
      minimizer: !dev
        ? [
            new TerserPlugin({
              terserOptions: {
                parse: {
                  ecma: 2020,
                },
                compress: {
                  ecma: 5,
                  warnings: false,
                  comparisons: false,
                  inline: 2,
                  drop_console: true, // Remove console.logs in production
                  drop_debugger: true,
                  pure_funcs: ["console.log", "console.info", "console.debug"], // Remove specific console methods
                },
                mangle: {
                  safari10: true,
                },
                output: {
                  ecma: 5,
                  comments: false,
                  ascii_only: true,
                },
              },
              parallel: true,
              extractComments: false,
            }),
          ]
        : [],
      usedExports: true, // Tree shaking - mark unused exports
      sideEffects: false, // Aggressive tree shaking
      concatenateModules: true, // Scope hoisting
      providedExports: true,
      innerGraph: true, // Advanced tree shaking
    },
    devServer: {
      hot: true,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
      server: {
        type: "https",
        options: env.WEBPACK_BUILD || options.https !== undefined ? options.https : await getHttpsOptions(),
      },
      port: process.env.npm_package_config_dev_server_port || 3000,
    },
  };

  return config;
};
