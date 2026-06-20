require('dotenv').config({ path: __dirname + '/../.env' });
const https = require('https');
const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { isS3Configured, buildPublicUrl, getS3Client } = require('../modules/shared/s3.service');

function probeUrl(url) {
  return new Promise((resolve) => {
    const request = https.get(url, { timeout: 15000 }, (response) => {
      let body = '';
      response.on('data', (chunk) => {
        body += chunk;
      });
      response.on('end', () => {
        resolve({
          statusCode: response.statusCode,
          contentType: response.headers['content-type'] || null,
          body: body.slice(0, 200),
        });
      });
    });
    request.on('timeout', () => {
      request.destroy();
      resolve({ statusCode: null, error: 'timeout' });
    });
    request.on('error', (error) => {
      resolve({ statusCode: null, error: error.message });
    });
  });
}

async function main() {
  if (!isS3Configured()) {
    console.error('Set AWS_S3_BUCKET and AWS_CLOUDFRONT_URL in server/.env');
    process.exit(1);
  }

  const bucket = process.env.AWS_S3_BUCKET;
  const key = `profiles/_verify-${Date.now()}.txt`;
  const body = 'docnet-cloudfront-verify';
  const url = buildPublicUrl(key);

  console.log('Uploading test object via SDK (same path as profile photos)...');
  await getS3Client().send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: 'text/plain',
      CacheControl: 'public, max-age=60',
    })
  );
  console.log('Uploaded:', key);
  console.log('CloudFront URL:', url);

  console.log('\nProbing CloudFront (wait a few seconds if first attempt fails)...');
  let probe = await probeUrl(url);
  if (probe.statusCode === 403) {
    await new Promise((r) => setTimeout(r, 3000));
    probe = await probeUrl(url);
  }

  console.log('HTTP status:', probe.statusCode);
  console.log('Content-Type:', probe.contentType);
  if (probe.body) console.log('Body preview:', probe.body);

  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: bucket,
      Key: key,
    })
  );
  console.log('\nCleaned up test object.');

  if (probe.statusCode === 200) {
    console.log('\nPASS — CloudFront can read objects from S3. OAC is working.');
    console.log('If user photos still fail, the PNG key in MongoDB may not exist in S3 — re-upload.');
    process.exit(0);
  }

  console.log('\nFAIL — CloudFront still returns', probe.statusCode || probe.error);
  console.log('Bucket policy text is fine. Fix CloudFront origin OAC:');
  console.log('  1. Distribution E1QLA2DVTSGPOC → Origins → edit S3 origin');
  console.log('  2. Domain: docnet-profile-photos-akash-prod.s3.ap-south-1.amazonaws.com');
  console.log('  3. Origin access: OAC with Sign requests = Yes');
  console.log('  4. Wait until distribution status = Deployed, then run this script again.');
  process.exit(1);
}

main().catch((error) => {
  console.error('Verify failed:', error.message);
  process.exit(1);
});
