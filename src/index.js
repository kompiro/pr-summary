#!/usr/bin/env node
'use strict';

import {GitHubClient} from './github_client';
import GitHubAPI from '@octokit/rest';

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
  },
  getDailyPRs: (config, owner, repo, user, date) => {
    var client = module.exports.createClient(config);
    return client.getDailyPRs(owner, repo, user, date);
  }
};

