import {getAvailablePort} from './port';
import {Server} from './http';
import {post} from './request';
import {addCredentials, getServiceCredentials, writeServiceCredentialsToDisk} from './service-credentials';
import {getEventBus} from './event-bus';
import {encryptValue, getKeys} from './keys';

const app = new Server();
const eventBus = getEventBus();

app.post('/baseline', (ctx, res) => {
  return new Promise((resolve, reject) => {
    writeServiceCredentialsToDisk(ctx.body)
      .then(() => {
        eventBus.emit('received-service-credentials', ctx.body);
      })
      .catch(reject);

    eventBus.on('baseline-fail', () => {
      res.status = 500;
      res.body = {
        status: 'error',
        message: 'Baselining failed.'
      };
      resolve();
    });

    eventBus.on('baseline-success', (args) => {
      res.status = 200;
      res.body = {
        status: 'ok',
        message: 'Baselining succeeded.',
        result: {
          reportLocation: args.reportLocation
        }
      };
      resolve();
    });
  });

});

app.post('/baseline/credentials/encrypt', async (ctx, res) => {
  const {status, body} = await post(`/v1/baseline/dryrun`, ctx.body);

  if (body.status === 'error') {
    res.status = status;
    res.body = {
      status: 'error',
      message: body.message
    };
    return;
  }

  const {publicKey} = await getKeys();
  const encryptedCredentials = ctx.body.map((service) => {
    Object.keys(service.credentials).forEach(async (key) => {
      service.credentials[key] = encryptValue(publicKey, service.credentials[key]);
    });
    return service;
  });

  res.status = status;
  res.body = {
    status: 'ok',
    result: encryptedCredentials
  };
});

app.get('/baseline/credentials', async (ctx, res) => {
  const credentials = await getServiceCredentials();
  res.status = 200;
  res.body = {
    status: 'ok',
    result: credentials || []
  };
});

async function initServer() {
  const port = await getAvailablePort();
  app.listen(port);
  return app;
}

export {initServer}
