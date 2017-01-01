#!/usr/bin/env node
'use strict';

import program from 'commander';
import {getPRInfo} from './pr-summary';

const prsummary = (owner, repo, number) => {
  getPRInfo(owner, repo, number).
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
        if (pr.pull_request) {
          const message = `#${pr.number} ${pr.title} by ${pr.user.login}`;
          console.info(message);
        }
      });
    });
};

program.version('2.0.0').
  usage('<owner> <repo> <number>').
  action(prsummary);

program.parse(process.argv);

if(program.args.length < 3) {
  program.help();
}


