# stephaniesgao.github.io
Stephanie Gao’s personal portfolio

## Link previews

Copy the clean URL from the address bar to share a page, for example `/blog/was-lady-gagas-meat-dress-a-warning-about-ai/`. Old `/#blog/…` links still open the same pages, but link crawlers cannot see their fragments. Preview images are only used in link metadata.

Publishing through the in-browser editor triggers the **Update share previews** workflow. It regenerates the HTML and images on `main`, removes the assets for deleted or newly locked posts, and requests a Pages build when the generated files change. Locked posts do not get share pages or preview images.

For local changes, run `node scripts/build-share-pages.mjs`. The script needs Node.js and Chrome on your PATH (`google-chrome`), or set `CHROME_BIN` to the Chrome/Chromium executable.
