#!/usr/bin/env bash
# Verify S3 upload + CloudFront read for profile photos.
# Run on EC2 (needs AWS CLI + server/.env with AWS_S3_BUCKET, AWS_CLOUDFRONT_URL).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ENV_FILE="${ROOT}/server/.env"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

: "${AWS_S3_BUCKET:?Set AWS_S3_BUCKET in server/.env}"
: "${AWS_CLOUDFRONT_URL:?Set AWS_CLOUDFRONT_URL in server/.env}"
: "${AWS_REGION:=ap-south-1}"

CF_URL="${AWS_CLOUDFRONT_URL%/}"
if [[ ! "$CF_URL" =~ ^https?:// ]]; then
  CF_URL="https://${CF_URL}"
fi

TEST_KEY="profiles/_docnet-verify-$(date +%s).txt"
TEST_BODY="docnet-cloudfront-verify"

echo "== DocNet profile photo pipeline check =="
echo "Bucket:     $AWS_S3_BUCKET"
echo "CloudFront: $CF_URL"
echo "Test key:   $TEST_KEY"
echo

echo "1) Upload test object via AWS CLI (same as EC2 PutObject)..."
echo "$TEST_BODY" | aws s3 cp - "s3://${AWS_S3_BUCKET}/${TEST_KEY}" \
  --region "$AWS_REGION" \
  --content-type "text/plain" \
  --cache-control "public, max-age=60"

echo "2) Fetch via CloudFront..."
HTTP_CODE="$(curl -sS -o /tmp/docnet-cf-body.txt -w "%{http_code}" "${CF_URL}/${TEST_KEY}")"
echo "   HTTP status: $HTTP_CODE"
echo "   Body: $(cat /tmp/docnet-cf-body.txt)"

echo "3) Cleanup test object..."
aws s3 rm "s3://${AWS_S3_BUCKET}/${TEST_KEY}" --region "$AWS_REGION"

echo
if [[ "$HTTP_CODE" == "200" && "$(cat /tmp/docnet-cf-body.txt)" == "$TEST_BODY" ]]; then
  echo "PASS — CloudFront can read objects from S3."
  exit 0
fi

if [[ "$HTTP_CODE" == "403" ]]; then
  echo "FAIL — AccessDenied from S3 via CloudFront."
  echo
  echo "Upload works (EC2 IAM) but GET does not. Fix the S3 BUCKET POLICY (not EC2 IAM):"
  echo "  - S3 → ${AWS_S3_BUCKET} → Permissions → Bucket policy"
  echo "  - Use deploy/iam/s3-cloudfront-oac-bucket-policy.json"
  echo "  - Replace YOUR_AWS_ACCOUNT_ID with your 12-digit account ID"
  echo "  - Distribution ID must be E1QLA2DVTSGPOC (matches d3vs01b9563iwk.cloudfront.net)"
  echo
  echo "Also verify in CloudFront → E1QLA2DVTSGPOC → Origins:"
  echo "  - Origin domain: ${AWS_S3_BUCKET}.s3.${AWS_REGION}.amazonaws.com (REST endpoint)"
  echo "  - Origin access: Origin access control (OAC), not public"
  exit 1
fi

echo "FAIL — Unexpected response ($HTTP_CODE). Check CloudFront deployment status and origin settings."
exit 1
