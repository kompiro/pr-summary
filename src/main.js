#!/usr/bin/env node
'use strict';

import program from 'commander';
import GitHubAPI from 'github';
import {GitHubClient} from './github_client';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
if (!GITHUB_TOKEN) {
  console.error(
`You must set Environment Variable: GITHUB_TOKEN.
Get the token at https://github.com/settings/tokens.`
  );
  process.exit(1);
}

const prsummary = (owner, repo, number) => {
  const client = new GitHubAPI();

  client.authenticate({
    type: 'token',
    token: GITHUB_TOKEN
  });

  const ghClient = new GitHubClient(client);
  ghClient.getPRInfo(owner, repo, number).
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
        const message = `#${pr.number} ${pr.title} by ${pr.user.login}`;
        console.info(message);
      });
    });
};

program.version('2.0.0').
  usage('pr-summary <owner> <repo> <number>').
  action(prsummary);

program.parse(process.argv);

if(program.args.length < 3) {
  program.help();
}


