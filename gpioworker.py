import time
import multiprocessing
import json

# Input temperature sensor
#import systemtemp as st
import ds18b20 as st
DEVICE_DIR = '/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves'
PROFILE_DATA_FILE='profileData.txt'
JOB_DATA_FILE='jobData.txt'

# Output relay
from seedrelay import Relay

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
        self.relay = Relay()
        self.jobs = []

    def run(self):

        # Setup
        # First look for sensor devices
        try:
            sensor_file = open(DEVICE_DIR)
            sensors = sensor_file.read()
            sensor_file.close
            for sensorId in sensors.split():
                self.sensorDevices.append(SensorDevice(sensorId))
                print sensorId
            for sensor in self.sensorDevices:
                print "SENSOR", sensor.getId()
        except:
            print "No sensors connected?"

        # Load saved jobs
        try:
            with open(JOB_DATA_FILE) as json_file:
                json_data = json.load(json_file)
                #print "Job data: ", json_data['job_data']
                for job in json_data['job_data']:
                    self.jobs.append(job)
                print "Job data: ", self.jobs
        except Exception as e:
            # Can't open job file - either corrupted or doesn't exist
            print e


        # Now check the relays
        #self.relay_test()

        # Loop
        count = 0
        while True:
            # Incoming request from app
            if not self.input_queue.empty():
                data = self.input_queue.get()
                # Do something with it
                print "data 0: ", data
                print "data 0 length: ", len(data)
                try:
                    jmsg = json.loads(data.strip())
                    if jmsg['type'].startswith('save_job'):
                        # Update local version, then save to file
                        print("gpio found save_job msg")
                        self.jobs.append(jmsg['data'])
                        # print("self.jobs: ", self.jobs)
                        with open(JOB_DATA_FILE, 'w') as json_file:
                            json.dump({'job_data':self.jobs}, json_file)
                        # Return updated jobs list to client
                        jdata = json.dumps({'type':'loaded_jobs',
                                            'data':self.jobs})
                        self.output_queue.put(jdata)
                    elif jmsg['type'].startswith('load_jobs'):
                        print("gpio found load_jobs msg")
                        jdata = json.dumps({'type':'loaded_jobs',
                                            'data':self.jobs})
                        self.output_queue.put(jdata)
                    elif jmsg['type'].startswith('delete_job'):
                        # First check if index in range?
                        del self.jobs[jmsg['data']['index']]

                        # Save result
                        with open(JOB_DATA_FILE, 'w') as json_file:
                            json.dump({'job_data':self.jobs}, json_file)
                        # Return updated jobs list to client
                        jdata = json.dumps({'type':'loaded_jobs',
                                            'data':self.jobs})
                        self.output_queue.put(jdata)
                    elif jmsg['type'].startswith('save_profiles'):
                        with open(PROFILE_DATA_FILE, 'w') as json_file:
                            json.dump({'profiles_data':jmsg['data']}, json_file)
                    elif jmsg['type'].startswith('load_profiles'):
                        try:
                            with open(PROFILE_DATA_FILE) as json_file:
                                json_data = json.load(json_file)
                                print(json_data['profiles_data'])
                                jdata = json.dumps({'type':'loaded_profiles',
                                                    'data':json_data['profiles_data']})
                        except:
                                print "Couldn't load profile data file"
                                jdata = json.dumps({'type':'loaded_profiles',
                                                    'data':[]})
                        finally:
                            self.output_queue.put(jdata)

                    elif jmsg['type'].startswith('list_sensors'):
                        sensor_ids = []
                        for sensor in self.sensorDevices:
                            sensor_ids.append(sensor.getId())
                        jdata = json.dumps({'type':'sensor_list',
                                            'data':sensor_ids})
                        self.output_queue.put(jdata)
                    elif jmsg['type'].startswith('list_relays'):
                        relay_ids = []
                        for i in range(self.relay.device_count()):
                            relay_ids.append('Relay {:02}'.format(i+1))
                        jdata = json.dumps({'type':'relay_list',
                                            'data':relay_ids})
                        self.output_queue.put(jdata)
                    elif jmsg['type'].startswith('CMD'):
                        # With a CMD type, the data field is an array whose
                        # first element is the command,
                        # the remaining elements are the command's args
                        command = jmsg['data']
                        print "running command: ", command
                        self.run_command(command)
                except:
                    print "Non json msg: ", data


            # Data/info from device
            data = "generic %d" % count
            try:
                data = st.get_temp(self.sensorDevices[0].getId())
                jdata = json.dumps({'sensorId':self.sensorDevices[0].getId(),
                                    'type':'live_update',
                                    'data':data})
            except:
                jdata = json.dumps({'sensorId':'dummy_123',
                                    'type':'live_update',
                                    'data':21})
            #print "XXX", data
            #self.output_queue.put(data)
            print "XXX", jdata
            self.output_queue.put(jdata)

            # Send a heartbeat (in absence or any sensors)
            if len(self.sensorDevices) == 0:
                jdata = json.dumps({'type':'heartbeat','data':count});
                self.output_queue.put(jdata)

            count += 1

            time.sleep(1)


    def relay_test(self):
        print "Relay count = ", self.relay.device_count()
        for i in range(self.relay.device_count()):
            self.relay.ON(i+1)
            time.sleep(1)
        for i in range(self.relay.device_count()):
            self.relay.OFF(i+1)
            time.sleep(1)
        self.relay.ALLON()
        time.sleep(1)
        self.relay.ALLOFF()

    def toggle_relay_command(self, channel):
        if self.relay.isOn(channel):
            print "relay %d is already on; switching off" % channel
            self.relay.OFF(channel)
        else:
            print "relay %d is off; switching on" % channel
            self.relay.ON(channel)
        print "STATE: ", self.relay.state()
        if self.relay.isOn(channel):
            data = 'relay ' + str(channel) + ' now ON'
        else:
            data = 'relay ' + str(channel) + ' now OFF'
        jdata = json.dumps({'type':'info',
                            'data':data})
        self.output_queue.put(jdata)

    def run_command(self, command):
        if command[0].startswith('toggle_relay'):
            self.toggle_relay_command(command[1])

# ex:set ai shiftwidth=4 inputtab=spaces smarttab noautotab:
