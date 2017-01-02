#!/usr/bin/env node
'use strict';

import 'babel-polyfill';

export class GitHubClient {

  constructor(client) {
    this.client = client;
  }

  prepareRelease(owner, repo, base, head) {
    const title = `Prepare to deploy ${base} to ${head}`;
    this.client.pullRequests.create({
      owner,
      repo,
      title,
      head,
      base
    }).then((pr) => {
      return this.getPRInfo(owner, repo, pr.number);
    }).then((prInfo) => {
      const body = this.renderBody(prInfo);
      return this.client.pullRequests.update({
        owner,
        repo,
        number: prInfo.number,
        body
      });
    }).then((pr) => {
      console.info(`created: ${pr.html_url}`);
    });
  }

  renderBody(prInfo) {
    let body = '## Contributors\n';
    const rendered = [];
    prInfo.commits.map((commit) => {
      const user = commit.author.login;
      if (rendered.includes(user) === false && user.trim() !== '') {
        body += `${user}\n`;
        rendered.push(user);
      }
    });

    body += '\n';

    body += '## Pull Requests\n';
    prInfo.prs.map((pr) => {
      body += `#${pr.number} ${pr.title} by ${pr.user.login}`;
    });

    return body;
  }

  getCommitsFromPullRequest(owner, repo, number) {
    const commits = [];
    const pager = (res) => {
      Array.prototype.push.apply(commits, res);
      if (this.client.hasNextPage(res)) {
        return this.client.getNextPage(res).then(pager);
      }
      return commits;
    };
    return this.client.pullRequests.getCommits({
      owner,
      repo,
      number
    }).then(pager);
  }

  fetchPullRequests(owner, repo, commits) {
    return new Promise((resolve) => {
      const shas = commits.map((commit) => {
        return commit.sha;
      });
      this.client.pullRequests.getAll({
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
  }

  getPRInfo(owner, repo, number) {
    return new Promise((resolve) => {
      const prInfo = {
        owner,
        repo,
        number
      };
      this.getCommitsFromPullRequest(owner, repo, number).
        then((commits) => {
          prInfo.commits = commits;
          return commits;
        }).
        then(this.fetchPullRequests.bind(this, owner, repo)).
        then((prs) => {
          prInfo.prs = prs;
          resolve(prInfo);
        });
    });
  }
}

