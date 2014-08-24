REPORTER = spec
test:
	./node_modules/.bin/mocha -b \
		--reporter $(REPORTER) \

.PHONY: test
