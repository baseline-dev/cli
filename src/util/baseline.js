import path from 'path';
import {homedir} from 'os';
import {existsSync, mkdirSync, writeFileSync} from 'fs';
import {privateDecrypt} from 'crypto';
import open from 'open';
import chalk from 'chalk';
import fetch from 'got';
import config from './config';
import {exitRequestInvite} from './process';
import {SERVICES} from '../const/service';
import {getEventBus} from './event-bus';

import REPORT from '../template/compiled/report';
import HEADER from '../template/compiled/header';
import USER_ITEM from '../template/compiled/user-item';
import RESOURCES_CONTAINER from '../template/compiled/resources-container';
import RESOURCES_AWS from '../template/compiled/resources-aws';
import RESOURCES_GCLOUD from '../template/compiled/resources-gcloud';
import SERVICE_CONTAINER from '../template/compiled/service-container';
import SERVICE_ERRORS from '../template/compiled/service-errors';
import DETAILS_GITHUB from '../template/compiled/service-details-github';
import DETAILS_SLACK from '../template/compiled/service-details-slack';
import DETAILS_AWS from '../template/compiled/service-details-aws';
import DETAILS_CLOUDFLARE from '../template/compiled/service-details-cloudflare';
import DETAILS_GOOGLE from '../template/compiled/service-details-google';
import DETAILS_WORDPRESS_SELFHOSTED from '../template/compiled/service-details-wordpress-selfhosted';
import DETAILS_INTERCOM from '../template/compiled/service-details-intercom';
import DETAILS_HUBSPOT from '../template/compiled/service-details-hubspot';
import {getCredentials} from './baseline-settings';

const TEMPLATES = {
  REPORT,
  HEADER,
  USER_ITEM,
  RESOURCES_CONTAINER,
  RESOURCES_AWS,
  RESOURCES_GCLOUD,
  SERVICE_CONTAINER,
  SERVICE_ERRORS,
  DETAILS_GITHUB,
  DETAILS_SLACK,
  DETAILS_AWS,
  DETAILS_CLOUDFLARE,
  DETAILS_GOOGLE,
  DETAILS_WORDPRESS_SELFHOSTED,
  DETAILS_INTERCOM,
  DETAILS_HUBSPOT
};

const eventBus = getEventBus();

function getBaselinePath() {
  return path.join(homedir(), '.baseline');
}

async function createBaselineSettingsDirIfNotExists() {
  const baselinePath = getBaselinePath();
  if (!existsSync(baselinePath)) {
    await mkdirSync(baselinePath, {recursive: true});
  }
  return baselinePath;
}

function decryptServiceKeys(serviceKeys, privateKey, passphrase) {
  return serviceKeys.map((service) => {
    try {
      Object.keys(service.credentials).forEach((key) => {
        if (service.credentials[key]) {
          service.credentials[key] = privateDecrypt({
            key: privateKey,
            passphrase: passphrase
          }, Buffer.from(service.credentials[key], 'base64')).toString('utf8');
        }
      });
    } catch(e) {
      console.error(`\n  Something went wrong baselining ${SERVICES[service.service].name}`);
    }
    return service;
  });
}

async function baseline(serviceKeys, privateKey, passphrase, spinner) {
  spinner.text = chalk.bold('Baselining services, please be patient.');

  serviceKeys = decryptServiceKeys(serviceKeys, privateKey, passphrase);

  try {
    const response = await fetch.post(`${config.baselineApiUrl}/v1/baseline`, {
      json: serviceKeys,
      headers: {
        Authorization: `Bearer ${getCredentials()}`
      },
      responseType: 'json'
    });

    spinner.succeed(chalk.bold('Baselining complete. Opening results in your browser.'));

    const file = await REPORT({
      users: response.body.result.users || [],
      resources: response.body.result.resources.reduce((prev, next) => {
        if (!prev[next.service]) {
          prev[next.service] = [];
        }
        prev[next.service].push(next);
        return prev;
      }, {}),
      errors: response.body.result.errors || [],
      services: SERVICES,
      baselineStaticAssetsUrl: config.baselineStaticAssetsUrl,
      templates: TEMPLATES
    });

    const baselinePath = getBaselinePath();
    const report = path.join(baselinePath, 'report', 'baseline.html');

    mkdirSync(path.join(baselinePath, 'report'), {recursive: true});
    writeFileSync(report, file);

    eventBus.emit('baseline-success', {
      reportLocation: report
    });

    await open(report);
  } catch(error) {
    if (error.response && error.response.statusCode === 401) {
      eventBus.emit('baseline-fail');
      spinner.fail(chalk.bold('Failed baselining your accounts.'));
      return exitRequestInvite();
    } else {
      eventBus.emit('baseline-error');
      spinner.fail(chalk.bold('Failed baselining your accounts.'));
    }
  }
}

export {
  createBaselineSettingsDirIfNotExists,
  getBaselinePath,
  baseline
};
