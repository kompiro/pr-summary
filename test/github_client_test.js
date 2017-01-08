'use strict';

import assert from 'power-assert';
import nock from 'nock';

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

  describe('#getCommitsFromPullRequest', () => {

    nock('https://api.github.com/').
      get('/repos/kompiro/awesome-app/pulls/3/commits').
      reply(200, [
        { sha: 'sha0' },
        { sha: 'sha1' }
      ]);

    it ('returns commits', (done) => {
      sut.getCommitsFromPullRequest('kompiro', 'awesome-app', 3).then((commits) => {
        assert(commits.length === 2);
        assert(commits[0].sha === 'sha0');
        done();
      }).catch(done);
    });
  });

});