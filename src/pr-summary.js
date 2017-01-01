#!/usr/bin/env node
'use strict';

import GitHubAPI from 'github';
import 'babel-polyfill';
import program from 'commander';

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

const getPRInfo = (owner, repo, number) => {
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

const prsummary = (owner, repo, number) => {
  getPRInfo(owner, repo, number).
    then((prInfo) => {
      console.info('## Contributors\n');
      const rendered = [];
      prInfo.commits.map((commit) => {
        const user = commit.author.login;
        if (rendered.includes(user) === false && user.trim() !== '') {
          console.info(user);
          rendered.push(user);
        }
      });

      console.info('');

      console.info('## Pull Requests\n');
      prInfo.prs.map((pr) => {
        if (pr.pull_request) {
          const message = `#${pr.number} ${pr.title} by ${pr.user.login}`;
          console.info(message);
        }
      });
    });
};

program.version('2.0.0').
  usage('<owner> <repo> <number>').
  action(prsummary);

program.parse(process.argv);

if(program.args.length < 3) {
  program.help();
}


