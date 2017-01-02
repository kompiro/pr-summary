#!/usr/bin/env node
'use strict';

import {prepareRelease} from './src';

const config = {
  token: process.env.GITHUB_TOKEN
};

prepareRelease(config, 'kompiro','awesome-app', 'master', 'develop').
then((pr) => {
  console.info(`created: ${pr.html_url}`);
}).catch((err) => {
  console.error(err.message);
});
