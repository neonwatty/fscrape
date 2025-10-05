# Chrome Web Store Submission Checklist

## Pre-Submission Requirements

### 1. Developer Account
- [ ] Create a Chrome Web Store developer account ($5 one-time fee)
- [ ] Verify email address
- [ ] Complete developer profile

### 2. Extension Package
- [ ] Run `npm run build` to create production build
- [ ] Test the extension from `dist/` folder
- [ ] Verify manifest.json is valid
- [ ] Check that all icons are present (16x16, 48x48, 128x128)
- [ ] Create ZIP file of the `dist/` folder (name it `fscrape-extension-v1.0.0.zip`)

### 3. Store Listing Content

#### Required Text Content
- [ ] Extension name: **fscrape - Reddit Post Tracker**
- [ ] Short description (132 char max) - see STORE_DESCRIPTION.md
- [ ] Detailed description - see STORE_DESCRIPTION.md
- [ ] Category: **Productivity** or **Social & Communication**
- [ ] Language: **English (United States)**

#### Visual Assets
- [ ] Icon (128x128) - already in `public/icons/icon128.png`
- [ ] Small promo tile (440x280) - *Optional but recommended*
- [ ] Large promo tile (920x680) - *Optional*
- [ ] Marquee promo tile (1400x560) - *Optional*
- [ ] Screenshots (1280x800 or 640x400) - **Required** - see SCREENSHOT_GUIDE.md

### 4. Privacy & Legal

- [ ] Privacy policy URL or text - use PRIVACY_POLICY.md
  - **Option A:** Host on GitHub Pages or personal website
  - **Option B:** Create a public GitHub Gist with the privacy policy
  - **Option C:** Include in extension as a page
- [ ] Declare permissions usage:
  - `storage`: "Store tracked Reddit posts locally"
  - `activeTab`: "Read post data from Reddit pages"
  - `sidePanel`: "Display analytics dashboard"
- [ ] Single Purpose statement: "Track and analyze Reddit posts"

### 5. Testing

- [ ] Complete all tests from TESTING_CHECKLIST.md
- [ ] Test on fresh Chrome install
- [ ] Verify no console errors
- [ ] Test all popup actions
- [ ] Test dashboard fully
- [ ] Test export features
- [ ] Test onboarding flow

---

## Submission Steps

### Step 1: Prepare Extension Package

```bash
cd chrome-extension
npm run build
cd dist
zip -r ../fscrape-extension-v1.0.0.zip .
cd ..
```

Verify the ZIP contains:
- manifest.json
- All JS and CSS files
- Icons folder
- All HTML files

### Step 2: Create Developer Account

1. Go to: https://chrome.google.com/webstore/devconsole
2. Sign in with Google account
3. Pay $5 registration fee
4. Complete verification

### Step 3: Start New Item Listing

1. Click "New Item" button
2. Upload `fscrape-extension-v1.0.0.zip`
3. Wait for upload to process
4. Fix any validation errors

### Step 4: Fill Out Store Listing

**Product details:**
- Extension name: `fscrape - Reddit Post Tracker`
- Summary: Copy from STORE_DESCRIPTION.md (short description)
- Description: Copy from STORE_DESCRIPTION.md (detailed description)
- Category: `Productivity`
- Language: `English (United States)`

**Graphic assets:**
1. Upload 128x128 icon (from `public/icons/icon128.png`)
2. Upload 3-5 screenshots following SCREENSHOT_GUIDE.md

**Privacy:**
- Privacy policy: [Your hosted URL or GitHub Gist URL]
- Permissions justification:
  ```
  storage: To save tracked Reddit posts and settings locally in the user's browser
  activeTab: To read publicly visible Reddit post data from the current tab
  sidePanel: To display the analytics dashboard panel
  ```
- Single purpose: `Track and analyze Reddit posts for engagement insights`
- Remote code: `No`
- Data usage: `This extension does not collect, transmit, or sell user data. All data is stored locally.`

**Distribution:**
- Visibility: `Public`
- Regions: `All regions` or select specific countries
- Pricing: `Free`

### Step 5: Submit for Review

1. Review all information for accuracy
2. Check "Preview" to see how it will appear
3. Click "Submit for Review"
4. Wait for Google's review (typically 1-3 days, can take up to 60 days)

---

## Post-Submission

### If Approved ✅
- [ ] Extension will be live on Chrome Web Store
- [ ] Share the Chrome Web Store URL
- [ ] Update README.md with installation link
- [ ] Consider creating a blog post or announcement

### If Rejected ❌
- Review rejection reasons carefully
- Common issues:
  - Permissions not properly justified
  - Privacy policy missing or unclear
  - Misleading description
  - UI issues or bugs
  - Manifest errors
- Fix issues and resubmit

---

## Updating the Extension

For future updates:

1. Update `version` in manifest.json (e.g., "1.0.1", "1.1.0")
2. Run `npm run build`
3. Create new ZIP file
4. Go to Developer Dashboard
5. Edit existing item
6. Upload new ZIP under "Package" section
7. Update description/screenshots if needed
8. Submit for review

---

## Important Notes

- **First submission review time:** 1-3 days (sometimes up to 60 days for new developers)
- **Update review time:** Usually faster, 1-2 days
- **Rejection rate:** Higher for first submission, read policies carefully
- **Support:** Respond to user reviews and questions promptly
- **Policies:** Keep up to date with Chrome Web Store policies

## Resources

- Chrome Web Store Developer Dashboard: https://chrome.google.com/webstore/devconsole
- Developer Program Policies: https://developer.chrome.com/docs/webstore/program-policies/
- Best Practices: https://developer.chrome.com/docs/webstore/best-practices/
- Branding Guidelines: https://developer.chrome.com/docs/webstore/branding/

---

## Privacy Policy Hosting Options

**Option 1: GitHub Gist**
1. Go to https://gist.github.com
2. Create new Gist
3. Name it `fscrape-privacy-policy.md`
4. Paste PRIVACY_POLICY.md content
5. Create public Gist
6. Use the raw URL in Chrome Web Store

**Option 2: GitHub Pages**
1. Create `docs/` folder in repository
2. Copy PRIVACY_POLICY.md to `docs/privacy-policy.md`
3. Enable GitHub Pages in repository settings
4. Use URL like: `https://username.github.io/fscrape/privacy-policy.html`

**Option 3: Personal Website**
Host on your own domain if you have one.
