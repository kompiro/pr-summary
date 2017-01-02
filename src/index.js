#!/usr/bin/env node
'use strict';

import {GitHubClient} from './github_client';
import GitHubAPI from 'github';

module.exports = {
  createClient: (token) => {
    const client = new GitHubAPI();
    client.authenticate({
      type: 'token',
      token
    });
    return new GitHubClient(client);
  },
  getPRInfo: (token, owner, repo, number) => {
    const client = module.exports.createClient(token);
    return client.getPRInfo(owner, repo, number);
  },
  prepareRelease: (token, owner, repo, base, head) => {
    const client = module.exports.createClient(token);
    return client.prepareRelease(owner, repo, base, head);
  }
};

