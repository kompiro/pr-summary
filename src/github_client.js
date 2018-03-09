#!/usr/bin/env node
'use strict';

import 'babel-polyfill';
import ejs from 'ejs';
import fs from 'fs';
import moment from 'moment';

export class GitHubClient {

  constructor(client, graphql, template) {
    this.client = client;
    this.grahpql = graphql;
    this.templatePath = template || __dirname + '../templates/release.ejs';
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
    return this.grahpql.getAllCommitsFromPr(owner, repo, parseInt(number));
  }

  static get MAX_FETCH_PRS() {
    return 5000;
  }

  fetchPullRequests(owner, repo, prInfo) {
    return new Promise((resolve) => {
      const shas = prInfo.commits.map((commit) => {
        return commit.oid;
      });
      const prs = [];
      let headFound = false;
      const pager = (res) => {
        const fetchedPRs = res.data;
        const mergeShas = fetchedPRs.map((pr) => {
          return pr.merge_commit_sha;
        });
        const findHead = mergeShas.includes(prInfo.head_sha);
        if (findHead) {
          headFound = true;
        }
        Array.prototype.push.apply(prs, fetchedPRs);
        const needNext = !headFound;
        if (this.client.hasNextPage(res) && ( needNext || prs.length < GitHubClient.MAX_FETCH_PRS)) {
          return this.client.getNextPage(res).then(pager);
        }
        return prs;
      };
      this.client.pullRequests.getAll({
        owner,
        repo,
        base: prInfo.head, // マージしたPR
        state: 'closed',
        sort: 'updated',
        direction: 'desc',
        per_page: 100
      }).then(pager).then((prs) => {
        console.log(prs);
        const mergedPRs = prs.filter((pr) => {
          return pr.merged_at !== null;
        });

        const prsToDeploy = mergedPRs.reduce((result, pr) => {
          // PRのハッシュが今回のデプロイPRのハッシュに含まれていたら追加
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

  parseCommits(prInfo) {
    const commits = prInfo.commits;
    const contributors = [];
    commits.map((commit) => {
      let user;
      const author = commit.author;
      if (author) {
        user = author.user.login;
      } else {
        const gitCommit = commit.commiter;
        user = gitCommit.author.name;
      }
      if (contributors.includes(user) === false && user.trim() !== '') {
        contributors.push(user);
      }
    });
    prInfo.contributors = contributors;
    return Promise.resolve(prInfo);
  }

  getPRInfo(owner, repo, number) {
    return new Promise((resolve) => {
      const prInfo = {
        owner,
        repo,
        number
      };
      this.getCommitsFromPullRequest(owner, repo, number).
      then(this.parseCommits).
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

  getDailyPRs(owner, repo, opts) {
    const fetchLength = opts.length ? opts.length : 300;
    return new Promise((resolve) => {
      const prs = [];
      const pager = (res) => {
        Array.prototype.push.apply(prs, res);
        if (this.client.hasNextPage(res) && prs.length < fetchLength + 1) {
          return this.client.getNextPage(res).then(pager);
        }
        return prs;
      };
      this.client.pullRequests.getAll({
        owner,
        repo,
        state: 'all',
        sort: 'updated',
        direction: 'desc',
        per_page: 100
      }).then(pager).then((prs)=>{
        const date = opts.date;
        let targetDate = moment();
        if(date === 'yesterday') {
          targetDate = targetDate.subtract(1, 'days');
        }else if(date !== 'today') {
          targetDate = moment(date);
        }
        const filteredDate = targetDate.format('YYYY-MM-DD');
        const resultPRs = {
          filteredDate,
          owner: {
            open: [],
            merged: [],
            closed: []
          },
          assigned: {
            open: [],
            merged: [],
            closed: []
          },
          all: {
            open: [],
            merged: [],
            closed: []
          }
        };
        prs.forEach((pr) => {
          const user = opts.user;
          const isUpdatedDate = moment(pr.updated_at).format('YYYY-MM-DD') === filteredDate;
          const isAssigned = pr.assignee && user === pr.assignee.login;
          const isOwned = pr.user && user === pr.user.login;

          const classifyState = (container ,pr) => {
            if (pr.state === 'open') {
              container.open.push(pr);
            } else if (pr.merged_at) {
              container.merged.push(pr);
            } else {
              container.closed.push(pr);
            }
          };

          if(isUpdatedDate) {
            const all = resultPRs.all;
            classifyState(all, pr);
            if(isAssigned){
              const assigned = resultPRs.assigned;
              classifyState(assigned ,pr);
            }
            if(isOwned) {
              const owner = resultPRs.owner;
              classifyState(owner ,pr);
            }
          }
        });
        resolve(resultPRs);
      });
    });
  }
}

