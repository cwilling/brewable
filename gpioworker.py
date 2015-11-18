import time
import multiprocessing
import ast
import json

# Input temperature sensor
#import systemtemp as st
#import ds18b20 as st
#DEVICE_DIR = '/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves'

# Output relay
#from seedrelay import Relay

class SensorDevice():
    def __init__(self, id):
        self._id = id
        self._name = ""

    def getId(self):
        return self._id


class GPIOProcess(multiprocessing.Process):

    def __init__(self, input_queue, output_queue):
        multiprocessing.Process.__init__(self)
        self.input_queue = input_queue
        self.output_queue = output_queue
        self.sensorDevices = []
        #self.relay = Relay()

    def run(self):

        # Setup
        # First look for sensor devices
#        sensor_file = open(DEVICE_DIR)
#        sensors = sensor_file.read()
#        sensor_file.close
#        for sensorId in sensors.split():
#            self.sensorDevices.append(SensorDevice(sensorId))
#            print sensorId
#        for sensor in self.sensorDevices:
#            print "SENSOR", sensor.getId()

        # Now check the relays
        #self.relay_test()

        # Loop
        count = 0
        while True:
            # Incoming request
            if not self.input_queue.empty():
                data = self.input_queue.get()
                # Do something with it
                print "data 0: ", data
                #jmsg = json.loads(data)
                #if jmsg['type'].startswith('CMD'):
                #    self.run_command(jmsg)


            # Data/info from device
            data = "generic %d" % count
            #data = st.get_temp(self.sensorDevices[0].getId())
            #jdata = json.dumps({'sensorId':self.sensorDevices[0].getId(),
            #                    'type':'live_update',
            #                    'data':data})
            print "XXX", data
            self.output_queue.put(data)
            #print "XXX", jdata
            #self.output_queue.put(jdata)
            count += 1


            time.sleep(1)


#    def relay_test(self):
#        print "Relay count = ", self.relay.device_count()
#        for i in range(self.relay.device_count()):
#            self.relay.ON(i+1)
#            time.sleep(1)
#        for i in range(self.relay.device_count()):
#            self.relay.OFF(i+1)
#            time.sleep(1)
#        self.relay.ALLON()
#        time.sleep(1)
#        self.relay.ALLOFF()

#    def run_command(self, jmsg):
#        print "Running command: ", jmsg['command']
#        print "data 4: ", jmsg['argc']
#        print "data 5: ", jmsg['args']
#        channel = jmsg['args'][0]
#        if self.relay.isOn(channel):
#            print "relay %d is already on; switching off" % channel
#            self.relay.OFF(jmsg['args'][0])
#        else:
#            print "relay %d is off; switching on" % channel
#            self.relay.ON(jmsg['args'][0])
#        print "STATE: ", self.relay.state()
#        if self.relay.isOn(channel):
#            data = 'relay ' + str(channel) + ' now ON'
#        else:
#            data = 'relay ' + str(channel) + ' now OFF'
#        jdata = json.dumps({'type':'info',
#                            'data':data})
#        self.output_queue.put(jdata)


# ex:set ai shiftwidth=4 inputtab=spaces smarttab noautotab:
