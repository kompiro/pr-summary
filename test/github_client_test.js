'use strict';

const context = require('mocha').describe;

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

    const ENTRY_POINT_OF_PR_COMMITS = '/repos/kompiro/awesome-app/pulls/3/commits';

    context('no paging', () => {
      nock('https://api.github.com/').
      get(ENTRY_POINT_OF_PR_COMMITS).
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

    context('have paging', () => {
      nock('https://api.github.com/').
      get(ENTRY_POINT_OF_PR_COMMITS).
      reply(200, [
        { sha: 'sha0' },
        { sha: 'sha1' }
      ],{
        Link: `<https://api.github.com${ENTRY_POINT_OF_PR_COMMITS}?page=2>; rel="next",` +
        `<https://api.github.com${ENTRY_POINT_OF_PR_COMMITS}?page=2>; rel="last"`
      }).
      get(ENTRY_POINT_OF_PR_COMMITS).
      query({page: 2}).
      reply(200, [
        { sha: 'sha2' },
        { sha: 'sha3' }
      ]);

      it ('returns commits', (done) => {
        sut.getCommitsFromPullRequest('kompiro', 'awesome-app', 3).then((commits) => {
          assert(commits.length === 4);
          assert(commits[2].sha === 'sha2');
          done();
        }).catch(done);
      });
    });

  });

});