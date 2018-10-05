#!/usr/bin/env node
/**
 * For now the bucket is public
 * This must be secured later
 */
const fs = require('fs-extra');
const path = require('path');
const { PassThrough } = require('stream');

const program = require('commander');
const chalk = require('chalk');
const rimraf = require('rimraf');
const tar = require('tar');
const AWS = require('aws-sdk');

const BUILD_NAME = '.build';
const PACKAGE_NAME = 'package';

const PACKAGE_ROOT_DIR = process.cwd();
const PACKAGE_BUILD_DIR = path.join(PACKAGE_ROOT_DIR, BUILD_NAME);
const PACKAGE_BUILD_TAR_DIR = path.join(PACKAGE_BUILD_DIR, PACKAGE_NAME);
const PKG = require(path.join(PACKAGE_ROOT_DIR, 'package.json'));

const PKG_FORMAT_REGEX = /^([\w-]*)-(\d.\d.\d)(.tgz)$/;
const s3 = new AWS.S3();

/**
 * Remove a directory
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
 * List the files to include into the package
 * @param {*} blackList
 */
const listPackageFiles = (blackList = ['node_modules']) => {
  const files = fs.readdirSync(PACKAGE_ROOT_DIR);
  return files.filter(file => !blackList.includes(file));
};

/**
 * Build the package folder and copy the source files
 * @param {*} files
 */
const buildPackageDirectory = async files => {
  fs.mkdirSync(PACKAGE_BUILD_DIR);
  fs.mkdirSync(PACKAGE_BUILD_TAR_DIR);
  await Promise.all(
    files.map(file => {
      const from = path.join(PACKAGE_ROOT_DIR, file);
      const to = path.join(PACKAGE_BUILD_TAR_DIR, file);
      return fs.copy(from, to);
    })
  );
};

const checkPackageAlreadyExists = async (bucketName, key) => {
  try {
    const params = {
      Bucket: bucketName,
      Key: key
    };
    await s3.headObject(params).promise();
    return true;
  } catch (err) {
    return false;
  }
};

/**
 * List all packages version with the given name
 * @param {*} bucketName
 * @param {*} keyPrefix
 */
const listObjects = async (bucketName, keyPrefix) => {
  let pkg = [];
  const fetchObjects = async marker => {
    const params = {
      Bucket: bucketName,
      Marker: marker || undefined
    };
    const {
      IsTruncated: hasNext,
      NextMarker: nextMarker,
      Contents: contents
    } = await s3.listObjects(params).promise();
    const samePackage = contents.filter(({ Key }) => {
      const [full, name, version] = PKG_FORMAT_REGEX.exec(Key);
      return name === keyPrefix;
    });
    pkg = pkg.concat(samePackage);
    if (hasNext) {
      pkg = pkg.concat(await fetch(nextMarker));
    }
    return pkg;
  };
  return await fetchObjects();
};

/**
 * Upload the package on S3
 * @param {*} tarFiles
 */
const uploadPackage = async (tarFiles, bucketName, key) => {
  process.chdir(PACKAGE_BUILD_DIR);
  const pass = new PassThrough();
  tar.c({ gzip: true }, tarFiles).pipe(pass);
  const params = {
    Bucket: bucketName,
    Key: key,
    Body: pass
  };
  const pkg = await s3.upload(params).promise();
  process.chdir(PACKAGE_ROOT_DIR);
  return pkg;
};

/**
 * Publish the package on S3
 */
const publish = async (bucketName, force) => {
  const { name, version } = PKG;
  if (!name || !version) {
    console.log(chalk.red('package must have name and version'));
    process.exit(1);
  }
  const key = `${name}-${version}.tgz`;
  const exists = await checkPackageAlreadyExists(bucketName, key);
  if (exists && !force) {
    console.log(chalk.red(`Package: ${name} version: ${version} already exists`));
    console.log(chalk.red(`use --force argument to override the package`));
    process.exit(1);
  }
  console.log(chalk.green(`Package: ${name} version: ${version} will be published`));

  // clean previous build and copy all package files into the .build/package dir
  await remove(PACKAGE_BUILD_DIR);
  const packageFiles = listPackageFiles();
  await buildPackageDirectory(packageFiles);
  // upload package
  const pkg = await uploadPackage([PACKAGE_NAME], bucketName, key);

  // clean the build
  await remove(PACKAGE_BUILD_DIR);
  console.log(chalk.green(`Package: ${name} version: ${version} published`));
  console.log(chalk.green(`URL: ${pkg.Location}`));
};

/**
 * List all versions of the current package
 */
const list = async bucketName => {
  const { name, version } = PKG;
  if (!name || !version) {
    console.log(chalk.red('package must have name and version'));
    process.exit(1);
  }
  const existingPackage = await listObjects(bucketName, name);
  existingPackage.map(pkg => {
    console.log(chalk.green(`Name: ${pkg.Key}`));
    console.log(chalk.green(`Last Modification: ${pkg.LastModified}`));
    console.log('');
  });
};

program.version(PKG.version).description(PKG.description);
program
  .command('publish <bucketName>')
  .option('-f, --force', 'Force override package')
  .description('Publish a package')
  .action((bucketName, cmd) => {
    publish(bucketName, cmd.force).catch(err => {
      console.error(chalk.red(err));
    });
  });

program
  .command('list <bucketName>')
  .description('List all versions of the current package')
  .action((bucketName, cmd) => {
    list(bucketName).catch(err => {
      console.error(chalk.red(err));
    });
  });

program.parse(process.argv);
