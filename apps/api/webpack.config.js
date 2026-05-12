const TsconfigPathsPlugin = require("tsconfig-paths-webpack-plugin");

module.exports = (options) => ({
  ...options,
  resolve: {
    ...options.resolve,
    plugins: [
      ...((options.resolve && options.resolve.plugins) || []),
      new TsconfigPathsPlugin({ configFile: "tsconfig.build.json" }),
    ],
  },
});
