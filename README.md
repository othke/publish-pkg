# Publish a npm package to a S3 Bucket

This package is a helper to publish npm package to a S3 Bucket.

## Setup

```bash
npm install -g publish-pkg
```

## How it works

You should set the s3 bucket name into the **package.json** of your package like that

```json
"bucket": {
    "name": "repo-npm.dev"
  }
```

Then you can execute this command to publish your package. This command should be execute at the root of the package

```bash
publish-pkg
```

Your package will have the following name:

```bash
https://s3-eu-west-1.amazonaws.com/{your-bucket-name}/{package-name}-{version}.tgz
```

Your users should have a public read access on the bucket. So You need to configure your s3 bucket consequently.

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AddPerm",
      "Effect": "Allow",
      "Principal": "*",
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::your-bucket/*"]
    }
  ]
}
```
