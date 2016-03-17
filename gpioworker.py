import time
import multiprocessing
import json
import copy
import os, errno

# Input temperature sensor - choose one of these to be 'st'
#import systemtemp as st
#import ds18b20 as st
import ds18b20 as st
DEVICE_DIR = '/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves'
PROFILE_DATA_FILE='profileData.txt'
JOB_DATA_FILE='jobData.txt'
JOB_HISTORY_DIR='history'
_TESTING_=True

# Output relay
from sainsmartrelay import Relay
#from seedrelay import Relay

class SensorDevice():
    def __init__(self, id):
        self._id = id
        self._name = ""

    def getId(self):
        return self._id


# From status.js
# var jobData = {
#    name: xxxxx,
#    preheat: xxxxx,
#    profile: xxxxx,
#    sensors: xxxxx,
#    relays: xxxxx,
# };

class GPIOProcess(multiprocessing.Process):

    def __init__(self, input_queue, output_queue):
        multiprocessing.Process.__init__(self)
        self.input_queue = input_queue
        self.output_queue = output_queue
        self.sensorDevices = []
        self.relay = Relay()

        # List of "raw" jobData, as constructed by client "Jobs" page
        self.jobs = []
        # List of JobProcessor instances
        self.runningJobs = []

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

        # Load running jobs
        # Look through all files in the history directory.
        # If any is "current" (still running),
        # then add it to self.runningJobs.
        # First ensure the directory exists
        try:
            os.makedirs(JOB_HISTORY_DIR)
        except OSError as exc:
            if exc.errno == errno.EEXIST and os.path.isdir(JOB_HISTORY_DIR):
                pass
            else:
                raise

        # Load saved job descriptions
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

        # Start with all relays off
        self.relay.ALLOFF()

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
                    elif jmsg['type'].startswith('run_job'):
                        print("gpio received run_job msg");
                        # First check that this job isn't already running
                        isRunning = False
                        for job in self.runningJobs:
                            print "AAAA ", job.name()
                            if job.name() == self.jobs[jmsg['data']['index']]['name']:
                                print "Job %s already running" % job.name()
                                isRunning = True
                        if not isRunning:
                            if not self.setupJobRun(jmsg['data']['index']):
                                # Need to send msg back to client here!
                                print "Couldn't start job"
                            else:
                                print "Started job ", jmsg['data']['index']
                                # Return running jobs list to client
                                print "started_job jdata: X"
                                #jdata = json.dumps({'type':'started_job',
                                #                    'data':self.runningJobs})
                                #print "started_job jdata: ", jdata
                                #self.output_queue.put(jdata)
                                running_jobs = []
                                for j in self.runningJobs:
                                    print "started_job jdata: Y", j.jobInfo()
                                    running_jobs.append(j.jobInfo())
                                print "started_job jdata: Z", running_jobs
                                jdata = json.dumps({'type':'running_jobs',
                                                    'data':running_jobs})
                                self.output_queue.put(jdata)
                    elif jmsg['type'].startswith('load_running_jobs'):
                        print "Rcvd request to LOAD RUNNING JOBS"
                        if len(self.runningJobs) > 0:
                            for job in self.runningJobs:
                                print "BBBB ", job.name()
                        else:
                            print "No jobs running"
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


            # Data/info from sensor device
            data = "generic %d" % count
            try:
                for sensor in self.sensorDevices:
                    data = st.get_temp(sensor.getId())
                    jdata = json.dumps({'sensorId':sensor.getId(),
                                    'type':'live_update',
                                    'data':data})
                    #print "XXX", jdata
                    self.output_queue.put(jdata)
            except:
                jdata = json.dumps({'sensorId':'dummy_123',
                                    'type':'live_update',
                                    'data':21})
                print "XXX", jdata
                self.output_queue.put(jdata)

            # Data/info from relay device
            relay_state = list(self.relay.isOn(i+1) for i in range(len(self.relay.state())))
            print "relay_state: ", relay_state
            jdata = json.dumps({'type':'relay_state',
                                'data':relay_state})
            self.output_queue.put(jdata)

            # Send a heartbeat (in absence of any sensors)
            if len(self.sensorDevices) == 0:
                jdata = json.dumps({'type':'heartbeat','data':count});
                self.output_queue.put(jdata)

            # Check/process any running jobs
            for job in self.runningJobs:
                job.process()
                if count % 3  == 0:
                    job.report()




            count += 1

            time.sleep(1)


    def setupJobRun(self, jobIndex):
        try:
            self.runningJobs.append(JobProcessor(copy.copy(self.jobs[jobIndex])))
            return True
        except:
            print "JOB CREATE FAIL!"
            return False


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



