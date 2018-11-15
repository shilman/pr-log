#!/usr/bin/env node

import program from 'commander';
import createGithubClient from '@octokit/rest';
import config from '../../package.json';
import createCliAgent from '../cli';
import path from 'path';
import prepend from 'prepend';
import promisify from 'util.promisify';
import ensureCleanLocalGitState from '../ensureCleanLocalGitState';
import getMergedPullRequestsFactory from '../getMergedPullRequests';
import createChangelogFactory from '../createChangelog';
import findRemoteAliasFactory from '../findRemoteAlias';
import git from 'git-promise';
import getPullRequestLabel from '../getPullRequestLabel';

program
    .version(config.version)
    .option('--sloppy', 'Skip ensuring clean local git state.')
    .option('--trace', 'Show stack traces for any error.')
    .option('--cherry-pick', 'Use cherry-picks instead of PR merges.')
    .option('--since-prerelease', 'Only consider prereleases in the "last changelog" calculation.')
    .usage('<version-number>')
    .parse(process.argv);

// eslint-disable-next-line no-process-env
const { GH_TOKEN } = process.env;

const changelogPath = path.join(process.cwd(), 'CHANGELOG.md');
const { sloppy, cherryPick, sincePrerelease } = program;
const options = { sloppy, cherryPick, sincePrerelease, changelogPath };
const findRemoteAlias = findRemoteAliasFactory({ git });
const githubClient = createGithubClient();
if (GH_TOKEN) {
    githubClient.authenticate({ type: 'token', token: GH_TOKEN });
}
const getMergedPullRequests = getMergedPullRequestsFactory({ githubClient, git, getPullRequestLabel });
const getCurrentDate = () => new Date();
const packageInfo = require(path.join(process.cwd(), 'package.json'));
const dependencies = {
    githubClient,
    prependFile: promisify(prepend),
    packageInfo,
    ensureCleanLocalGitState: ensureCleanLocalGitState({ git, findRemoteAlias }),
    getMergedPullRequests,
    createChangelog: createChangelogFactory({ getCurrentDate, packageInfo })
};
const cliAgent = createCliAgent(dependencies);

cliAgent
    .run(program.args[0], options, dependencies)
    .catch((error) => {
        let message = `Error: ${error.message}`;

        if (program.trace) {
            message = error.stack;
        }

        // eslint-disable-next-line no-console, no-warning-comments
        console.error(message);
        process.exitCode = 1;
    });
