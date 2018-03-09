#!/usr/bin/env node
'use strict';

import 'babel-polyfill';
import { _ } from 'lodash';
import { Lokka } from 'lokka';
import { Transport } from 'lokka-transport-http';

export class GitHubGraphQL {

  static get TOTAL_COUNT_OF_COMMITS_QUERY() {
    return `
      query getAllCommitsCount($owner:String!, $repo:String!, $prNumber:Int!){
        repository(owner:$owner name:$repo) {
          pullRequest(number:$prNumber) {
            commits() {
              totalCount,
            }
          }
        }
      }
    `;
  }

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
            commits(first:$perPage, after:$after) {
              edges {
                cursor,
                node {
                  commit {
                    oid
                    author {
                      user {
                        login
                      }
                    },
                    committer {
                      name
                    },
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

  getAllCommitsFromPr(owner, repo, prNumber) {
    return this.getTotalCommits(owner, repo, prNumber).then(this.fetchCommits.bind(this));
  }

  fetchCommits(prInfo) {
    return this.fetchAllCommits(Promise.resolve(prInfo), prInfo);
  }

  fetchAllCommits(promise, prInfo) {
    return promise.then(() => {
      if (_.isUndefined(prInfo.cursor)) {
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
          const edges = pullRequest.commits.edges;
          const lastEdge = _.last(edges);
          prInfo.cursor = lastEdge ? lastEdge.cursor : null;
          prInfo.commits = _.union(
            prInfo.commits,
            _.map(edges, edge => {
              return edge.node.commit;
            })
          );
          resolve(prInfo);
        });
    });
  }

  getTotalCommits(owner, repo, prNumber) {
    return new Promise((resolve) => {
      const vars = {
        owner: owner,
        repo: repo,
        prNumber: prNumber
      };
      return this.client
        .query(GitHubGraphQL.TOTAL_COUNT_OF_COMMITS_QUERY, vars)
        .then(result => {
          const prInfo = Object.assign({}, vars, {
            totalCount: result.repository.pullRequest.commits.totalCount,
            commits: [],
            cursor: ''
          });
          resolve(prInfo);
        });
    });
  }
  
}