class JobProcessor(GPIOProcess):

    def __init__(self, rawJobInfo):
        self.jobName    = rawJobInfo['name']
        self.jobPreheat = rawJobInfo['preheat']
        self.jobProfile = self.convertProfileTimes(rawJobInfo['profile'])
        self.jobSensors = self.validateSensors(rawJobInfo['sensors'])
        self.jobRelays  = rawJobInfo['relays']
        self.startTime  = time.time()
        self.historyFileName = (self.name()  + "-"
                                            + time.strftime("%Y%m%d_%H%M%S")
                                            + ".txt")

        # In future, make this settable in the job itself
        # e.g.self.jobProcessType = rawJobInfo['process_type']
        #
        # Probable initial types would be
        #       SIMPLE_COOL             # single relay to cooler
        #       SIMPLE_COOL_HEAT        # 2 relays, 1 for cool & 1 for heater
        #       SIMPLE_HEAT             # single relay to heater
        self.processType = "SIMPLE_COOL_HEAT"
        self.relay = Relay()

        self.history = []

        # Start a history file
        # We'll periodically append updates
        # (see "status" element in process())
        print "historyFileName: ", self.historyFileName
        header = {'type':'header',
                  'jobName':self.jobName,
                  'jobPreheat':self.jobPreheat,
                  'jobProfile':self.jobProfile,
                  'jobSensors':self.jobSensors,
                  'jobRelays':self.jobRelays,
                  'startTime':self.startTime,
                  'historyFileName':self.historyFileName
                 }
        print "header ", header

        # Its _not_ a json file,
        # rather text file with individually json encoded entry per line
        self.history.append(str(header))
        with open(os.path.join(JOB_HISTORY_DIR, self.historyFileName), 'w') as f:
             f.write(str(header) + '\n')


    def jobInfo(self):
        #return json.dumps(self, default=lambda o: o.__dict__, sort_keys=True, indent=4)
        info = {'type':'jobData',
              'jobName':self.jobName,
              'jobPreheat':self.jobPreheat,
              'jobProfile':self.jobProfile,
              'jobSensors':self.jobSensors,
              'jobRelays':self.jobRelays,
              'startTime':self.startTime,
             }
        return info

    def name(self):
        return self.jobName

    def profile(self):
        return self.jobProfile

    # Confirm specififed sensors exist in the system
    def validateSensors(self, sensors):
        for sensor in sensors:
            print "VALIDATE:", sensor
            if not st.isValidTempDevice(sensor):
                raise Exception()
        return sensors

    # Convert profile's duration fields into seconds
    # To speed testing, assume duration filed are minutes.seconds
    # whereas real version will have hours.minutes
    def convertProfileTimes(self, profile):
        for sp in profile:
            hrs = mins = secs = '0'
            if _TESTING_:
                durSecs = 0
                (mins,dot,secs) = sp['duration'].partition('.')
                if len(mins) > 0:
                    durSecs = 60 * int(mins)
                else:
                    durSecs = 0
                if len(secs) > 0:
                    durSecs += int(secs)
                sp['duration'] = str(durSecs)
            else:
                durMins = 0
                (hrs,dot,mins) = sp['duration'].partition('.')
                if len(hrs) > 0:
                    durMins = 60 * int(hrs)
                else:
                    durMins = 0
                if len(mins) > 0:
                    durMins += int(mins)
                sp['duration'] = str(durMins)
        return profile

    def process(self):
        accumulatedTime = 0.0
        print "Processing job; ", self.jobName
        now = time.time()
        #elapsedTime = now - self.startTime
        # Start history record
        status = {'jobName':self.jobName,
                  'type':'status',
                  'elapsed':now - self.startTime
                 }
        for sp in self.jobProfile:
            if sp['duration'] == '0':
                print "We're done. Hold at:", sp['target'], sp
                # Hold temperature
                self.temperatureAdjust(sp['target'])
                status['running'] = 'done'
                break
            else:
                status['running'] = 'running'
            if now > float(sp['duration']) + self.startTime + accumulatedTime:
                accumulatedTime += float(sp['duration'])
                print "passing step:", sp
                continue
            print "processing at step:", (now - self.startTime - accumulatedTime), sp
            # Set temperature
            self.temperatureAdjust(sp['target'])
            break
        # Save history
        for sensor in self.jobSensors:
            status[sensor] = st.get_temp(sensor)
        relay_state = list(self.relay.isOn(i+1) for i in range(len(self.relay.state())))
        for relay in self.jobRelays:
            if self.relay.isOn(int(relay.split()[1])):
                status[relay] = 'ON'
            else:
                status[relay] = 'OFF'

        self.history.append(status)
        with open(os.path.join(JOB_HISTORY_DIR, self.historyFileName), 'a') as f:
             f.write(str(status) + '\n')

    def report(self):
        print "REPORT time"
        #print self.history

    def temperatureAdjust(self, target):
        relayIds = []
        for relay in self.jobRelays:
            relayIds.append(int(relay.split()[1]))
        #print "Relays:", relayIds
        if self.processType == "SIMPLE_COOL":
            print "Using SIMPLE_COOL method to temperatureAdjust: ", target
        elif self.processType == "SIMPLE_COOL_HEAT":
            # Assume a single sensor for a SIMPLE method
            temp = st.get_temp(self.jobSensors[0])
            print "Temp:", temp, target

            # Assume 2 relays for COOL_HEAT method
            if len(relayIds) < 2:
                print "Need 2 relays for COOL_HEAT method"
                # Cancel job somehow?
                return
            # Assume 1st is the cooler relay, 2nd is the heater
            coolerRelay = relayIds[0]
            heaterRelay = relayIds[1]

            # If temp == target, leave it alone
            if float(temp) > float(target):
                # Turn on the cooler relay.
                self.relay.ON(coolerRelay)
                # Turn off the heater relay
                self.relay.OFF(heaterRelay)
                print "Start COOLING"
            elif float(temp) < float(target):
                # Turn off the cooler relay.
                self.relay.OFF(coolerRelay)
                # Turn on the heater relay
                self.relay.ON(heaterRelay)
                print "Start HEATING"
            else:
                self.relay.OFF(coolerRelay)
                self.relay.OFF(heaterRelay)
        elif self.processType == "SIMPLE_HEAT":
            print "Using SIMPLE_HEAT method to temperatureAdjust: ", target


# ex:set ai shiftwidth=4 inputtab=spaces smarttab noautotab:
