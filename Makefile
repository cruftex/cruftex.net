
all:	node_modules
	./hexo generate

node_modules:
	npm install	

clean:
	rm -f db.json
	rm -rf node_modules
	rm -rf public

# upload in two steps, delete suprefluous files in second
up:
	rsync -rtvz --chmod=D2755,F644 public/ cruftex@rsync.keycdn.com:cruftex/
	rsync -rtvz --delete --chmod=D2755,F644 public/ cruftex@rsync.keycdn.com:cruftex/