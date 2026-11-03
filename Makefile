all:	node_modules
	pnpm build

node_modules:
	pnpm install --frozen-lockfile

dev:
	pnpm dev

clean:
	rm -rf node_modules dist .astro public/pagefind

REMOTE ?= prod-cruftex-net
PULL_ZONE_ID ?= 6774870
RCLONE_FLAGS = --checksum --fast-list --progress

# upload to the bunny.net storage zone in three steps: resources first, then
# the pages that reference them, then delete superfluous files. Hashed assets
# under _astro/ are kept, so pages cached by the CDN or open in a browser keep
# working; `make up-clean` removes them.
up:
	rclone copy dist/ $(REMOTE):$(REMOTE)/ --exclude '*.html' $(RCLONE_FLAGS)
	rclone copy dist/ $(REMOTE):$(REMOTE)/ --include '*.html' $(RCLONE_FLAGS)
	rclone sync dist/ $(REMOTE):$(REMOTE)/ --exclude '_astro/**' $(RCLONE_FLAGS)
	$(MAKE) purge

# also delete old hashed assets; run a while after `make up`
up-clean:
	rclone sync dist/ $(REMOTE):$(REMOTE)/ $(RCLONE_FLAGS)

up-preview:
	$(MAKE) up REMOTE=preview-cruftex-net

# full cache purge of the pull zone (dash.bunny.net/cdn/6774870);
# BUNNY_API_KEY comes from the environment, never from the repo
purge:
	@test -n "$$BUNNY_API_KEY" || { echo "set BUNNY_API_KEY"; exit 1; }
	curl -sf -X POST -H "AccessKey: $$BUNNY_API_KEY" https://api.bunny.net/pullzone/$(PULL_ZONE_ID)/purgeCache
