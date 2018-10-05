#!/usr/bin/env node
/**
 * For now the bucket is public
 * This must be secured later
 */
const fs = require('fs-extra');
const path = require('path');
const { PassThrough } = require('stream');

const chalk = require('chalk');
const rimraf = require('rimraf');
const tar = require('tar');
const AWS = require('aws-sdk');
const pkg = require('../package.json');

const s3 = new AWS.S3();

/**
 * Clean a directory
 * @param {*} path
 */
const remove = path =>
  new Promise((resolve, reject) => {
    rimraf(path, err => {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });

/**
 * Give the list of file to includes into the package
 * @param {*} blackList
 */
const listPackageFiles = (blackList = ['node_modules']) => {
  const cwd = process.cwd();
  const files = fs.readdirSync(cwd);
  return files.filter(file => !blackList.includes(file));
};

/**
 * Build the package folder and copy the source files
 * @param {*} files
 */
const makePackageFolder = async files => {
  const cwd = process.cwd();
  const packageBuild = path.join(cwd, '.build');
  const packageBase = path.join(packageBuild, 'package');
  fs.mkdirSync(packageBuild);
  fs.mkdirSync(packageBase);
  await Promise.all(
    files.map(file => {
      const from = path.join(cwd, file);
      const to = path.join(packageBase, file);
      return fs.copy(from, to);
    })
  );
};

/**
 * Upload the package on S3
 * @param {*} packageBuild
 * @param {*} tarFiles
 */
const uploadPackage = async (packageBuild, tarFiles) => {
  const { name, version } = pkg;
  const key = `${name}-${version}.tgz`;
  process.chdir(packageBuild);
  const pass = new PassThrough();
  tar.c({ gzip: true }, tarFiles).pipe(pass);
  const params = {
    Bucket: pkg.bucket.name,
    Key: key,
    Body: pass
  };
  await s3.upload(params).promise();
};

/**
 * Publish the package on S3
 */
const publish = async () => {
  const { name, version } = pkg;
  if (!name || !version) {
    console.log('package must have name and version');
    process.exit(1);
  }
  const key = `${name}-${version}.tgz`;
  console.log(chalk.green(`Package: ${name} version: ${version} will be published`));

  // clean previous build and copy all package files into the .build/package dir
  const packageBuild = path.join(process.cwd(), '.build');
  await remove(packageBuild);
  const packageFiles = listPackageFiles();
  await makePackageFolder(packageFiles);
  // upload package
  await uploadPackage(packageBuild, ['package']);

  // clean the build
  await remove(packageBuild);
  console.log(chalk.green(`Package: ${name} version: ${version} published`));
};

publish()
  .catch(err => {
    console.error(chalk.red(err));
  });
