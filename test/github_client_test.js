'use strict';

const context = require('mocha').describe;

import assert from 'power-assert';
import nock from 'nock';

import GitHubAPI from 'github';
import {GitHubClient} from '../src/github_client';

describe('GitHubClient', () => {
  let sut;

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

  describe('#getCommitsFromPullRequest', () => {

    context('no paging', () => {
      beforeEach(()=> {
        nock(ENTRY_POINT_OF_GITHUB).
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
        nock(ENTRY_POINT_OF_GITHUB).
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
        nock(ENTRY_POINT_OF_GITHUB).
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
        nock(ENTRY_POINT_OF_GITHUB).
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
      nock(ENTRY_POINT_OF_GITHUB).
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

  describe('#prepareRelease', () => {

    context('pull request is already exist', () => {
      beforeEach(() => {
        nock(ENTRY_POINT_OF_GITHUB).
        post(ENTRY_POINT_OF_PULL_REQUESTS, {
          title: 'Prepare to deploy develop to master',
          head: 'develop',
          base: 'master'
        }).
        reply(422, {
          message: 'Validation Failed',
          errors: [
            {
              resource: 'PullRequest',
              code: 'custom',
              message: 'A pull request already exists for kompiro.master.'
            }
          ],
          documentation_url: 'https://developer.github.com/v3/pulls/#create-a-pull-request'
        });
      });

      it ('cannot create pull request', (done) => {
        sut.prepareRelease('kompiro', 'awesome-app', 'master', 'develop').catch((error)=>{
          assert(error);
          done();
        });
      });
    });

    context('succeed to create pull request', () => {
      beforeEach(() => {
        nock(ENTRY_POINT_OF_GITHUB).
        post(ENTRY_POINT_OF_PULL_REQUESTS, {
          title: 'Prepare to deploy develop to master',
          head: 'develop',
          base: 'master'
        }).
        reply(201, {
          number: 3,
          title: 'Prepare to deploy develop to master'
        }).
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
        ]).
        intercept(`${ENTRY_POINT_OF_PULL_REQUESTS}/3`, 'PATCH').
        reply(200, {
          number: 3,
          title: 'Prepare to deploy develop to master',
          body: 'updated'
        });
      });

      it ('success to create pull request', () => {
        return sut.prepareRelease('kompiro', 'awesome-app', 'master', 'develop').then((pr) => {
          assert.equal(pr.number, 3);
          assert.equal(pr.body, 'updated');
          assert.equal(pr.title, 'Prepare to deploy develop to master');
          assert.equal(pr.commits.length, 4);
          assert.equal(pr.contributors.length, 1);
        });
      });
    });

  });

});