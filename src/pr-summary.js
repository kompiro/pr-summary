#!/usr/bin/env node
'use strict';

import GitHubAPI from 'github';
import 'babel-polyfill';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error(
`You must set Environment Variable: GITHUB_TOKEN.
Get the token at https://github.com/settings/tokens.`
  );
  process.exit(1);
}

const client = new GitHubAPI();

client.authenticate({
  type: 'token',
  token: GITHUB_TOKEN
});

const getCommitsFromPullRequest = (owner, repo, number) => {
  const commits = [];
  const pager = (res) => {
    Array.prototype.push.apply(commits, res);
    if (client.hasNextPage(res)) {
      return client.getNextPage(res).then(pager);
    }
    return commits;
  };
  return client.pullRequests.getCommits({
    owner,
    repo,
    number
  }).then(pager);
};

const fetchPullRequests = (owner, repo, commits) => {
  return new Promise((resolve) => {
    const shas = commits.map((commit) => {
      return commit.sha;
    });
    client.pullRequests.getAll({
      owner,
      repo,
      state: 'closed',
      sort: 'updated',
      direction: 'desc',
      per_page: 100
    }).then((prs) => {
      const mergedPRs = prs.filter((pr) => {
        return pr.merged_at !== null;
      });

      const prsToDeploy = mergedPRs.reduce((result, pr) => {
        if (shas.indexOf(pr.head.sha) !== -1) {
          result.push(pr);
        }
        return result;
      }, []);

      prsToDeploy.sort((a, b) => {
        return new Date(a.merged_at) - new Date(b.merged_at);
      });

      prsToDeploy.pop(); // Remove myself

      resolve(prsToDeploy);
    });
  });
};

export const getPRInfo = (owner, repo, number) => {
  return new Promise((resolve) => {
    const prInfo = {};
    getCommitsFromPullRequest(owner, repo, number).
      then((commits) => {
        prInfo.commits = commits;
        return commits;
      }).
      then(fetchPullRequests.bind(this, owner, repo)).
      then((prs) => {
        prInfo.prs = prs;
        resolve(prInfo);
      });
  });
};

