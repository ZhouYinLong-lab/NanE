const env = "prod";

const configs = {
  dev: {
    apiBase: "http://localhost:37878/api"
  },
  prod: {
    apiBase: "https://api.zylatent.com/api"
  }
};

module.exports = {
  env,
  ...configs[env]
};
