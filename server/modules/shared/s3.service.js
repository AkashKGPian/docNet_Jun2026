const path = require('path');
const fs = require('fs');
const {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
} = require('@aws-sdk/client-s3');

const REGION = process.env.AWS_REGION || 'ap-south-1';
const BUCKET = process.env.AWS_S3_BUCKET;

function normalizeCloudFrontUrl(value) {
  const trimmed = (value || '').trim().replace(/\/$/, '');
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const CLOUDFRONT_URL = normalizeCloudFrontUrl(process.env.AWS_CLOUDFRONT_URL);
// When CloudFront origin has path "/profiles", viewer URLs must NOT include "profiles/" again.
const CLOUDFRONT_ORIGIN_PATH = (process.env.AWS_CLOUDFRONT_ORIGIN_PATH || '')
  .trim()
  .replace(/\/$/, '');

let s3Client;

function isS3Configured() {
  return Boolean(BUCKET && CLOUDFRONT_URL);
}

function getS3Client() {
  if (!s3Client) {
    s3Client = new S3Client({ region: REGION });
  }
  return s3Client;
}

function buildProfileObjectKey(patientId, originalName) {
  const ext = path.extname(originalName || '').toLowerCase() || '.jpg';
  const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.gif'].includes(ext) ? ext : '.jpg';
  return `profiles/patient-${patientId}-${Date.now()}${safeExt}`;
}

function objectKeyToViewerPath(objectKey) {
  if (!CLOUDFRONT_ORIGIN_PATH) return objectKey;

  const originPrefix = `${CLOUDFRONT_ORIGIN_PATH.replace(/^\//, '')}/`;
  if (objectKey.startsWith(originPrefix)) {
    return objectKey.slice(originPrefix.length);
  }

  return objectKey;
}

function viewerPathToObjectKey(viewerPath) {
  const normalized = (viewerPath || '').replace(/^\//, '');
  if (!normalized) return null;

  if (!CLOUDFRONT_ORIGIN_PATH) return normalized;

  const originPrefix = CLOUDFRONT_ORIGIN_PATH.replace(/^\//, '');
  if (normalized.startsWith(`${originPrefix}/`)) {
    return normalized;
  }

  return `${originPrefix}/${normalized}`;
}

function buildPublicUrl(objectKey) {
  return `${CLOUDFRONT_URL}/${objectKeyToViewerPath(objectKey)}`;
}

function extractObjectKeyFromUrl(url) {
  if (!url || typeof url !== 'string') return null;

  if (url.startsWith('/uploads/profiles/')) {
    return null;
  }

  const normalizedUrl = /^[\w.-]+\.cloudfront\.net\//i.test(url) ? `https://${url}` : url;

  if (CLOUDFRONT_URL && normalizedUrl.startsWith(`${CLOUDFRONT_URL}/`)) {
    const viewerPath = normalizedUrl.slice(CLOUDFRONT_URL.length + 1);
    return viewerPathToObjectKey(viewerPath);
  }

  try {
    const parsed = new URL(normalizedUrl);
    const viewerPath = parsed.pathname.replace(/^\//, '') || null;
    return viewerPath ? viewerPathToObjectKey(viewerPath) : null;
  } catch {
    return null;
  }
}

async function uploadProfilePhoto({ patientId, buffer, mimetype, originalName }) {
  if (!isS3Configured()) {
    throw new Error('S3 is not configured. Set AWS_S3_BUCKET and AWS_CLOUDFRONT_URL.');
  }

  const objectKey = buildProfileObjectKey(patientId, originalName);

  await getS3Client().send(
    new PutObjectCommand({
      Bucket: BUCKET,
      Key: objectKey,
      Body: buffer,
      ContentType: mimetype,
      CacheControl: 'public, max-age=31536000, immutable',
    })
  );

  return {
    objectKey,
    url: buildPublicUrl(objectKey),
  };
}

async function deleteProfilePhoto(urlOrKey) {
  if (!isS3Configured()) return;

  const objectKey = urlOrKey?.includes('/')
    ? extractObjectKeyFromUrl(urlOrKey)
    : urlOrKey;

  if (!objectKey || !objectKey.startsWith('profiles/')) return;

  await getS3Client().send(
    new DeleteObjectCommand({
      Bucket: BUCKET,
      Key: objectKey,
    })
  );
}

/** Local disk fallback for development when S3 is not configured */
function uploadProfilePhotoLocal({ patientId, buffer, originalName }) {
  const uploadDir = path.join(__dirname, '../../uploads/profiles');
  fs.mkdirSync(uploadDir, { recursive: true });

  const filename = buildProfileObjectKey(patientId, originalName).replace('profiles/', '');
  const absolutePath = path.join(uploadDir, filename);
  fs.writeFileSync(absolutePath, buffer);

  return {
    objectKey: filename,
    url: `/uploads/profiles/${filename}`,
  };
}

function deleteProfilePhotoLocal(relativePath) {
  if (!relativePath || !relativePath.startsWith('/uploads/profiles/')) return;

  const uploadDir = path.join(__dirname, '../../uploads/profiles');
  const absolutePath = path.join(uploadDir, path.basename(relativePath));
  if (fs.existsSync(absolutePath)) {
    fs.unlinkSync(absolutePath);
  }
}

module.exports = {
  isS3Configured,
  uploadProfilePhoto,
  deleteProfilePhoto,
  uploadProfilePhotoLocal,
  deleteProfilePhotoLocal,
  buildPublicUrl,
  getS3Client,
};
