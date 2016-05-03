'use strict';

import octonode from 'octonode';
import 'babel-polyfill';

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const client = octonode.client(GITHUB_TOKEN);

const get = (path, opts) => {
  return new Promise((resolve, reject) => {
    client.get(path, opts, (err, status, body)=>{
      if (err) {
        reject(err);
      }
      resolve(body);
    });
  });
};

get('/user', {}).then((json) => {
  console.log(`got user: ${json.login}`);
});

const ghme = client.me();
ghme.repos((err, data) => {
  console.log(data);
});

const ghrepo = client.repo('pksunkara/octonode');

ghrepo.compare('1680fcc3d19e5e589e027273a6b719208831fe29', 'f190c62e353bd5a495bb59a419e64ea7f1e47d1d', (err, data) => {
  console.log(data);
});
ghrepo.commits(1, 1000, (err, data) => {
  const commits = data;
  console.log(`length: ${commits.length}`);
  for (const commit of commits) {
    console.log(commit.sha);
  }
});
