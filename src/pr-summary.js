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

const prRegex = /^Merge pull request #(\d+) from (.*)/;
const filterMerged = (commits) => {
  return new Promise((resolve)=>{
    const mergeCommits = commits.map((current) => {
      const message = current.commit.message;
      const matched = message.match(prRegex);
      if (matched) {
        return matched[1];
      }
      return null;
    }).filter((number)=>{
      return number != null;
    });
    resolve(mergeCommits);
  });
};

const fetchPullRequests = (owner, repo, prNumbers) => {
  const getPRInfos = prNumbers.map((prNumber)=>{
    // Pull Request is an issue type. But issue is not a pull request.
    return client.issues.get({
      owner,
      repo,
      number: prNumber
    });
  });
  return Promise.all(getPRInfos);
};

export const getPRInfo = (owner, repo, number) => {
  return new Promise((resolve) => {
    const prInfo = {};
    getCommitsFromPullRequest(owner, repo, number).
      then((commits) => {
        prInfo.commits = commits;
        return commits;
      }).
      then(filterMerged).
      then(fetchPullRequests.bind(this, owner, repo)).
      then((prs) => {
        prInfo.prs = prs;
        resolve(prInfo);
      });
  });
};

