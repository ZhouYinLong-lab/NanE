const env = "dev";

const configs = {
  dev: {
    apiBase: "http://localhost:3000/api"
  },
  prod: {
    apiBase: "https://api.example.com/api"
  }
};

module.exports = {
  env,
  ...configs[env]
};
