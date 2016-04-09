import time
import smbus
import signal
import sys
import copy
from threading import Timer

try:
    _TESTING_ = os.environ['TESTING']
except:
    _TESTING_ = False

RELAY_COUNT = 4

bus = smbus.SMBus(1)    # 0 = /dev/i2c-0 (port I2C0), 1 = /dev/i2c-1 (port I2C1)

# The default delay is 300 seconds (5 mins)
if _TESTING_:
    DEFAULT_DELAYSET = {'duration':10, 'isset':False}
else:
    DEFAULT_DELAYSET = {'duration':300, 'isset':False}

class Relay():	
    global bus
    def __init__(self):
        self.DEVICE_ADDRESS = 0x20      #7 bit address (will be left shifted to add the read write bit)
        self.DEVICE_REG_MODE1 = 0x06
        self.DEVICE_REG_DATA = 0xff
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)
        self.delayset = []
        for i in range(RELAY_COUNT):
            self.delayset.append(copy.copy(DEFAULT_DELAYSET))
        print "Relay setup done"
             
    def ON_1(self):
        print 'ON_1...'
        self.DEVICE_REG_DATA &= ~(0x1<<0)  
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)
    def ON_2(self):
        print 'ON_2...'
        self.DEVICE_REG_DATA &= ~(0x1<<1)
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)
    def ON_3(self):
        print 'ON_3...'
        self.DEVICE_REG_DATA &= ~(0x1<<2)
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)
    def ON_4(self):
        print 'ON_4...'
        self.DEVICE_REG_DATA &= ~(0x1<<3)
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)
    
    def OFF_1(self):
        print 'OFF_1...'
        self.DEVICE_REG_DATA |= (0x1<<0)
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)
    
    def OFF_2(self):
        print 'OFF_2...'
        self.DEVICE_REG_DATA |= (0x1<<1)
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)

    def OFF_3(self):
        print 'OFF_3...'
        self.DEVICE_REG_DATA |= (0x1<<2)
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)
    
    def OFF_4(self):
        print 'OFF_4...'
        self.DEVICE_REG_DATA |= (0x1<<3)
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)
    
    def ALLON(self):
        print 'ALLON...'
        self.DEVICE_REG_DATA &= ~(0xf<<0)
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)
    
    def ALLOFF(self):
        print 'ALLOFF...'
        self.DEVICE_REG_DATA |= (0xf<<0)
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)

    def device_count(self):
        return RELAY_COUNT

    def ON(self, id):
        if self.isDelayed(id):
            return
        if id == 1:
            self.ON_1()
        elif id == 2:
            self.ON_2()
        elif id == 3:
            self.ON_3()
        elif id == 4:
            self.ON_4()
        self.setDelay(id)

    def OFF(self, id):
        if self.isDelayed(id):
            return
        if id == 1:
            self.OFF_1()
        elif id == 2:
            self.OFF_2()
        elif id == 3:
            self.OFF_3()
        elif id == 4:
            self.OFF_4()
        self.setDelay(id)

    def state(self):
        return list((self.isOn(i+1),self.isDelayed(i+1)) for i in range(RELAY_COUNT))

    def state_ORIG(self):
        return bus.read_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1)

    def isOn(self, id):
        rstate = bus.read_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1)
        if rstate & (0x1<<(id-1)) == 0:
            return True
        else:
            return False

    def isDelayed(self, id):
        return self.delayset[id-1]['isset']

    def setDelay(self, id):
        Timer(self.delayset[id-1]['duration'], self.unsetDelay, [id]).start()
        self.delayset[id-1]['isset'] = True
        #print "Relay %d delayed for %s" % (id, self.delayset[id-1]['duration'])

    def unsetDelay(self, id):
        self.delayset[id-1]['isset'] = False
        print "Relay %d delay now unset" % id


if __name__=="__main__":
    relay = Relay()
    # Called on process interruption. Set all pins to "Input" default mode.
    def endProcess(signalnum = None, handler = None): 
        relay.ALLOFF()
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


# ex:set ai shiftwidth=4 inputtab=spaces smarttab noautotab:
