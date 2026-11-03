all:	node_modules
	pnpm build

node_modules:
	pnpm install --frozen-lockfile

dev:
	pnpm dev

clean:
	rm -rf node_modules dist .astro public/pagefind

# upload in two steps, delete superfluous files in second
up:
	rsync -rtvz --chmod=D2755,F644 dist/ cruftex@rsync.keycdn.com:cruftex/
	rsync -rtvz --delete --chmod=D2755,F644 dist/ cruftex@rsync.keycdn.com:cruftex/
