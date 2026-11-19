# EnvAI What's New — class-colour legend patch

Adds the four-colour legend and colour-coded classification badges to each release/entry on `demos/envai/whats-new.html`.

- Traditional digital: blue
- AI-augmented: lemon
- AI-native: orange
- Unverified: lavender

The legend is informational, not another filter. No catalogue entries are modified. Existing releases, filters, links, and the atlas stay unchanged.

## Local install (from any working directory)

```bash
unzip -o ~/Downloads/EnvAI-news-colour-key-patch.zip -d /Users/diandre/i_VC/salmonofdoubt.github.io
```

While your local server is running, visit:

`http://localhost:8000/demos/envai/whats-new.html?key=1`

If an older copy appears, hard reload with Cmd+Shift+R. The service worker cache revision is incremented to v12. This does not commit or push anything to GitHub.
