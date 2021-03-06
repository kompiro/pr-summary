'use strict';

const context = require('mocha').describe;

import assert from 'power-assert';
import nock from 'nock';

import GitHubAPI from 'github';
import {GitHubClient} from '../src/github_client';

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

  afterEach(() => {
    nock.cleanAll();
  });

  it('set auth info', () => {
    assert(sut.client.auth.type === 'token');
    assert(sut.client.auth.token === 'GITHUB_TOKEN');
  });

  const ENTRY_POINT_OF_GITHUB = 'https://api.github.com/';
  const ENTRY_POINT_OF_PULL_REQUESTS = '/repos/kompiro/awesome-app/pulls';
  const ENTRY_POINT_OF_PR_COMMITS = '/repos/kompiro/awesome-app/pulls/3/commits';

  const nockHub = () => {
    return nock(ENTRY_POINT_OF_GITHUB);
  };

  describe('#getCommitsFromPullRequest', () => {

    context('no paging', () => {
      beforeEach(()=> {
        nockHub().
        get(ENTRY_POINT_OF_PR_COMMITS).
        reply(200, [
          { sha: 'sha0', author: {login: 'kompiro'} },
          { sha: 'sha1', author: {login: 'kompiro'} }
        ]);
      });

      it ('returns commits', () => {
        return sut.getCommitsFromPullRequest('kompiro', 'awesome-app', 3).then((commits) => {
          assert.equal(2, commits.length);
          assert.equal('sha0', commits[0].sha);
        });
      });
    });

    context('have paging', () => {
      beforeEach(() => {
        nockHub().
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
      });

      it ('returns commits', () => {
        return sut.getCommitsFromPullRequest('kompiro', 'awesome-app', 3).then((commits) => {
          assert.equal(4, commits.length, 4);
          assert.equal('sha2', commits[2].sha);
        });
      });
    });

  });

  describe('#fetchPullRequests', () => {

    context('pulls are not found', () => {
      beforeEach(() => {
        nockHub().
        get(ENTRY_POINT_OF_PULL_REQUESTS).
        query(true).
        reply(200, [
          { number: 1, head: {sha: 'sha0' } ,merged_at: '2017-01-08T21:56:36+09:00' },
          { number: 2, head: {sha: 'sha1' } ,merged_at: '2017-01-08T21:56:36+09:00' }
        ]);
      });

      it ('cannot resolve pull request', () => {
        return sut.fetchPullRequests('kompiro', 'awesome-app', [{ sha: 'not found'}]).then((prs) => {
          assert.equal(prs.length, 0);
        });
      });

    });

    context('pull is found', () => {
      beforeEach(() => {
        nockHub().
        get(ENTRY_POINT_OF_PULL_REQUESTS).
        query(true).
        reply(200, [
          { number: 1, head: {sha: 'sha0' } ,merged_at: '2017-01-08T21:56:36+09:00' },
          { number: 2, head: {sha: 'sha1' } ,merged_at: '2017-01-08T21:56:36+09:00' }
        ]);
      });

      it ('resolves pull request', () => {
        return sut.fetchPullRequests('kompiro', 'awesome-app', [{ sha: 'sha0'}]).then((prs) => {
          assert.equal(1, prs.length);
        });
      });
    });
  });

  describe('#getPRInfo', () => {
    beforeEach(() => {
      nockHub().
      get(ENTRY_POINT_OF_PR_COMMITS).
      reply(200, [
        { sha: 'sha0', author: {login: 'kompiro'} },
        { sha: 'sha1', author: {login: 'kompiro'} }
      ],{
        Link: `<https://api.github.com${ENTRY_POINT_OF_PR_COMMITS}?page=2>; rel="next",` +
        `<https://api.github.com${ENTRY_POINT_OF_PR_COMMITS}?page=2>; rel="last"`
      }).
      get(ENTRY_POINT_OF_PR_COMMITS).
      query({page: 2}).
      reply(200, [
        { sha: 'sha2', author: {login: 'kompiro'}  },
        { sha: 'sha3', author: {login: 'kompiro'}  }
      ]).
      get(ENTRY_POINT_OF_PULL_REQUESTS).
      query(true).
      reply(200, [
        { number: 1, head: {sha: 'sha0' } ,merged_at: '2017-01-08T21:56:36+09:00' },
        { number: 2, head: {sha: 'sha3' } ,merged_at: '2017-01-08T23:56:36+09:00' }
      ]);
    });

    it ('returns pr info', () => {
      return sut.getPRInfo('kompiro', 'awesome-app', 3).then((prInfo) => {
        assert.equal(prInfo.number, 3);
        assert.equal(prInfo.commits.length, 4);
        assert.equal(prInfo.prs.length, 2 );
      });
    });
  });

  describe('#getDailyPRs()', () => {
    beforeEach(() => {
      nockHub().
      get(ENTRY_POINT_OF_PULL_REQUESTS).
      query(true).
      reply(200, [
        {
          number: 1,
          head: {sha: 'sha0'},
          merged_at: '2017-01-08T21:56:36+09:00',
          updated_at: '2017-01-08T21:56:36+09:00',
          user: {login: 'user'},
          state: 'open'
        },
        {
          number: 2,
          head: {sha: 'sha3'},
          merged_at: '2017-01-08T23:56:36+09:00',
          updated_at: '2017-01-08T23:56:36+09:00',
          assignee: {login: 'user'},
          state: 'closed'
        }
      ]);
    });

    it ('returns prs in the repo', () => {
      return sut.getDailyPRs('kompiro', 'awesome-app', {user: 'all', date: '2017-01-08'}).then((result) => {
        assert(result);

        assert.equal(result.filteredDate, '2017-01-08');
        assert.equal(result.all.open.length, 1);
        assert.equal(result.all.merged.length, 1);
        assert.equal(result.all.closed.length, 0);
        assert.equal(result.owner.open.length, 0);
        assert.equal(result.owner.closed.length, 0);
        assert.equal(result.assigned.open.length, 0);
        assert.equal(result.assigned.closed.length, 0);
      });
    });

    it ('returns prs by specified user', () => {
      return sut.getDailyPRs('kompiro', 'awesome-app', {user: 'user', date: '2017-01-08'}).then((result) => {
        assert(result);

        assert.equal(result.filteredDate, '2017-01-08');
        assert.equal(result.owner.open.length, 1);
        assert.equal(result.owner.closed.length, 0);
        assert.equal(result.assigned.open.length, 0);
        assert.equal(result.assigned.merged.length, 1);
        assert.equal(result.assigned.closed.length, 0);
      });
    });

  });

});