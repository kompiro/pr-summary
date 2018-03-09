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
    this.templatePath = template || __dirname + '/../templates/release.ejs';
  }

  prepareRelease(owner, repo, base, head) {
    return new Promise((resolve, reject) => {
      console.info(`prepareRelease: ${owner} ${repo} ${base} ${head}`);
      const title = `Prepare to deploy ${head} to ${base}`;
      return this.client.pullRequests.create({
        owner,
        repo,
        title,
        head,
        base
      }).then((res) => {
        const pr = res.data;
        return this.getPRInfo(owner, repo, parseInt(pr.number));
      }).then((prInfo) => {
        const template = fs.readFileSync(this.templatePath, 'utf8');
        const body = ejs.render(template, { prInfo: prInfo });
        this.client.pullRequests.update({
          owner,
          repo,
          base,
          number: prInfo.prNumber,
          body
        }).then((res) => {
          const pr = res.data;
          pr.commits = prInfo.commits;
          pr.contributors = prInfo.contributors;
          pr.prs = prInfo.prs;
          resolve(pr);
        }).catch(reject);
      }).catch(reject);
    });
  }

  getCommitsFromPullRequest(owner, repo, number) {
    return this.grahpql.getAllCommitsFrom(owner, repo, parseInt(number));
  }

  static get MAX_FETCH_PRS() {
    return 5000;
  }

  fetchPullRequests(owner, repo, prInfo) {
    return new Promise((resolve) => {
      console.info(`fetchPullRequests: ${owner} ${repo} ${prInfo}`);
      const shas = prInfo.commits.map((commit) => {
        return commit.oid;
      });
      this.grahpql.getPullRequests(owner, repo, prInfo.head, shas).then(
        (prs) => {
          const prsToDeploy = prs.pullRequests;

          prsToDeploy.sort((a, b) => {
            return new Date(a.merged_at) - new Date(b.merged_at);
          });
          prInfo.prs = prsToDeploy;

          resolve(prInfo);
        });
    });
  }

  getPRInfo(owner, repo, number) {
    console.info(`getPRInfo: ${owner} ${repo} ${number}`);
    return new Promise((resolve) => {
      this.getCommitsFromPullRequest(owner, repo, number).
      then(this.fetchPullRequests.bind(this, owner, repo)).
      then((prs) => {
        resolve(prs);
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
      }).then(pager).then((res)=>{
        const prs = res.data;
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

