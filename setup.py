#!/usr/bin/env python

from distutils.core import setup, Extension

setup(  name = 'brewable',
        version='0.2.0',
        description='Programmable Temperature Controller',
        long_description='Brewable is software for the Raspberry Pi (including Pi Zero), enabling it to read temperature information from directly connected sensors; then programmatically activate relays to control heating and/or cooling equipment.',
        author='Christoph Willing',
        author_email='chris.willing@linux.com',
        license='GPLv3',
        url='https://cwilling.github.io/brewable',
        download_url='https://www.github.com/cwilling/brewable',
        platforms=['RaspberryPi'],
        package_dir={'brewable': ''},
        packages=['brewable'],
        py_modules={'brewable': ['ds18b20', 'gpioworker', 'sainsmartrelay', 'seeedrelay', 'server']},
        data_files=[('/usr/share/brewable', ['brewable', 'status.html', 'brewable.css', 'status.js', 'd3.v3.min.js', 'sprintf.js'])],
    )


# ex:set ai shiftwidth=4 inputtab=spaces smarttab noautotab:
