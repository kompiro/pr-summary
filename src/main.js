#!/usr/bin/env node
'use strict';

import program from 'commander';
import GitHubAPI from 'github';
import {GitHubClient} from './github_client';

import ejs from 'ejs';
import fs from 'fs';

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

      const templatePath = __dirname + '/release.ejs';
      const template = fs.readFileSync(templatePath, 'utf8');
      const body = ejs.render(template, { prInfo: prInfo });
      console.info(body);

    });
};

program.version('2.0.0').
  usage('<owner> <repo> <number>').
  action(prsummary);

program.parse(process.argv);

if(program.args.length < 3) {
  program.help();
}


