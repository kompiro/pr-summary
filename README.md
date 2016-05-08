# pr-summary

## What's this?

`pr-summary` is a command to summarize merged Pull Requests between specified refs. 
This command uses only GitHub API and made it by node.js(ES2015).

## System Requirement

node 4.2.X

## How to setup?

1. This package provided as npm package. You can install this command by `npm install -g pr-summary`
2. [Get your GitHub access token](https://github.com/settings/tokens).
3. Set the access token as Environment Variable `GITHUB_TOKEN`
4. `$ pr-summary <repo> <base> <head>`
