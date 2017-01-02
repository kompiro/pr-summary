#!/usr/bin/env node
'use strict';

import {GitHubClient} from './github_client';
import GitHubAPI from 'github';

module.exports = {
  createClient: (config) => {
    const client = new GitHubAPI();
    client.authenticate({
      type: 'token',
      token: config.token
    });
    return new GitHubClient(client, config.template);
  },
  getPRInfo: (config, owner, repo, number) => {
    const client = module.exports.createClient(config);
    return client.getPRInfo(owner, repo, number);
  },
  prepareRelease: (config, owner, repo, base, head) => {
    const client = module.exports.createClient(config);
    return client.prepareRelease(owner, repo, base, head);
  }
};

