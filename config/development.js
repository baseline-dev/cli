const config = {
  service: {
    allowOrigin: 'http://localhost:8080'
  },
  baselineUrl: 'http://localhost:8080/baseline',
  baselineStaticAssetsUrl: 'http://localhost:8080',
  baselineApiUrl: 'http://localhost:8081'
};

export {
  config as default
}