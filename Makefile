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



build: default.conf brewable


default.conf:	default.conf.in
	cat default.conf.in | sed \
		-e 's:%RUNDIR%:$(RUNDIR):' \
		-e 's:%USER%:$(USER):' \
		-e 's:%LOGDIR%:$(LOGDIR):' \
		> default.conf

brewable: server.py
	cat server.py | sed -e 's/import gpioworker/from brewable import gpioworker/' >brewable
	chmod 0755 brewable

install: build $(INSTALL_FILES)
	mkdir -p $(DESTDIR)/etc/default
	mkdir -p $(DESTDIR)/etc/init.d
	python setup.py install --root=$(DESTDIR)
	install -m 0644 default.conf $(DESTDIR)/etc/default/brewable
	install -m 0755 rcbrewable $(DESTDIR)/etc/init.d/brewable
	bash -c './postinst configure'

clean:
	rm -f *.pyc default.conf brewable

.PHONY: default.conf brewable
