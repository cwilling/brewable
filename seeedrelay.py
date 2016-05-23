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
# Test whether board is connected
try:
    DEVICE_ADDRESS = 0x20
    DEVICE_REG_MODE1 = 0x06
    DEVICE_REG_DATA = 0xff
    bus.write_byte_data(DEVICE_ADDRESS, DEVICE_REG_MODE1, DEVICE_REG_DATA)
except:
    raise

# The default delay is 300 seconds (5 mins)
if _TESTING_:
    DEFAULT_DELAYSET = {'on_time':3, 'off_time':12, 'isset':False}
else:
    DEFAULT_DELAYSET = {'on_time':180, 'off_time':480, 'isset':False}

class Relay():	
    global bus
    def __init__(self):
        self.relayCount = RELAY_COUNT;
        self.DEVICE_ADDRESS = 0x20      #7 bit address (will be left shifted to add the read write bit)
        self.DEVICE_REG_MODE1 = 0x06
        self.DEVICE_REG_DATA = 0xff
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)

        self.delayset = []
        for i in range(self.relayCount):
            self.delayset.append(copy.copy(DEFAULT_DELAYSET))
        print "Relay setup done", self.delayset
             
    def ON_1(self):
        if self.isDelayed(1):
            return
        self.DEVICE_REG_DATA &= ~(0x1<<0)  
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)
        self.setOnDelay(1);
        print "Relay 1 on ", self.isOn(1) 
    def ON_2(self):
        if self.isDelayed(2):
            return
        self.DEVICE_REG_DATA &= ~(0x1<<1)
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)
        self.setOnDelay(2);
        print "Relay 2 on ", self.isOn(2) 
    def ON_3(self):
        if self.isDelayed(3):
            return
        self.DEVICE_REG_DATA &= ~(0x1<<2)
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)
        self.setOnDelay(3);
        print "Relay 3 on ", self.isOn(3) 
    def ON_4(self):
        if self.isDelayed(4):
            return
        self.DEVICE_REG_DATA &= ~(0x1<<3)
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)
        self.setOnDelay(4);
        print "Relay 4 on ", self.isOn(4) 
    
    def OFF_1(self):
        if self.isDelayed(1):
            return;
        self.DEVICE_REG_DATA |= (0x1<<0)
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)
        self.setOnDelay(1);
        print "Relay 1 on ", self.isOn(1) 
    
    def OFF_2(self):
        if self.isDelayed(2):
            return;
        self.DEVICE_REG_DATA |= (0x1<<1)
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)
        self.setOnDelay(2);
        print "Relay 2 on ", self.isOn(2) 

    def OFF_3(self):
        if self.isDelayed(3):
            return;
        self.DEVICE_REG_DATA |= (0x1<<2)
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)
        self.setOnDelay(3);
        print "Relay 3 on ", self.isOn(3) 
    
    def OFF_4(self):
        if self.isDelayed(4):
            return;
        self.DEVICE_REG_DATA |= (0x1<<3)
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)
        self.setOnDelay(4);
        print "Relay 4 on ", self.isOn(4) 
    
    def ALLON(self):
        print 'ALLON...'
        self.DEVICE_REG_DATA &= ~(0xf<<0)
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)
        for i in range(self.device_count()):
            self.setOnDelay(i+1)
    
    def ALLOFF(self):
        print 'ALLOFF...'
        self.DEVICE_REG_DATA |= (0xf<<0)
        bus.write_byte_data(self.DEVICE_ADDRESS, self.DEVICE_REG_MODE1, self.DEVICE_REG_DATA)
        #for i in range(self.device_count()):
            #    self.setOffDelay(i+1)

    def device_count(self):
        return self.relayCount

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

    def state(self):
        return list((self.isOn(i+1),self.isDelayed(i+1)) for i in range(self.device_count()))

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

    def setOnDelay(self, id):
        Timer(self.delayset[id-1]['on_time'], self.unsetDelay, [id]).start()
        self.delayset[id-1]['isset'] = True
        #print "Relay %d delayed for %s" % (id, self.delayset[id-1]['duration'])

    def setOffDelay(self, id):
        Timer(self.delayset[id-1]['off_time'], self.unsetDelay, [id]).start()
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
