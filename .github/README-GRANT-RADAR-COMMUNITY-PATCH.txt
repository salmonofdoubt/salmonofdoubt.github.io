GRANT RADAR / DEMO COMMUNITY ROUTING PATCH

What this patch does
- Adds GitHub issue forms so "Report an issue" can go straight to a Grant Radar-specific issue form.
- Adds discussion category forms so repo Discussions can separate questions, demo feedback, and showcases.
- Disables blank public issues in the issue chooser, while leaving a Maintainers only blank option for users with write access.

What you still need to do on GitHub
1. Enable Discussions for the repository, if not already enabled.
2. Create these discussion categories in the repository UI:
   - Demo feedback     -> slug should be demo-feedback
   - Q&A               -> slug should be q-a
   - Show and tell     -> slug should be show-and-tell
3. Create labels in the repository UI:
   - grant-radar
   - demo-feedback
   - showcase
   - Optional demo labels for other demos, for example:
     urbanforest, td-lookup, sdss-concept, colour-lab

Recommended button links for Grant Radar
View code:
https://github.com/salmonofdoubt/salmonofdoubt.github.io/tree/main/demos/grant-radar

Report an issue:
https://github.com/salmonofdoubt/salmonofdoubt.github.io/issues/new?template=grant-radar-bug.yml

Discussions:
https://github.com/salmonofdoubt/salmonofdoubt.github.io/discussions

Optional second idea button:
https://github.com/salmonofdoubt/salmonofdoubt.github.io/issues/new?template=grant-radar-idea.yml
