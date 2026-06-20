require('dotenv').config({ path: __dirname + '/../.env' });
const mongoose = require('mongoose');
const User = require('../modules/auth/models/User');
const { buildPublicUrl, extractObjectKeyFromUrl } = require('../modules/shared/s3.service');

/**
 * Fix profilePicture URLs missing https:// (or full S3 URLs) so the client loads CloudFront.
 *
 * Usage (on EC2 with server/.env configured):
 *   node scripts/fixProfilePhotoUrls.js
 */
async function fixProfilePhotoUrls() {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    console.error('MONGO_URI is required in server/.env');
    process.exit(1);
  }

  await mongoose.connect(mongoUri);

  const users = await User.find({
    profilePicture: { $type: 'string', $ne: '' },
  }).select('_id profilePicture');

  let updated = 0;

  for (const user of users) {
    const current = user.profilePicture;
    let next = current;

    if (/^[\w.-]+\.cloudfront\.net\//i.test(current)) {
      next = `https://${current}`;
    } else if (/^profiles\//.test(current)) {
      next = buildPublicUrl(current);
    } else if (/^https?:\/\//i.test(current)) {
      const objectKey = extractObjectKeyFromUrl(current);
      if (objectKey?.startsWith('profiles/')) {
        next = buildPublicUrl(objectKey);
      } else {
        continue;
      }
    } else if (current.includes('.amazonaws.com/')) {
      try {
        const key = new URL(current).pathname.replace(/^\//, '');
        if (key.startsWith('profiles/')) {
          next = buildPublicUrl(key);
        }
      } catch {
        continue;
      }
    } else {
      continue;
    }

    if (next !== current) {
      user.profilePicture = next;
      await user.save();
      updated += 1;
      console.log(`Updated ${user._id}: ${current} -> ${next}`);
    }
  }

  console.log(`Done. Updated ${updated} of ${users.length} user(s) with profile photos.`);
  await mongoose.disconnect();
}

fixProfilePhotoUrls().catch((error) => {
  console.error('Fix profile photo URLs failed:', error);
  process.exit(1);
});
