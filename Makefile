SHELL = /bin/bash

TEST_FILES = test-status.js \
		src/scripts/modules/jsogpio.js \
		src/scripts/modules/cpuinfo.js \
		src/scripts/modules/sainsmartrelay.js

DESTDIR = /

# Where any app files are installed
RUNDIR = /usr/share/brewable

# Who the server will be run as
USER = pi

# Where daemon log files will be
LOGDIR = /var/log/brewable



build: default.conf client server


test: test.js


default.conf:	default.conf.in
	cat default.conf.in | sed \
		-e 's:%RUNDIR%:$(RUNDIR):' \
		-e 's:%USER%:$(USER):' \
		-e 's:%LOGDIR%:$(LOGDIR):' \
		> default.conf

node_modules:
	npm install

#client: node_modules
client:
	./node_modules/.bin/rollup --config client.config.js

test.js: $(TEST_FILES)
	./node_modules/.bin/rollup --config test.config.js
	chmod a+x test.js

#server: node_modules
server:
	patch -p0 < websocket-no-binaries.diff
	./node_modules/.bin/rollup --config server.config.js
	patch -p0 -R < websocket-no-binaries.diff
	chmod a+x build/js/brewableserverbundle.js


brewable: server client
	./makeself.make

install: build brewable
	mkdir -p $(DESTDIR)/etc/default
	mkdir -p $(DESTDIR)/etc/init.d
	mkdir -p $(DESTDIR)/usr/bin
	install -m 0755 brewable $(DESTDIR)/usr/bin
	install -m 0644 default.conf $(DESTDIR)/etc/default/brewable
	install -m 0755 rcbrewable $(DESTDIR)/etc/init.d/brewable
	bash -c './postinst configure'

clean:
	rm -f default.conf
	rm -rf build
	rm -f test.js

distclean:
	rm -rf node_modules

.PHONY: default.conf node_modules brewable test
