
all:	node_modules
	./hexo generate

node_modules:
	npm install	

clean:
	rm -f db.json
	rm -rf node_modules
	rm -rf public
