#!/usr/bin/env node
'use strict';

import octonode from 'octonode';
import 'babel-polyfill';
import program from 'commander';
import request from 'request';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error(
`You must set Environment Variable: GITHUB_TOKEN.
Get the token at https://github.com/settings/tokens.`
  );
  process.exit(1);
}
const client = octonode.client(GITHUB_TOKEN);

const callClient = (thisArg, func, ...argsArray) => {
  return new Promise( (resolve, reject) => {
    const callback = (err, ...response) => {
      if (err) {
        reject(err);
        return;
      }
      resolve.apply(this, response);
    };
    const args = Array.prototype.slice.call(argsArray,0);
    args.push(callback);
    func.apply(thisArg, args);
  });
};

const callClientWithoutReject = (thisArg, func, ...argsArray) => {
  return new Promise( (resolve) => {
    const callback = (err, ...response) => {
      if (err) {
        resolve(null);
        return;
      }
      resolve.apply(this, response);
    };
    const args = Array.prototype.slice.call(argsArray,0);
    args.push(callback);
    func.apply(thisArg, args);
  });
};

const commits = (repo, refName, page) => {
  return callClient(repo, repo.commits, {page: page, per_page: 100, sha: refName});
};

const compare = (repo, head, base) => {
  return callClient(repo, repo.compare, head, base);
};

const prRegex = /Merge pull request #(\d+) from (.*)/;

const prInfoRequest = (repo, prno) => {
  const pr = client.pr(repo, prno);
  return callClientWithoutReject(pr, pr.info);
};

const listPRs = (prInfos) => {
  for (const prInfo of prInfos) {
    listPR(prInfo);
  }
};

const listPR = (prInfo) => {
  if(prInfo == null) return;
  console.info(`#${prInfo.number} ${prInfo.title} by ${prInfo.user.login}`);
};

const trackCommits = (mergeBaseSha, commitsByHash, current) => {

  let targets = [current];

  const trackedCommits = [];
  while(targets.length != 0) {
    const target = targets.pop();
    let parents = target.parents;
    for ( const parent of parents ) {
      const parentHash = parent.sha;
      if( parentHash == mergeBaseSha ){
        continue;
      }
      current = commitsByHash[parentHash];
      if(current && trackedCommits.indexOf(current) == -1) {
        trackedCommits.push(current);
        targets.push(current);
      }
    }
  }

  return trackedCommits;
};

const getPRNo = (current) => {
  const message = current.commit.message;
  const title = message.split('\n')[0];
  if(prRegex.test(title)) {
    return RegExp.$1;
  }
  return null;
};

const showPRs = (repo, mergeBaseSha, response) => {
  const commits = response.reduce((left, right) => {
    return left.concat(right);
  });
  if(program.verbose) {
    console.info(`mergeBaseSha: ${mergeBaseSha}`);
    console.info(`commits length: ${commits.length}`);
  }
  const commitsByHash = {};
  for ( const commit of commits ) {
    commitsByHash[commit.sha] = commit;
  }
  const prs = [];
  const trackedCommits = trackCommits(mergeBaseSha, commitsByHash, commits[0]);
  if(program.verbose) {
    console.info(`trackedCommits length: ${trackedCommits.length}`);
  }
  for (const commit of trackedCommits) {
    const prno = getPRNo(commit);
    if(prno != null && prs.indexOf(prno) == -1) prs.push(prno);
  }
  if(prs.length == 0) {
    console.info('Pull Requests are not found.');
  }
  const requests = [];
  for (const prno of prs) {
    requests.push(prInfoRequest(repo, prno));
  }
  Promise.all(requests).then(listPRs);
};

const prsummary = (repo, base, head) => {
  if(program.verbose){
    console.info('verbose mode start:');
    console.info(`repo: ${repo} base: ${base} head: ${head}`);
    request.debug = true;
  }
  const ghrepo = client.repo(repo);
  compare(ghrepo, base, head).then( (response) => {
    const mergeBaseCommitSha = response.merge_base_commit.sha;
    if(program.verbose){
      console.info(`merge base: ${mergeBaseCommitSha}`);
    }
    const requests = [];
    for (let page = 1; page < 10 + 1; page++) {
      requests.push(commits(ghrepo, base, page));
    }
    const boundShowPRs = showPRs.bind(undefined, repo, mergeBaseCommitSha);
    Promise.all(requests).then(boundShowPRs);
  });
};

program.version('1.0.1')
  .usage('[options] <repo> <base> <head>')
  .option('-v, --verbose', 'show detail of requests')
  .action(prsummary);

program.parse(process.argv);

if(program.args.length < 3) {
  program.help();
}
