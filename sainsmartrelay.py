#!/usr/bin/env python

import os, sys
import RPi.GPIO as gpio
import signal
import time

PIN_NUMBERING_MODE = gpio.BCM

RelayPins = {
'PIN_RELAY_1'	: 17,
'PIN_RELAY_2'	: 27,
'PIN_RELAY_3'	: 22,
'PIN_RELAY_4'	: 10
}
RELAY_COUNT = len(RelayPins)

# Relay boolean constants. Flipped for Sainsmart relay module.
RELAY_ON = False;
RELAY_OFF = (not RELAY_ON);


class Relay():
    def __init__(self):
        self.gpio_version = gpio.VERSION
        self.rpi_info = gpio.RPI_INFO
        print "GPIO VERSION: ", self.gpio_version
        print "RPI INFO: ", self.rpi_info
        gpio.setmode(PIN_NUMBERING_MODE);
        gpio.setup(RelayPins.values(), gpio.OUT)
        print "Relay setup done"

    def ALLON(self):
        print 'ALLON ...'
        gpio.output(RelayPins.values(), RELAY_ON)

    def ALLOFF(self):
        print 'ALLOFF...'
        gpio.output(RelayPins.values(), RELAY_OFF)

    def ON_1(self):
        gpio.output(RelayPins['PIN_RELAY_1'], RELAY_ON);
        print "Relay 1 on ", gpio.input(RelayPins['PIN_RELAY_1'])

    def ON_2(self):
        gpio.output(RelayPins['PIN_RELAY_2'], RELAY_ON);
        print "Relay 2 on ", gpio.input(RelayPins['PIN_RELAY_2'])

    def ON_3(self):
        gpio.output(RelayPins['PIN_RELAY_3'], RELAY_ON);
        print "Relay 3 on ", gpio.input(RelayPins['PIN_RELAY_3'])

    def ON_4(self):
        gpio.output(RelayPins['PIN_RELAY_4'], RELAY_ON);
        print "Relay 4 on ", gpio.input(RelayPins['PIN_RELAY_4'])

    def OFF_1(self):
        gpio.output(RelayPins['PIN_RELAY_1'], RELAY_OFF);
        print "Relay 1 off ", gpio.input(RelayPins['PIN_RELAY_1'])

    def OFF_2(self):
        gpio.output(RelayPins['PIN_RELAY_2'], RELAY_OFF);
        print "Relay 2 off ", gpio.input(RelayPins['PIN_RELAY_2'])

    def OFF_3(self):
        gpio.output(RelayPins['PIN_RELAY_3'], RELAY_OFF);
        print "Relay 3 off ", gpio.input(RelayPins['PIN_RELAY_3'])

    def OFF_4(self):
        gpio.output(RelayPins['PIN_RELAY_4'], RELAY_OFF);
        print "Relay 4 off ", gpio.input(RelayPins['PIN_RELAY_4'])


    def device_count(self):
        return RELAY_COUNT

    def ON(self, id):
        gpio.output(RelayPins['PIN_RELAY_{}'.format(id)], RELAY_ON);

    def OFF(self, id):
        gpio.output(RelayPins['PIN_RELAY_{}'.format(id)], RELAY_OFF);

    def state(self):
        mystate = []
        for dev in range(self.device_count()):
            this_dev = RelayPins['PIN_RELAY_{}'.format(dev+1)]
            print "dev #", this_dev
            mystate.append(gpio.input(this_dev))
        print "state: ", mystate
        return mystate


    def isOn(self, id):
        if self.state()[id-1] == 0:
            print '{} is ON'.format(id)
            return RELAY_ON
        else:
            print '{} is OFF'.format(id)
            return RELAY_OFF


if __name__=="__main__":
    relay = Relay()
    # Called on process interruption. Set all pins to "Input" default mode.
    def endProcess(signalnum = None, handler = None): 
        relay.ALLOFF()
        gpio.cleanup()
        sys.exit()

    signal.signal(signal.SIGINT, endProcess)

    while True:
        ct = raw_input("input: ")
        if ct == '1on':
            relay.ON_1()
        elif ct == '2on':
            relay.ON_2()
        elif ct == '3on':
            relay.ON_3()
        elif ct == '4on':
            relay.ON_4()
        elif ct == '1off':
            relay.OFF_1()
        elif ct == '2off':
            relay.OFF_2()
        elif ct == '3off':
            relay.OFF_3()
        elif ct == '4off':
            relay.OFF_4()
        elif ct == 'allon':
            relay.ALLON()
        elif ct == 'alloff':
            relay.ALLOFF()
        elif ct == 'state':
            relay.state()
        elif ct == '1isOn':
            relay.isOn(1)



# ex:set ai shiftwidth=4 inputtab=spaces smarttab noautotab:
