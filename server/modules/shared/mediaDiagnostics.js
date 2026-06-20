const https = require('https');
const { ListObjectsV2Command } = require('@aws-sdk/client-s3');
const User = require('../auth/models/User');
const {
  isS3Configured,
  buildPublicUrl,
  getS3Client,
} = require('./s3.service');

function normalizeCloudFrontUrl(value) {
  const trimmed = (value || '').trim().replace(/\/$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function probeUrl(url) {
  return new Promise((resolve) => {
    const request = https.get(url, { timeout: 10000 }, (response) => {
      response.resume();
      resolve({
        url,
        statusCode: response.statusCode,
        contentType: response.headers['content-type'] || null,
      });
    });

    request.on('timeout', () => {
      request.destroy();
      resolve({ url, statusCode: null, error: 'timeout' });
    });

    request.on('error', (error) => {
      resolve({ url, statusCode: null, error: error.message });
    });
  });
}

function describeClientUrl(storedUrl, clientBaseUrl = 'http://3.7.48.54') {
  if (!storedUrl) return null;

  if (/^https?:\/\//i.test(storedUrl)) {
    return { storedUrl, browserWouldRequest: storedUrl, looksCorrect: true };
  }

  const normalized = storedUrl.startsWith('/') ? storedUrl : `/${storedUrl}`;
  return {
    storedUrl,
    browserWouldRequest: `${clientBaseUrl}${normalized}`,
    looksCorrect: false,
    hint: 'Client prepends app server URL because stored value is not an absolute https:// URL.',
  };
}

async function runProfileMediaDiagnostics() {
  const bucket = process.env.AWS_S3_BUCKET || null;
  const cloudfrontUrl = normalizeCloudFrontUrl(process.env.AWS_CLOUDFRONT_URL);
  const region = process.env.AWS_REGION || 'ap-south-1';

  const result = {
    s3Configured: isS3Configured(),
    bucket,
    cloudfrontUrl,
    region,
    sampleObject: null,
    cloudFrontProbe: null,
    sampleUserPhoto: null,
    likelyIssues: [],
  };

  if (!result.s3Configured) {
    result.likelyIssues.push('AWS_S3_BUCKET or AWS_CLOUDFRONT_URL missing in server/.env');
    return result;
  }

  if (!/^https:\/\//i.test(process.env.AWS_CLOUDFRONT_URL || '')) {
    result.likelyIssues.push(
      'AWS_CLOUDFRONT_URL is missing https:// — new uploads save protocol-less URLs that break the deployed client.'
    );
  }

  try {
    const listed = await getS3Client().send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: 'profiles/',
        MaxKeys: 1,
      })
    );

    const sampleKey = listed.Contents?.[0]?.Key || null;
    if (!sampleKey) {
      result.likelyIssues.push('No objects under profiles/ in S3 — upload a photo first.');
    } else {
      const publicUrl = buildPublicUrl(sampleKey);
      result.sampleObject = { key: sampleKey, publicUrl };
      result.cloudFrontProbe = await probeUrl(publicUrl);

      if (result.cloudFrontProbe.statusCode === 200) {
        result.verdict = 'CloudFront can read S3 objects. If photos still fail in the app, fix the client build / stored URLs.';
      } else if (result.cloudFrontProbe.statusCode === 403) {
        result.verdict = 'CloudFront returns 403 for a real S3 object — OAC bucket policy or origin config is still wrong.';
        result.likelyIssues.push(
          'Verify S3 bucket policy AWS:SourceArn matches the distribution that serves ' + cloudfrontUrl
        );
      } else {
        result.verdict = `Unexpected CloudFront response (${result.cloudFrontProbe.statusCode || result.cloudFrontProbe.error}).`;
      }
    }
  } catch (error) {
    result.s3ListError = error.message;
    result.likelyIssues.push(`Could not list S3 objects: ${error.message}`);
  }

  try {
    const user = await User.findOne({
      profilePicture: { $type: 'string', $ne: '' },
    })
      .select('profilePicture')
      .lean();

    if (user?.profilePicture) {
      const clientBase = (process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
      result.sampleUserPhoto = {
        storedInDatabase: user.profilePicture,
        clientResolution: describeClientUrl(user.profilePicture, clientBase),
      };

      if (!result.sampleUserPhoto.clientResolution.looksCorrect) {
        result.likelyIssues.push(
          'Database has a non-absolute profile URL — rebuild client and run node scripts/fixProfilePhotoUrls.js'
        );
      }

      if (result.sampleUserPhoto.clientResolution.looksCorrect) {
        result.userPhotoProbe = await probeUrl(user.profilePicture);
      } else if (result.sampleUserPhoto.clientResolution.browserWouldRequest) {
        result.userPhotoProbe = await probeUrl(result.sampleUserPhoto.clientResolution.browserWouldRequest);
      }
    }
  } catch (error) {
    result.userLookupError = error.message;
  }

  if (result.likelyIssues.length === 0 && result.verdict?.includes('CloudFront can read')) {
    result.likelyIssues.push(
      'Production client bundle may be outdated — rebuild client after pulling latest getAssetUrl fix.'
    );
  }

  return result;
}

module.exports = { runProfileMediaDiagnostics };
