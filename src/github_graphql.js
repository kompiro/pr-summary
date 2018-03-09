#!/usr/bin/env node
'use strict';

import 'babel-polyfill';
import { _ } from 'lodash';
import { Lokka } from 'lokka';
import { Transport } from 'lokka-transport-http';

export class GitHubGraphQL {

  static get COMMITS_OF_PULL_REQUEST_QUERY() {
    return `
      query getAllCommit($owner:String!, $repo:String!, $prNumber:Int!, $perPage:Int!, $after:String!){
        repository(owner:$owner, name:$repo) {
          pullRequest(number:$prNumber) {
            headRepository {
              nameWithOwner
            },
            headRefName,
            headRef {
              target {
                oid
              }
            }
            baseRefName,
            baseRef {
              target {
                oid
              }
            }
            participants(first: 100){
              nodes {
                login
              }
            }
            commits(first:$perPage, after:$after) {
              edges {
                cursor,
                node {
                  commit {
                    oid,
                    committedDate,
                    message,
                  }
                }
              }
            }
          }
        }
      }
    `;
  }

  static get PULL_REQUESTS_QUERY() {
    return `
      query($owner: String!, $repo: String!, $base: String!, $after: String) {
        repository (owner: $owner, name: $repo){
          pullRequests(
            first: 100,
            after: $after,
            orderBy: { field: UPDATED_AT, direction: DESC },
            baseRefName: $base,
            states: MERGED) {
            nodes {
              number
              title
              mergeCommit {
                oid
              }
              mergedAt
              participants(first: 100) {
                nodes {
                  login
                }
              }
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
            }
          }
        }
      }`;
  }

  constructor(token) {
    const headers = {
      Authorization: `bearer ${token}`
    };
    this.client = new Lokka({
      transport: new Transport('https://api.github.com/graphql', {
        headers
      })
    });
  }

  getAllCommitsFrom(owner, repo, prNumber) {
    return this.fetchCommits({
      owner,
      repo,
      prNumber,
      commits: [],
      cursor: ''
    });
  }

  fetchCommits(prInfo) {
    return this.fetchAllCommits(Promise.resolve(prInfo), prInfo);
  }

  fetchAllCommits(promise, prInfo) {
    return promise.then(() => {
      // 完了したら cursor は null になる
      if (prInfo.cursor === null) {
        return Promise.resolve(prInfo);
      }
      return this.fetchAllCommits(this.fetchNextCommits(prInfo), prInfo);
    });
  }

  fetchNextCommits(prInfo) {
    return new Promise((resolve) => {
      const vars = {
        owner: prInfo.owner,
        repo: prInfo.repo,
        prNumber: prInfo.prNumber,
        perPage: 100,
        after: prInfo.cursor ? prInfo.cursor : ''
      };
      return this.client
        .query(GitHubGraphQL.COMMITS_OF_PULL_REQUEST_QUERY, vars)
        .then(result => {
          const pullRequest =result.repository.pullRequest;
          prInfo.head = pullRequest.headRefName;
          prInfo.head_sha = pullRequest.headRef.target.oid;
          prInfo.base = pullRequest.baseRefName;
          prInfo.base_sha = pullRequest.baseRef.target.oid;
          prInfo.contributors = pullRequest.participants.nodes.map((node) => node.login );
          const edges = pullRequest.commits.edges;
          const fetchedCommits = edges.map((edge) => edge.node.commit );
          const lastEdge = _.last(edges);
          prInfo.cursor = lastEdge ? lastEdge.cursor : null;
          prInfo.commits = _.union( prInfo.commits, fetchedCommits );
          resolve(prInfo);
        });
    });
  }

  getPullRequests(owner, repo, base, shas) {
    return this.fetchPullRequests({
      owner,
      repo,
      base,
      shas,
      rangeStart: false,
      rangeEnd: false,
      pullRequests: [],
      cursor: null
    });
  }

  fetchPullRequests(prs) {
    return this.fetchAllPullRequests(Promise.resolve(prs), prs);
  }

  fetchAllPullRequests(promise, prs) {
    return promise.then(() => {
      // PR の方は当該PRのマージコミットがPRのページに見つかったら取得する
      if (prs.rangeEnd) {
        return Promise.resolve(prs);
      }
      return this.fetchAllPullRequests(this.fetchNextPullRequests(prs), prs);
    });
  }

  fetchNextPullRequests(prs) {
    return new Promise((resolve) => {
      const vars = {
        owner: prs.owner,
        repo: prs.repo,
        base: prs.base,
        after: prs.cursor ? prs.cursor : null
      };
      return this.client
        .query(GitHubGraphQL.PULL_REQUESTS_QUERY, vars)
        .then(result => {
          const pullRequests = result.repository.pullRequests;
          const nodes = pullRequests.nodes;
          const shas = prs.shas;
          prs.cursor = pullRequests.pageInfo.endCursor;
          const mergedPRs = _.filter(nodes, (node) => {
            return node.mergeCommit && shas.includes(node.mergeCommit.oid);
          });
          if(mergedPRs.length > 0) {
            prs.pullRequests = _.union( prs.pullRequests, mergedPRs);
            prs.rangeStart = true;
          } else {
            if(prs.rangeStart) {
              prs.rangeEnd = true;
            }
          }
          resolve(prs);
        });
    });
  }
}
