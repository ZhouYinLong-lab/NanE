const env = "dev";

const configs = {
  dev: {
    apiBase: "http://localhost:37878/api"
  },
  prod: {
    apiBase: "https://api.example.com/api"
  }
};

module.exports = {
  env,
  ...configs[env]
};
