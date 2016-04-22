#!/usr/bin/env python

import os, sys
import RPi.GPIO as gpio
import signal
import time
import copy
from threading import Timer

try:
    _TESTING_ = os.environ['TESTING']
except:
    _TESTING_ = False

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

# The default delay is 480 seconds (8 mins)
if _TESTING_:
    DEFAULT_DELAYSET = {'on_time':3, 'off_time':12, 'isset':False}
else:
    DEFAULT_DELAYSET = {'on_time':180, 'off_time':480, 'isset':False}

class Relay():
    def __init__(self):
        self.gpio_version = gpio.VERSION
        self.rpi_info = gpio.RPI_INFO
        print "GPIO VERSION: ", self.gpio_version
        print "RPI INFO: ", self.rpi_info
        gpio.setmode(PIN_NUMBERING_MODE);
        gpio.setup(RelayPins.values(), gpio.OUT)
        self.delayset = []
        for i in range(RELAY_COUNT):
            self.delayset.append(copy.copy(DEFAULT_DELAYSET))
        print "Relay setup done ", self.delayset

    def ALLON(self):
        print 'ALLON ...'
        gpio.output(RelayPins.values(), RELAY_ON)
        for i in range(self.device_count()):
            self.setOnDelay(i+1)

    def ALLOFF(self):
        print 'ALLOFF...'
        gpio.output(RelayPins.values(), RELAY_OFF)
        #for i in range(self.device_count()):
        #    self.setOffDelay(i+1)

    def ON_1(self):
        if self.isDelayed(1):
            return
        gpio.output(RelayPins['PIN_RELAY_1'], RELAY_ON);
        self.setOnDelay(1);
        print "Relay 1 on ", gpio.input(RelayPins['PIN_RELAY_1'])

    def ON_2(self):
        if self.isDelayed(2):
            return
        gpio.output(RelayPins['PIN_RELAY_2'], RELAY_ON);
        self.setOnDelay(2);
        print "Relay 2 on ", gpio.input(RelayPins['PIN_RELAY_2'])

    def ON_3(self):
        if self.isDelayed(3):
            return
        gpio.output(RelayPins['PIN_RELAY_3'], RELAY_ON);
        self.setOnDelay(3);
        print "Relay 3 on ", gpio.input(RelayPins['PIN_RELAY_3'])

    def ON_4(self):
        if self.isDelayed(4):
            return
        gpio.output(RelayPins['PIN_RELAY_4'], RELAY_ON);
        self.setOnDelay(4);
        print "Relay 4 on ", gpio.input(RelayPins['PIN_RELAY_4'])

    def OFF_1(self):
        if self.isDelayed(1):
            return
        gpio.output(RelayPins['PIN_RELAY_1'], RELAY_OFF);
        self.setOffDelay(1);
        print "Relay 1 off ", gpio.input(RelayPins['PIN_RELAY_1'])

    def OFF_2(self):
        if self.isDelayed(2):
            return
        gpio.output(RelayPins['PIN_RELAY_2'], RELAY_OFF);
        self.setOffDelay(2);
        print "Relay 2 off ", gpio.input(RelayPins['PIN_RELAY_2'])

    def OFF_3(self):
        if self.isDelayed(3):
            return
        gpio.output(RelayPins['PIN_RELAY_3'], RELAY_OFF);
        self.setOffDelay(3);
        print "Relay 3 off ", gpio.input(RelayPins['PIN_RELAY_3'])

    def OFF_4(self):
        if self.isDelayed(4):
            return
        gpio.output(RelayPins['PIN_RELAY_4'], RELAY_OFF);
        self.setOffDelay(3);
        print "Relay 4 off ", gpio.input(RelayPins['PIN_RELAY_4'])


    def device_count(self):
        return RELAY_COUNT

    def ON(self, id):
        if self.isDelayed(id):
            return
        gpio.output(RelayPins['PIN_RELAY_{}'.format(id)], RELAY_ON);
        self.setOnDelay(id)


    def OFF(self, id):
        if self.isDelayed(id):
            return
        gpio.output(RelayPins['PIN_RELAY_{}'.format(id)], RELAY_OFF);
        self.setOffDelay(id)

    def state(self):
        return list((gpio.input(RelayPins['PIN_RELAY_{}'.format(i+1)]),self.isDelayed(i+1)) for i in range(self.device_count()))

    def state_ORIG(self):
        mystate = []
        for dev in range(self.device_count()):
            this_dev = RelayPins['PIN_RELAY_{}'.format(dev+1)]
            mystate.append(gpio.input(this_dev))
        return mystate


    def isOn(self, id):
        if self.state()[id-1][0] == 0:
            #print '{} is ON'.format(id)
            return True
        else:
            #print '{} is OFF'.format(id)
            return False

    def isDelayed(self, id):
        return self.delayset[id-1]['isset']

    def setOnDelay(self, id):
        Timer(int(self.delayset[id-1]['on_time']), self.unsetDelay, [id]).start()
        self.delayset[id-1]['isset'] = True

    def setOffDelay(self, id):
        Timer(int(self.delayset[id-1]['off_time']), self.unsetDelay, [id]).start()
        self.delayset[id-1]['isset'] = True

    def unsetDelay(self, id):
        self.delayset[id-1]['isset'] = False
        #print "Relay %d delay now unset" % id

    def setDelaySetValue(self, id, key, val):
        self.delayset[id-1][key] = val

    def getDelaySetValue(self, id, key):
        return self.delayset[id-1][key]

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
