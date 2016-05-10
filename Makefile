INSTALL_FILES = brewable.css \
		d3.v3.min.js \
		ds18b20.py \
		gpioworker.py \
		LICENSE \
		LICENSE.d3 \
		README.md \
		sainsmartrelay.py \
		seedrelay.py \
		server.py \
		sprintf.js \
		status.html \
		status.js

DESTDIR =

# Where the files to server by tornado are installed
RUNDIR = /var/www/html/brewable

# Who the server will be run as
USER = pi

# Where daemon log files will be
LOGDIR = /var/log/brewable



build: default.conf


default.conf:	default.conf.in
	cat default.conf.in | sed \
		-e 's:%RUNDIR%:$(RUNDIR):' \
		-e 's:%USER%:$(USER):' \
		-e 's:%LOGDIR%:$(LOGDIR):' \
		> default.conf


install: build $(INSTALL_FILES)
	mkdir -p $(DESTDIR)$(RUNDIR)
	mkdir -p $(DESTDIR)/etc/default
	mkdir -p $(DESTDIR)/etc/init.d
	cp -p $(INSTALL_FILES) $(DESTDIR)$(RUNDIR)/
	install -m 0644 default.conf $(DESTDIR)/etc/default/brewable
	install -m 0755 rcbrewable $(DESTDIR)/etc/init.d/brewable

clean:
	rm -f *.pyc default.conf

.PHONY: default.conf
