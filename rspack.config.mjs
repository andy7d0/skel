// @ts-check
import path from 'node:path';
import { execaSync } from 'execa';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@rspack/cli';
import { rspack } from '@rspack/core';
import { ReactRefreshRspackPlugin } from '@rspack/plugin-react-refresh';
// import oxlint  from 'unplugin-oxlint/webpack';
//import { OxLintWebpackPlugin } from "oxlint-rspack-plugin";
import { OxLintWebpackPlugin } from "./dev/compile/oxlint-rspack-plugin/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const isDev = process.env.NODE_ENV === 'development';

// Target browsers, see: https://github.com/browserslist/browserslist
const targets = ['last 2 versions', '> 0.2%', 'not dead', 'Firefox ESR']; //, 'baseline widely available'];

let gitVersions = 
{
  shortHash: '#DEV'
  , numCommits: '~inf~'
  , dirty: true
}
if(!isDev){
  gitVersions = {
    shortHash: execaSync('git', ['rev-parse', '--short', 'HEAD']).stdout
    , numCommits: Number(execaSync('git', ['rev-list', 'HEAD', '--count']).stdout)
    , dirty: execaSync('git', ['status', '-s', '-uall']).stdout.length > 0
  }
};


export default defineConfig({
  context: __dirname,
  devServer: {
    port: 3000,
    open: false, // open: ['/my-page', '/another-page']
    setupMiddlewares: (middlewares) => {
      middlewares.unshift({
        name: 'local-redir',
        // `path` is optional
        path: '/',
        middleware: (req, res, next) => {
          if(req.path === '/') return next();
          if(req.path.match(/[.]/)) return next();
          res.redirect(302, `/?${req.path}`);
        },
      });
      return middlewares;
    }
  },
  entry: {
    main: './src/client/main.jsx',
  },
  resolve: {
    extensions: ['...', '.ts', '.tsx', '.jsx'],
  },
  module: {
    rules: [
      {
        test: /\.svg$/,
        type: 'asset',
      },
      {
        test: /\.(jsx?|tsx?)$/,
        exclude: /node_modules[\\/]core-js/,
        use: [
          {
            loader: 'builtin:swc-loader',
            /** @type {import('@rspack/core').SwcLoaderOptions} */
            options: {
              env: {
                mode: 'entry',
                coreJs: '3.47.0',
                targets
              },
              jsc: {
                //externalHelpers: true, //BUG in bundler
                parser: {
                  syntax: 'typescript',
                  tsx: true,
                },
                transform: {
                  react: {
                    runtime: 'automatic',
                    development: isDev,
                    refresh: isDev,
                    useBuiltins: true,
                  },
                },
                experimental: {
                  plugins: [
                    [path.resolve(__dirname, "dev/compile/api-call/target/wasm32-wasip1/release/api_call.wasm"), {}],
                  ]
                }
              },
            },
          },
        ],
      },
    ],
  },
  plugins: [
    //oxlint(),
    new OxLintWebpackPlugin(),
    new rspack.HtmlRspackPlugin({
      template: './index.html',
    }),
    isDev ? new ReactRefreshRspackPlugin() : null,
    new rspack.CircularDependencyRspackPlugin({
      failOnError: true,
      exclude: /node_modules/,
    }),
    new rspack.experiments.VirtualModulesPlugin({
      'node_modules/git-version.js': 'module.exports = ' + JSON.stringify(gitVersions),
    }),
    new rspack.ProvidePlugin({
      API: [path.resolve(path.join(__dirname, 'src/azlib/api.mjs')), 'API']
    }),
  ],
  optimization: {
    minimizer: [
      new rspack.SwcJsMinimizerRspackPlugin(),
      new rspack.LightningCssMinimizerRspackPlugin({
        minimizerOptions: { targets },
      }),
    ],
  },
  experiments: {
    css: true,
  },
});
