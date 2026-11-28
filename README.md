# stephaniesgao.github.io
Stephanie Gao’s personal portfolio

## Link previews

Share clean URLs such as `/blog/was-lady-gagas-meat-dress-a-warning-about-ai/` instead of `/#blog/…`. Link crawlers cannot see URL fragments. The clean pages expose preview metadata and redirect visitors to the existing portfolio routes.

After publishing, editing, or removing a post, or changing the projects or post visibility in `portfolio-content.mjs`, run `node scripts/build-share-pages.mjs` and commit the updated HTML and PNGs. The in-browser editor updates the post data but does not regenerate previews. The script needs Node.js and Chrome on your PATH (`google-chrome`), or set `CHROME_BIN` to the Chrome/Chromium executable. Locked posts do not get share pages or preview images.
