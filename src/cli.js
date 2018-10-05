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

const PACKAGE_DIR = process.cwd();
const PACKAGE_BUILD = path.join(PACKAGE_DIR, '.build');
const PACKAGE_BUILD_TAR = path.join(PACKAGE_BUILD, 'package');
const pkg = require(path.join(PACKAGE_DIR, 'package.json'));

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
  const files = fs.readdirSync(PACKAGE_DIR);
  return files.filter(file => !blackList.includes(file));
};

/**
 * Build the package folder and copy the source files
 * @param {*} files
 */
const makePackageFolder = async files => {
  fs.mkdirSync(PACKAGE_BUILD);
  fs.mkdirSync(PACKAGE_BUILD_TAR);
  await Promise.all(
    files.map(file => {
      const from = path.join(PACKAGE_DIR, file);
      const to = path.join(PACKAGE_BUILD_TAR, file);
      return fs.copy(from, to);
    })
  );
};

const checkPackageExists = async () => {
  await s3.headObject().promise();
};

/**
 * Upload the package on S3
 * @param {*} tarFiles
 */
const uploadPackage = async (tarFiles, key) => {
  process.chdir(PACKAGE_BUILD);
  const pass = new PassThrough();
  tar.c({ gzip: true }, tarFiles).pipe(pass);
  const params = {
    Bucket: pkg.bucket.name,
    Key: key,
    Body: pass
  };
  await s3.upload(params).promise();
  process.chdir(PACKAGE_DIR);
};

/**
 * Publish the package on S3
 */
const publish = async () => {
  const { name, version } = pkg;
  if (!name || !version) {
    console.log(chalk.red('package must have name and version'));
    process.exit(1);
  }
  const key = `${name}-${version}.tgz`;
  console.log(chalk.green(`Package: ${name} version: ${version} will be published`));

  // clean previous build and copy all package files into the .build/package dir
  await remove(PACKAGE_BUILD);
  const packageFiles = listPackageFiles();
  await makePackageFolder(packageFiles);
  // upload package
  await uploadPackage([PACKAGE_BUILD], key);

  // clean the build
  await remove(PACKAGE_BUILD);
  console.log(chalk.green(`Package: ${name} version: ${version} published`));
};

publish().catch(err => {
  console.error(chalk.red(err));
});
