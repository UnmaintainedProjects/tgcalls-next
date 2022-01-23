const path = require("path");

module.exports = {
  entry: "./lib/index.js",
  optimization: {
    minimize: true,
  },
  output: {
    library: "tgcallsNext",
    libraryTarget: "umd",
    filename: "tgcalls-next.js",
    path: path.resolve(__dirname, "lib"),
  },
  externals: {
    "telegram": "{}",
  },
};
