SHELL = /bin/bash
INSTALL_FILES = brewable.css \
		d3.v3.min.js \
		ds18b20.py \
		gpioworker.py \
		LICENSE \
		LICENSE.d3 \
		README.md \
		sainsmartrelay.py \
		seeedrelay.py \
		server.py \
		sprintf.js \
		status.js

DESTDIR = /

# Where the files to server by tornado are installed
RUNDIR = /usr/share/brewable

# Who the server will be run as
USER = pi

# Where daemon log files will be
LOGDIR = /var/log/brewable



build: default.conf client server


default.conf:	default.conf.in
	cat default.conf.in | sed \
		-e 's:%RUNDIR%:$(RUNDIR):' \
		-e 's:%USER%:$(USER):' \
		-e 's:%LOGDIR%:$(LOGDIR):' \
		> default.conf

node_modules:
	npm install

client: node_modules
	./node_modules/.bin/rollup --config client.config.js

server: node_modules
	patch -p0 < websocket-no-binaries.diff
	./node_modules/.bin/rollup --config server.config.js
	patch -p0 -R < websocket-no-binaries.diff


install: build $(INSTALL_FILES)
	mkdir -p $(DESTDIR)/etc/default
	mkdir -p $(DESTDIR)/etc/init.d
	python setup.py install --root=$(DESTDIR)
	install -m 0644 default.conf $(DESTDIR)/etc/default/brewable
	install -m 0755 rcbrewable $(DESTDIR)/etc/init.d/brewable
	bash -c './postinst configure'

clean:
	rm -f default.conf
	rm -rf build

distclean:
	rm -rf node_modules

.PHONY: default.conf node_modules brewable
