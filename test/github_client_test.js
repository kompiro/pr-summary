'use strict';

import assert from 'power-assert';

import GitHubAPI from 'github';
import {GitHubClient} from '../lib/github_client';

let sut;
describe('GitHubClient', () => {
  beforeEach(() => {
    const api = new GitHubAPI();

    api.authenticate({
      type: 'token',
      token: 'GITHUB_TOKEN'
    });

    sut = new GitHubClient(api);
  });

  it('set auth info', () => {
    assert(sut.client.auth.type === 'token');
    assert(sut.client.auth.token === 'GITHUB_TOKEN');
  });
});