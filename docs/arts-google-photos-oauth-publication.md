# DiAndré Art Manager: complete the Google Cloud OAuth app information

**For the owner.** No API key or OAuth secret belongs in this public document. The public pages are informational only and do **not** make the local Manager public.

## Pages made available on the ARTS website

* **Application homepage:** https://salmonofdoubt.github.io/art/google-photos/
* **Application privacy policy:** https://salmonofdoubt.github.io/art/google-photos/privacy/
* **Terms of use:** https://salmonofdoubt.github.io/art/google-photos/terms/

The homepage links visibly to the privacy policy and terms. The local Manager also includes a short privacy notice next to its Google Photos authorization controls.

**Do not enter these URLs into Google Cloud until the GitHub Pages deployment is live and the links open successfully in a private/incognito browser window.**

## Google Cloud checklist

1. Open [Google Auth Platform → Branding](https://console.cloud.google.com/auth/branding?project=art-manager-512218) for your existing project.
2. Confirm app name **DiAndré Art Manager**, support address, and developer contact address. Leave the optional app logo empty unless you want branding verification of the logo.
3. Set **Application home page** to `https://salmonofdoubt.github.io/art/google-photos/`.
4. Set **Application privacy policy link** to `https://salmonofdoubt.github.io/art/google-photos/privacy/`.
5. Set **Application Terms of Service link** to `https://salmonofdoubt.github.io/art/google-photos/terms/`.
6. Add `salmonofdoubt.github.io` as an **Authorised domain** (domain only; no `https://` and no `/art/`). Google may require ownership verification before allowing the setting or publishing the app. **Do not enter `github.io` instead.**
7. Verify that exact website in **Google Search Console**. Try a **URL-prefix property** of `https://salmonofdoubt.github.io/`; follow the verification method that Google actually offers. The HTML-file method requires copying Google's exact unique file into the repository root and publishing it to the website. **Do not invent this file, filename or verification token.** If Google rejects verification of the GitHub-provided subdomain, use a custom domain under your control and host these pages there instead.
8. Save Branding. Check [Google Auth Platform → Data access](https://console.cloud.google.com/auth/data-access?project=art-manager-512218) for the permission `https://www.googleapis.com/auth/photospicker.mediaitems.readonly`. Do not broaden the scope.
9. Open **Audience**. If available, **Publish app** and follow any verification or warning screens Google displays. This makes the OAuth application production-ready; it does **not** publish your local Manager or any photographs.
10. In your local ARTS Manager, open **Upload → From Google Photos → Configure Google Photos → Disconnect Google Photos**; then **Connect Google Photos** and complete Google's authorization again. Your previously imported artworks remain in place.

## OAuth client configuration

The existing OAuth **Web application** client has a local redirect URL:

`http://localhost:8000/api/google-photos/callback`

It must match the value shown in the Manager exactly. **Do not replace it with the public GitHub Pages site URL**, because the Google Photos authorization callback is handled on your Mac by the local Python server. The existing OAuth client ID/secret are stored under `.art-private/google-photos/client.json`; tokens are stored separately under `.art-private/google-photos/token.json`.

## Important limits

* Publishing this informational website is not the same as getting your app verified by Google. Google can ask for additional domain verification, scope verification or an app review.
* Google OAuth apps in **Testing** with external users commonly issue refresh tokens that expire in seven days. Moving to **In production** addresses that specific testing-mode limit, but does not prevent all token revocations.
* The Google Photos Picker API is not the older Google Picker API.
* Public GitHub files, including a published Studio image, are not private just because they are not shown in a Room.
* Never commit `.art-private/`, access tokens, client secrets, refresh tokens or Google-provided OAuth verification codes to GitHub.

## Source documentation

Google. (n.d.). *Photos API user data and developer policy*. https://developers.google.com/photos/support/api-policy

Google. (n.d.). *OAuth 2.0 policies*. https://developers.google.com/identity/protocols/oauth2/policies

Google. (n.d.). *Manage OAuth app branding*. https://support.google.com/cloud/answer/15549049

Google. (n.d.). *Verify your site ownership*. https://support.google.com/webmasters/answer/9008080
