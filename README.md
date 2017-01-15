# pr-summary

[![npm version](https://badge.fury.io/js/pr-summary.svg)](https://badge.fury.io/js/pr-summary)

`pr-summary` is a command to summarize merged Pull Requests between specified refs.

## Getting Started

### Prerequisites

node.js 6.X.

### Install

1. This package provided as npm package. You can install this command by `npm install -g pr-summary`
2. [Get your GitHub access token](https://github.com/settings/tokens).
3. Set the access token as Environment Variable `GITHUB_TOKEN`

### Commands

```shell
 $ prs --help

  Usage: prs [options] [command]

  Commands:

    prepare-release   Create to prepare release PR
    pr-info           List PRs in specified PR
    help [cmd]        display help for [cmd]

  Options:

    -h, --help     output usage information
    -V, --version  output the version number
```

#### pr-info(default)

```
  Usage: prs pr-info <owner> <repo> <number>

  Options:

    -h, --help  output usage information

  Arguments:

    owner:  Repository owner
    repo:   Repository name
    number: Pull Request number

  Example:

    prs pr-info kompiro pr-summary 3
```

#### prepare-release

```
  Usage: prs prepare-release <owner> <repo> <base> <head>

  Options:

    -h, --help  output usage information

  Arguments:

    owner:  Repository owner
    repo:   Repository name
    base:   Base branch to merge [ex: master]
    base:   Head branch to merge [ex: develop]

  Example:

    prs prepare-release kompiro pr-summary master develop
```


## Running the tests

Currently this command doesn't contiain tests.

### And coding style tests

This command contains `.eslintrc.js`. You can check the style by `eslint`

## Built With

* [babel](https://github.com/babel/babel)
* [overcommit](https://github.com/brigade/overcommit)

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests to us.

## Versioning

We use [SemVer](http://semver.org/) for versioning. For the versions available, see the [tags on this repository](https://github.com/kompiro/pr-summary/tags).

## Authors

* **Hiroki Kondo** - *Initial work* - [kompiro](https://github.com/kompiro)

See also the list of [contributors](https://github.com/kompiro/pr-summry/contributors) who participated in this project.

## License

This project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details
