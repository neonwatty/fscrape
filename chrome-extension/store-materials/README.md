# Chrome Web Store Materials

This folder contains all the materials needed for submitting fscrape to the Chrome Web Store.

## Contents

### 📝 STORE_DESCRIPTION.md
Contains the store listing text:
- **Short description** (132 characters max) - Used in search results and extension overview
- **Detailed description** - Full extension description with features, benefits, and getting started guide

### 🔒 PRIVACY_POLICY.md
Complete privacy policy explaining:
- What data is collected (Reddit posts, subreddit tracking)
- How data is stored (locally only, using Chrome storage and IndexedDB)
- User rights and data control
- Compliance with GDPR, CCPA, and Chrome Web Store policies

**Note:** This privacy policy needs to be hosted publicly (see hosting options in SUBMISSION_CHECKLIST.md)

### 📸 SCREENSHOT_GUIDE.md
Detailed instructions for taking Chrome Web Store screenshots:
- 5 recommended screenshots with titles and descriptions
- Technical requirements (1280x800, PNG, under 5MB)
- Step-by-step instructions for each screenshot
- Post-processing tips

### ✅ SUBMISSION_CHECKLIST.md
Complete step-by-step guide for Chrome Web Store submission:
- Pre-submission requirements
- Developer account setup
- Extension package preparation
- Store listing form fields
- Privacy policy hosting options
- Post-submission process
- Update procedure

## Quick Start

### 1. Prepare Extension Package

```bash
cd chrome-extension
npm run build
cd dist
zip -r ../fscrape-extension-v1.0.0.zip .
cd ..
```

### 2. Host Privacy Policy

Choose one option:

**Option A: GitHub Gist**
1. Go to https://gist.github.com
2. Create new public Gist
3. Name: `fscrape-privacy-policy.md`
4. Paste contents of `PRIVACY_POLICY.md`
5. Copy the raw URL

**Option B: GitHub Pages**
1. Create `docs/` folder in main repository
2. Copy `PRIVACY_POLICY.md` to `docs/privacy-policy.md`
3. Enable GitHub Pages in repo settings
4. Use the GitHub Pages URL

### 3. Take Screenshots

Follow the detailed instructions in `SCREENSHOT_GUIDE.md`:
- Screenshot 1: Pin button and tracking counter
- Screenshot 2: Extension popup
- Screenshot 3: Dashboard heatmap
- Screenshot 4: Posts table with filters
- Screenshot 5: Export functionality

Save as PNG files (1280x800) in this folder.

### 4. Submit to Chrome Web Store

Follow the complete checklist in `SUBMISSION_CHECKLIST.md`:
1. Create developer account ($5 fee)
2. Upload extension ZIP
3. Fill out store listing with content from `STORE_DESCRIPTION.md`
4. Upload screenshots
5. Add privacy policy URL
6. Submit for review

## Review Timeline

- **First submission:** 1-3 days (can take up to 60 days for new developers)
- **Updates:** Usually 1-2 days

## After Approval

Once approved:
1. Update main README.md with Chrome Web Store link
2. Remove "Coming soon" note from installation section
3. Share the store URL with users

## Updating the Extension

For future updates:
1. Update `version` in `manifest.json`
2. Run `npm run build`
3. Create new ZIP file
4. Upload to existing store listing
5. Submit for review

## Notes

- Keep this folder in version control for future reference
- Update materials when extension features change
- Maintain privacy policy if data practices change
- Add actual screenshots once extension is fully tested

## Resources

- [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole)
- [Developer Program Policies](https://developer.chrome.com/docs/webstore/program-policies/)
- [Publishing Best Practices](https://developer.chrome.com/docs/webstore/best-practices/)
