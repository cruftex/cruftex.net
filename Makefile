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
# the bucket as an on-the-fly remote, no rclone.conf involved (the endpoint
# goes through the environment, a connection string would need quoting);
# the storage zone password and the API key come from the desktop keyring
# (Secret Service, secret-tool), see README "Secrets". A value exported in
# the environment wins over the keyring.
BUCKET = :s3:$(REMOTE)/
export RCLONE_S3_PROVIDER = Other
export RCLONE_S3_ENDPOINT = https://de-s3.storage.bunnycdn.com
export RCLONE_S3_ENV_AUTH = true
SECRET_LOOKUP = secret-tool lookup service bunny.net
# each secret is looked up once per make process (`:=`, while the Makefile
# is read, before any recipe runs) and only for the goals that need it;
# sub-makes inherit it through the environment, so the keyring asks once
# per secret, at the start. An exported value wins.
ifneq ($(filter up up-clean check,$(MAKECMDGOALS)),)
export AWS_ACCESS_KEY_ID ?= $(REMOTE)
ifeq ($(origin AWS_SECRET_ACCESS_KEY),undefined)
export AWS_SECRET_ACCESS_KEY := $(shell $(SECRET_LOOKUP) zone $(REMOTE))
endif
endif
ifneq ($(filter up purge,$(MAKECMDGOALS)),)
ifeq ($(origin BUNNY_API_KEY),undefined)
export BUNNY_API_KEY := $(shell $(SECRET_LOOKUP) key api)
endif
endif
up up-clean check: secrets
# bunny's S3 gateway rejects a share of requests at random with 404
# (NoSuchBucket, object not found) or drops the connection; the "Failed to
# copy" lines in the output are normal, rclone retries the whole step until
# it is clean. Skip the HEAD after upload and the bucket check, retry
# generously, and verify the result with `rclone check` before purging.
RCLONE_FLAGS = --checksum --fast-list --s3-no-head --s3-no-check-bucket \
  --retries 10 --retries-sleep 5s --low-level-retries 20 --progress

# upload to the bunny.net storage zone in three steps: resources first, then
# the pages that reference them, then delete superfluous files. Hashed assets
# under _astro/ are kept, so pages cached by the CDN or open in a browser keep
# working; `make up-clean` removes them.
up:
	rclone copy dist/ $(BUCKET) --exclude '*.html' $(RCLONE_FLAGS)
	rclone copy dist/ $(BUCKET) --include '*.html' $(RCLONE_FLAGS)
	rclone sync dist/ $(BUCKET) --exclude '_astro/**' $(RCLONE_FLAGS)
	$(MAKE) check
	$(MAKE) purge

# every file of dist/ is in the bucket with the same checksum
check:
	rclone check dist/ $(BUCKET) --one-way $(RCLONE_FLAGS)

# also delete old hashed assets; run a while after `make up`
up-clean:
	rclone sync dist/ $(BUCKET) $(RCLONE_FLAGS)

up-preview:
	$(MAKE) up REMOTE=preview-cruftex-net

secrets:
	@test -n "$$AWS_SECRET_ACCESS_KEY" || { echo "no password for zone $(REMOTE) in the keyring, see README"; exit 1; }

# full cache purge of the pull zone (dash.bunny.net/cdn/6774870)
purge:
	@test -n "$$BUNNY_API_KEY" || { echo "no bunny.net API key in the keyring, see README"; exit 1; }
	curl -sf -X POST -H "AccessKey: $$BUNNY_API_KEY" https://api.bunny.net/pullzone/$(PULL_ZONE_ID)/purgeCache
