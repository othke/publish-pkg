# Publish a npm package to a S3 Bucket

This package is a helper to publish npm package to a S3 Bucket.
This is **less convenient than use npm repository** but if we want to keep some packages out of the public this is a quick and functionnal **workaround** usinng only S3 and no database.

## Install

```bash
# You can install this package globally to avoid installing it for all your privates packages. 
npm install -g publish-pkg-s3
```

## How it works

You should execute the script in a root package directory. The script will list all the directories and files inside the package directory excepted the node_modules directory.

Then it will targz the content of the package and upload it on your S3 bucket. The name of the package and the version are picked into your **package.json**. If a the same version already exists the script will not upload your package except you ask it to force the upload.

```bash
# upload a package
publish-package-s3 publish <bucketName>

# output
# Package: packageName version: 1.0.0 will be published
# Package: packageName version: 1.0.0 published
# URL: https://s3.<region>.amazonaws.com/<bucket>/<package>-<version>.tgz

# upload force a package
publish-package-s3 publish <bucketName> --force

# list already uploaded packages with the same name
publish-package-s3 name <bucketName>
```

You can use npm link to check that your package work well before upload your package on S3.
See [npm link](https://docs.npmjs.com/cli/link).