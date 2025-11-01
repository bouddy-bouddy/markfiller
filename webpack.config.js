/* eslint-disable no-undef */

const devCerts = require("office-addin-dev-certs");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const webpack = require("webpack");
const Dotenv = require("dotenv-webpack");

const urlDev = "https://localhost:3000/";
const urlProd = "https://www.contoso.com/"; // CHANGE THIS TO YOUR PRODUCTION DEPLOYMENT LOCATION

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
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".jsx", ".html"],
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
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
        maxInitialRequests: 25,
        minSize: 20000,
        cacheGroups: {
          // Vendor chunks for better caching
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: "vendors",
            priority: 10,
            reuseExistingChunk: true,
          },
          // Fluent UI components (large library)
          fluentui: {
            test: /[\\/]node_modules[\\/]@fluentui[\\/]/,
            name: "fluentui",
            priority: 20,
            reuseExistingChunk: true,
          },
          // React and React DOM
          react: {
            test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
            name: "react",
            priority: 30,
            reuseExistingChunk: true,
          },
          // Common utilities and services
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
      usedExports: true, // Tree shaking
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
