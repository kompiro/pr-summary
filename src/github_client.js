#!/usr/bin/env node
'use strict';

import 'babel-polyfill';
import ejs from 'ejs';
import fs from 'fs';

export class GitHubClient {

  constructor(client, template) {
    this.client = client;
    this.templatePath = template || __dirname + '/release.ejs';
  }

  prepareRelease(owner, repo, base, head) {
    return new Promise((resolve, reject) => {
      const title = `Prepare to deploy ${head} to ${base}`;
      return this.client.pullRequests.create({
        owner,
        repo,
        title,
        head,
        base
      }).then((pr) => {
        return this.getPRInfo(owner, repo, pr.number);
      }).then((prInfo) => {
        const template = fs.readFileSync(this.templatePath, 'utf8');
        const body = ejs.render(template, { prInfo: prInfo });
        this.client.pullRequests.update({
          owner,
          repo,
          base,
          number: prInfo.number,
          body
        }).then((pr) => {
          pr.commits = prInfo.commits;
          pr.contributors = prInfo.contributors;
          pr.prs = prInfo.prs;
          resolve(pr);
        }).catch(reject);
      }).catch(reject);
    });
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
          const contributors = [];
          commits.map((commit) => {
            let user;
            const author = commit.author;
            if (author) {
              user = author.login;
            } else {
              const gitCommit = commit.commit;
              user = gitCommit.author.name;
            }
            if (contributors.includes(user) === false && user.trim() !== '') {
              contributors.push(user);
            }
          });
          prInfo.contributors = contributors;
          return commits;
        }).
        then(this.fetchPullRequests.bind(this, owner, repo)).
        then((prs) => {
          prInfo.prs = prs;
          resolve(prInfo);
        }).
        catch((err)=> {
          console.error(err.message);
        });
    });
  }
}

