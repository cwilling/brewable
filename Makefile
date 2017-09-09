SHELL = /bin/bash

SERVER_FILES = \
	src/scripts/brewable.js \
	src/scripts/modules/configuration.js \
	src/scripts/modules/cpuinfo.js \
	src/scripts/modules/sensor.js \
	src/scripts/modules/ds18b20.js \
	src/scripts/modules/fhem.js \
	src/scripts/modules/gpioworker.js \
	src/scripts/modules/jobprocessor.js \
	src/scripts/modules/jsogpio.js \
	src/scripts/modules/queue.js \
	src/scripts/modules/requestHandlers.js \
	src/scripts/modules/router.js \
	src/scripts/modules/sainsmartrelay.js \
	src/scripts/modules/server.js

CLIENT_FILES = \
	styles/brewable.css \
	src/scripts/status.js \

TEST_FILES = test-status.js \
		src/scripts/modules/jsogpio.js \
		src/scripts/modules/cpuinfo.js \
		src/scripts/modules/sainsmartrelay.js

DESTDIR ?=

PKGVERSION ?= 0.3.2

# Where any app files are installed
RUNDIR = /usr/share/brewable

# Who the server will be run as
USER = pi

# Where daemon log files will be
LOGDIR = /var/log/brewable

# PID file
PIDFILE = /var/run/brewable/pid

# Default server port
PORT = 8888

# Default interval (seconds) between checking job progress
INTERVAL = 60



default: brewable


test: test.js


default.conf:	default.conf.in
	cat default.conf.in | sed \
		-e 's:%RUNDIR%:$(RUNDIR):' \
		-e 's:%USER%:$(USER):' \
		-e 's:%LOGDIR%:$(LOGDIR):' \
		-e 's:%PIDFILE%:$(PIDFILE):' \
		-e 's:%PORT%:$(PORT):' \
		-e 's:%INTERVAL%:$(INTERVAL):' \
		> default.conf

node_modules:
	npm install

client: node_modules $(CLIENT_FILES)
	./node_modules/.bin/rollup --config client.config.js
	touch client

test.js: $(TEST_FILES)
	./node_modules/.bin/rollup --config test.config.js
	chmod a+x test.js

server: node_modules $(SERVER_FILES)
	patch -p0 < websocket-no-binaries.diff
	./node_modules/.bin/rollup --config server.config.js
	patch -p0 -R < websocket-no-binaries.diff
	chmod a+x build/js/brewableserverbundle.js
	touch server


brewable: server client makeself.make
	./makeself.make

install:
	mkdir -p $(DESTDIR)/etc/default
	mkdir -p $(DESTDIR)/etc/init.d
	mkdir -p $(DESTDIR)/usr/bin
	install -m 0755 brewable $(DESTDIR)/usr/bin
	install -m 0644 default.conf $(DESTDIR)/etc/default/brewable
	install -m 0755 rcbrewable $(DESTDIR)/etc/init.d/brewable
	bash -c './postinst configure'

uninstall:
	rm $(DESTDIR)/etc/default/brewable
	rm $(DESTDIR)/etc/init.d/brewable
	rm $(DESTDIR)/usr/bin/brewable

pkg:	brewable default.conf postinst rcbrewable
	rm -rf brewable-$(PKGVERSION); mkdir -p brewable-$(PKGVERSION);
	install -m 0755 brewable brewable-$(PKGVERSION)
	install -m 0755 default.conf brewable-$(PKGVERSION)
	install -m 0755 rcbrewable brewable-$(PKGVERSION)
	install -m 0755 Makefile brewable-$(PKGVERSION)
	install -m 0755 postinst brewable-$(PKGVERSION)
	tar cvf brewable-$(PKGVERSION)-armv61-1.tar.gz brewable-$(PKGVERSION)
	

clean:
	rm -rf default.conf test.js brewable-$(PKGVERSION)*

distclean: clean
	rm -rf node_modules brewable client server

.PHONY: postinst
