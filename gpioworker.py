import time
import multiprocessing
import json
import copy
import os, errno
from collections import deque

# Input temperature sensor - choose one of these to be 'st'
#import systemtemp as st
#import ds18b20 as st
import ds18b20 as st
DEVICE_DIR = '/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves'
CWD=os.getcwd()
PROFILE_DATA_FILE='profileData.txt'
JOB_DATA_FILE='jobData.txt'
JOB_RUN_DIR='jobs'
JOB_HISTORY_DIR='history'
try:
    _TESTING_ = os.environ['TESTING']
except:
    _TESTING_ = False

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
        self.stoppedJobs = []

    def run(self):

        if _TESTING_:
            print "_TESTING_ is True"

        # Setup
        # First look for sensor devices
        try:
            sensor_file = open(DEVICE_DIR)
            sensors = sensor_file.read()
            sensor_file.close
            for sensorId in sensors.split():
                self.sensorDevices.append(SensorDevice(sensorId))
                #print sensorId
            #for sensor in self.sensorDevices:
            #    print "SENSOR", sensor.getId()
        except:
            print "No sensors connected?"

        # Load running jobs
        # Look through all files in the history directory.
        # If any is "current" (still running),
        # then add it to self.runningJobs.
        # First ensure the directory exists
        try:
            os.makedirs(JOB_RUN_DIR)
        except OSError as exc:
            if exc.errno == errno.EEXIST and os.path.isdir(JOB_RUN_DIR):
                pass
            else:
                raise

        # JOB_HISTORY_DIR is where saved job history files are kept
        try:
            os.makedirs(JOB_HISTORY_DIR)
        except OSError as exc:
            if exc.errno == errno.EEXIST and os.path.isdir(JOB_HISTORY_DIR):
                pass
            else:
                raise

        # Load saved job templates
        try:
            with open(JOB_DATA_FILE) as json_file:
                json_data = json.load(json_file)
                #print "Job data: ", json_data['job_data']
                for job in json_data['job_data']:
                    self.jobs.append(job)
                #print "Job data: ", self.jobs
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
                #print "data 0: ", data
                #print "data 0 length: ", len(data)
                try:
                    jmsg = json.loads(data.strip())
                    if jmsg['type'] == 'save_job':
                        # Update local version, then save to file
                        #print("gpio found save_job msg")
                        self.jobs.append(jmsg['data'])
                        # print("self.jobs: ", self.jobs)
                        with open(JOB_DATA_FILE, 'w') as json_file:
                            json.dump({'job_data':self.jobs}, json_file)
                        # Return updated jobs list to client
                        jdata = json.dumps({'type':'loaded_jobs',
                                            'data':self.jobs})
                        self.output_queue.put(jdata)
                    elif jmsg['type'] == 'load_jobs':
                        #print("gpio found load_jobs msg")
                        jdata = json.dumps({'type':'loaded_jobs',
                                            'data':self.jobs})
                        self.output_queue.put(jdata)
                    elif jmsg['type'] == 'delete_job':
                        # First check if index in range?
                        del self.jobs[jmsg['data']['index']]

                        # Save result
                        with open(JOB_DATA_FILE, 'w') as json_file:
                            json.dump({'job_data':self.jobs}, json_file)
                        # Return updated jobs list to client
                        jdata = json.dumps({'type':'loaded_jobs',
                                            'data':self.jobs})
                        self.output_queue.put(jdata)
                    elif jmsg['type'] == 'run_job':
                        #print("gpio received run_job msg");
                        # First check that this job isn't already running
                        isRunning = False
                        for job in self.runningJobs:
                            if job.name() == self.jobs[jmsg['data']['index']]['name']:
                                print "Job %s already running" % job.name()
                                isRunning = True
                        if not isRunning:
                            if not self.setupJobRun(jmsg['data']['index']):
                                # Need to send msg back to client here!
                                print "Couldn't start job"
                            else:
                                print "Started job ", jmsg['data']['index']
                        if len(self.runningJobs) > 0:
                            running_jobs = []
                            for j in self.runningJobs:
                                job_info = j.jobInfo()
                                job_info['history'] = j.history[1:]
                                #print "list running job: ", job_info
                                running_jobs.append(job_info)
                            #print "running_jobs list: ", running_jobs
                            jdata = json.dumps({'type':'running_jobs',
                                                'data':running_jobs})
                            self.output_queue.put(jdata)
                    elif jmsg['type'] == 'load_startup_data':
                        self.loadStartupData(jmsg)
                    elif jmsg['type'] == 'load_running_jobs':
                        self.loadRunningJobs(jmsg)
                    elif jmsg['type'] == 'stop_running_job':
                        self.stopRunningJob(jmsg)
                    elif jmsg['type'] == 'remove_running_job':
                        self.removeRunningJob(jmsg)
                    elif jmsg['type'] == 'save_running_job':
                        self.saveRunningJob(jmsg)
                    elif jmsg['type'] == 'load_saved_jobs':
                        self.loadSavedJobs(jmsg)
                    elif jmsg['type'] == 'load_saved_job_data':
                        self.loadSavedJobData(jmsg)
                    elif jmsg['type'] == 'save_profiles':
                        with open(PROFILE_DATA_FILE, 'w') as json_file:
                            json.dump({'profiles_data':jmsg['data']}, json_file)
                    elif jmsg['type'] == 'load_profiles':
                        self.loadProfiles(jmsg)

                    elif jmsg['type'] == 'list_sensors':
                        sensor_ids = []
                        for sensor in self.sensorDevices:
                            sensor_ids.append(sensor.getId())
                        jdata = json.dumps({'type':'sensor_list',
                                            'data':sensor_ids})
                        self.output_queue.put(jdata)
                    elif jmsg['type'] == 'list_relays':
                        relay_ids = []
                        for i in range(self.relay.device_count()):
                            relay_ids.append('Relay {:02}'.format(i+1))
                        jdata = json.dumps({'type':'relay_list',
                                            'data':relay_ids})
                        self.output_queue.put(jdata)
                    elif jmsg['type'] == 'CMD':
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

            # Send update of sensors & relay state
            self.liveUpdate()

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

            #time.sleep(1)


    def loadStartupData(self, jmsg):
        jdata = json.dumps({'type':'startup_data',
                            'data':{'testing':_TESTING_,
                                    'the_end':'orange' }})
        self.output_queue.put(jdata)

        self.loadRunningJobs(jmsg)
        self.loadSavedJobs(jmsg)
        self.loadProfiles(jmsg)

    def loadProfiles(self, jmsg):
        try:
            with open(PROFILE_DATA_FILE) as json_file:
                json_data = json.load(json_file)
                #print(json_data['profiles_data'])
                jdata = json.dumps({'type':'loaded_profiles',
                                    'data':json_data['profiles_data']})
        except:
            print "Couldn't load profile data file"
            jdata = json.dumps({'type':'loaded_profiles', 'data':[]})
        finally:
            self.output_queue.put(jdata)

    def loadRunningJobs(self, jmsg):
        #print "Rcvd request to LOAD RUNNING JOBS"
        # We send "public" job info (since client doesn't
        # need stuff like local file name etc.
        # Also send collected status reports
        # (history without "private" header)
        if len(self.runningJobs) > 0:
            running_jobs = []
            for j in self.runningJobs:
                job_info = j.jobInfo()
                job_info['history'] = j.history[1:]
                #print "list running job: ", job_info
                running_jobs.append(job_info)
            #print "running_jobs list: ", running_jobs
            jdata = json.dumps({'type':'running_jobs',
                                'data':running_jobs})
            self.output_queue.put(jdata)
        else:
            print "No jobs running"
            jdata = json.dumps({'type':'running_jobs',
                                'data':[]})
            self.output_queue.put(jdata)

    def loadSavedJobData(self, jmsg):
        #print "Rcvd request to LOAD SAVED JOB DATA ", jmsg['data']['fileName'] + '.txt'

        fileName = jmsg['data']['fileName'] + '.txt'
        #print "fileName: ", fileName
        filepath = os.path.join(CWD, JOB_HISTORY_DIR, fileName)
        #print "loading data from file: ", filepath
        try:
            with open(filepath) as f:
                lines = [json.loads(line) for line in f]
            #print "lines: ", lines
            jdata = {'type':'saved_job_data', 'data':{'header':lines[0:1],'updates':lines[1:]}}
        except:
                print "Couldn't load saved job data"
                jdata = json.dumps({'type':'saved_job_data',
                                    'data':[]})
        finally:
            self.output_queue.put(jdata)


    def loadSavedJobs(self, jmsg):
        #print "Rcvd request to LOAD SAVED JOBS"
        goodhistoryfiles = []
        try:
            historyfiles = [f for f in os.listdir(os.path.join(CWD, JOB_HISTORY_DIR)) if os.path.isfile(os.path.join(CWD, JOB_HISTORY_DIR, f))]
        except Exception as e:
            print "error loadSavedJobs(); ", e
        for file in historyfiles:
            try:
                lastline = json.loads(deque(open(os.path.join(CWD, JOB_HISTORY_DIR, file)), 1).pop())
                if lastline['running'] == 'stopped':
                    goodhistoryfiles.append(file)
            except Exception as e:
                print "wrong file format in loadSavedJobs(); ", file, e
        print "good history files: ", goodhistoryfiles
        jdata = json.dumps({'type':'saved_jobs_list',
                            'data':{'historyfiles':goodhistoryfiles}})
        self.output_queue.put(jdata)
        #print "file list sent: ", jdata

    def removeRunningJob(self, jmsg):
        #print "Rcvd request to REMOVE JOB"
        jobName = jmsg['data']['jobName']
        self.stopRunningJob(jmsg)

        # Whether previously running or not, it should now be in stoppedJobs
        job_found = False
        for i in range(len(self.stoppedJobs)):
            if self.stoppedJobs[i].name() == jobName:
                job_found = True
                del self.stoppedJobs[i]
                #print "Job %s removed from stoppedJobs" % jobName
                jdata = json.dumps({'type':'removed_job',
                                    'data':{'jobName':jobName}})
                self.output_queue.put(jdata)
                break
        if not job_found:
            # This shouldn't be possible
            print "Job to remove NOT FOUND! ", jobName

    def saveRunningJob(self, jmsg):
        #print "Rcvd request to SAVE RUNNING JOB"
        jobName = jmsg['data']['jobName']
        self.stopRunningJob(jmsg)

        # Whether previously running or not, it should now be in stoppedJobs
        job_found = False
        for i in range(len(self.stoppedJobs)):
            if self.stoppedJobs[i].name() == jobName:
                job_found = True
                historyFileName = self.stoppedJobs[i].historyFileName
                from_path = os.path.join(CWD, JOB_RUN_DIR, historyFileName)
                to_path = os.path.join(CWD, JOB_HISTORY_DIR, historyFileName)
                try:
                    os.rename(from_path, to_path)
                    jdata = json.dumps({'type':'saved_job',
                                        'data':{'jobName':jobName}})
                    self.output_queue.put(jdata)
                except Exception as e:
                    print "saveRunningJob() ERROR: ", e

        if not job_found:
            jdata = json.dumps({'type':'error_save_running_job',
                                'data':{'jobName':jobName}})
            self.output_queue.put(jdata)

        self.loadSavedJobs(json.dumps({'type':'load_saved_jobs','data':[]}))

    def stopRunningJob(self, jmsg):
        #print "Rcvd request to STOP RUNNING JOB"
        job_found = False
        for job in self.runningJobs:
            if job.name() == jmsg['data']['jobName']:
                job_found = True
                #print "Job %s running - ready to stop" % job.name()
                while job.processing:
                    # Wait for any current processing to complete
                    print "spinning ..."
                    time.sleep(0.05)
                job.stop()
                break
        if not job_found:
            # Perhaps the job was already stopped?
            for job in self.stoppedJobs:
                if job.name() == jmsg['data']['jobName']:
                    #print "Job %s already stopped" % job.name()
                    jdata = json.dumps({'type':'stopped_job',
                                        'data':{'jobName':job.name()}})
                    self.output_queue.put(jdata)
                    break

    def liveUpdate(self):
        # Data/info from sensor devices
        try:
            sensor_state = list({'sensorId':sensor.getId(),'temperature':st.get_temp(sensor.getId())} for sensor in self.sensorDevices)
        except:
            sensor_state = []
        #print "sensor_state: ", sensor_state

        # Data/info from relay device
        try:
            relay_state = list((self.relay.isOn(i+1),self.relay.isDelayed(i+1)) for i in range(self.relay.device_count()))
        except:
            relay_state = []
        #print "relay_state: ", relay_state

        # Send live_update (= sensor_state + relay_state)
        jdata = json.dumps({'type':'live_update',
                            'sensor_state':sensor_state,
                            'relay_state':relay_state})
        self.output_queue.put(jdata)
        #print "relay_state jdata: ", jdata

    def setupJobRun(self, jobIndex):
        try:
            self.runningJobs.append(JobProcessor(copy.deepcopy(self.jobs[jobIndex]),self.output_queue,self.runningJobs,self.stoppedJobs,self.relay,self.sensorDevices))
            return True
        except:
            print "JOB CREATE FAIL!"
            return False


    def relay_test(self):
        #print "Relay count = ", self.relay.device_count()
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
            #print "relay %d is already on; switching off" % channel
            self.relay.OFF(channel)
        else:
            #print "relay %d is off; switching on" % channel
            self.relay.ON(channel)
        self.liveUpdate()
        #print "STATE: ", self.relay.state()
        #if self.relay.isOn(channel):
        #    data = 'relay ' + str(channel) + ' now ON'
        #else:
        #    data = 'relay ' + str(channel) + ' now OFF'
        #jdata = json.dumps({'type':'info',
        #                    'data':data})
        #self.output_queue.put(jdata)
        #print "STATE: ", jdata

    def run_command(self, command):
        if command[0] == 'toggle_relay':
            self.toggle_relay_command(command[1])



class JobProcessor(GPIOProcess):

    def __init__(self, rawJobInfo, output_queue, runningJobs, stoppedJobs, relay, sensorDevices):
        self.runningJobs = runningJobs
        self.stoppedJobs = stoppedJobs
        self.output_queue = output_queue
        self.jobName    = rawJobInfo['name']
        self.jobPreheat = rawJobInfo['preheat']
        self.jobProfile = self.convertProfileTimes(rawJobInfo['profile'])
        self.jobSensors = self.validateSensors(rawJobInfo['sensors'])
        self.jobRelays  = rawJobInfo['relays']
        self.startTime  = time.time()
        self.instanceId = time.strftime("%Y%m%d_%H%M%S",time.localtime(self.startTime))
        self.historyFileName = (self.name()  + "-"
                                            + self.instanceId
                                            + ".txt")
        self.processing  = False

        # In future, make processType settable in the job itself
        # e.g.self.jobProcessType = rawJobInfo['process_type']
        #
        # Probable initial types would be
        #       SIMPLE_COOL             # single relay to cooler
        #       SIMPLE_COOL_HEAT        # 2 relays, 1 for cool & 1 for heater
        #       SIMPLE_HEAT             # single relay to heater
        relaysInJob = len(self.jobRelays)
        if relaysInJob == 1:
            self.processType = "SIMPLE_COOL"
        elif relaysInJob == 2:
            self.processType = "SIMPLE_COOL_HEAT"
        else:
            print "Unknown process type for more than 2 relays"
        self.relay = relay
        self.sensorDevices = sensorDevices

        self.history = []

        # Start a history file
        # We'll periodically append updates
        # (see "status" element in process())
        #print "historyFileName: ", self.historyFileName
        header = {'type':'header',
                  'jobName':self.jobName,
                  'jobInstance':self.instanceId,
                  'jobPreheat':self.jobPreheat,
                  'jobProfile':self.jobProfile,
                  'jobSensors':self.jobSensors,
                  'jobRelays':self.jobRelays,
                  'startTime':self.startTime,
                  'historyFileName':self.historyFileName
                 }
        #print "header ", header

        # NB. Its _not_ quite a fully json file,
        # rather text file with individually json encoded entry per line
        self.history.append(str(header))
        # Add an initial temperature report
        status = self.jobStatus(self.startTime)
        status['running'] = 'startup'
        self.history.append(status)
        with open(os.path.join(JOB_RUN_DIR, self.historyFileName), 'a') as f:
            json.dump(header, f)
            f.write(os.linesep)
            json.dump(status, f)
            f.write(os.linesep)


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
            #print "VALIDATE:", sensor
            if not st.isValidTempDevice(sensor):
                raise Exception()
        return sensors

    # Convert profile's duration fields into seconds
    # To speed testing, assume duration fields are minutes.seconds
    # whereas real version will have hours.minutes
    def convertProfileTimes(self, profile):
        hrs = mins = secs = '0';
        durSecs = durMins = 0;
        for sp in profile:
            if _TESTING_:
                (mins,dot,secs) = sp['duration'].partition('.')
                if len(mins) > 0:
                    durSecs = 60 * int(mins)
                else:
                    durSecs = 0
                if len(secs) > 0:
                    durSecs += int(secs)
                sp['duration'] = str(durSecs)
            else:
                (hrs,dot,mins) = sp['duration'].partition('.')
                if len(hrs) > 0:
                    durMins = 60 * int(hrs)
                else:
                    durMins = 0
                if len(mins) > 0:
                    durMins += int(mins)
                sp['duration'] = str(durMins)
        return profile

    def target_temperature(self, current_time):
        '''What is the desired temperature at current_time?'''

        # First generate an array of target temps at accumulated time
        control_steps = []
        cumulative_time = 0.0
        for step in self.jobProfile:
            entry = []
            entry.append(float(step['duration']))
            entry.append(float(step['target']))
            entry.append(cumulative_time)
            #print "entry: ", entry
            control_steps.append(entry)
            cumulative_time += entry[0]

        elapsed_time = current_time - self.startTime
        #print "elapsed_time = ", elapsed_time
        #print "steps: ", control_steps

        # If we're past the last step, return the last valid temperature target
        if elapsed_time > control_steps[-1][2]:
            for x in reversed(control_steps):
                if float(x[1]) > 0:
                    #print "target_temperature() DONE", x[1] 
                    return (True, x[1])
            # case == basket
            #print "target_temperature() DONE", control_steps[-1][1]
            return (True, control_steps[-1][1])

        previous_setpoint = control_steps[0]
        #print "previous_setpoint: ", previous_setpoint
        for step in control_steps:
            if step[2] > elapsed_time:
                #print "At %f, next setpoint at: %f" % (elapsed_time, step[2])
                slope = (step[1] - previous_setpoint[1])/(step[2] - previous_setpoint[2])
                intercept = step[1] - slope*step[2]
                target = slope*elapsed_time + intercept
                return (False, target)
            previous_setpoint = step

    def jobStatus(self, nowTime):
        job_status = {'jobName' :self.jobName,
                  'type'        :'status',
                  'elapsed'     : nowTime - self.startTime,
                  'sensors'     : []
                 }
        for sensor in self.jobSensors:
            job_status['sensors'].append(sensor)
            job_status[sensor] = st.get_temp(sensor)
        for relay in self.jobRelays:
            if self.relay.isOn(int(relay.split()[1])):
                job_status[relay] = 'ON'
            else:
                job_status[relay] = 'OFF'

        return job_status

    def stop(self):
        #print "Stopping job: ", self.jobName
        try:
            for i in range(len(self.runningJobs)):
                if self.runningJobs[i].name() == self.jobName:
                    #print "FOUND job to stop running"
                    # Move from runningJobs to stoppedJobs
                    self.stoppedJobs.append(self.runningJobs[i])
                    del self.runningJobs[i]
                    jdata = json.dumps({'type':'stopped_job',
                                        'data':{'jobName':self.jobName}})
                    self.output_queue.put(jdata)

                    # Finalise the run file
                    status = self.jobStatus(time.time())
                    status['running'] = 'stopped'

                    jdata = json.dumps({'type':'running_job_status',
                                        'data':status})
                    self.output_queue.put(jdata)

                    self.history.append(status)
                    with open(os.path.join(JOB_RUN_DIR, self.historyFileName), 'a') as f:
                        json.dump(status, f)
                        f.write(os.linesep)

                    break
        except Exception as e:
            print e

    def process(self):
        self.processing  = True
        accumulatedTime = 0.0
        #print "Processing job; ", self.jobName
        now = time.time()

        (job_done, target) = self.target_temperature(now)
        self.temperatureAdjust(target)

        status = self.jobStatus(now)
        if job_done:
            status['running'] = 'done'
        else:
            status['running'] = 'running'

        jdata = json.dumps({'type':'running_job_status',
                            'data':status})
        self.output_queue.put(jdata)
        self.history.append(status)
        with open(os.path.join(JOB_RUN_DIR, self.historyFileName), 'a') as f:
            json.dump(status, f)
            f.write(os.linesep)
        self.processing  = False

    def report(self):
        print "REPORT time"
        #print self.history

    def temperatureAdjust(self, target):
        relayIds = []
        for relay in self.jobRelays:
            relayIds.append(int(relay.split()[1]))
        #print "Relays:", relayIds
        if self.processType == "SIMPLE_COOL":
            # Assume a single sensor for a SIMPLE method
            temp = st.get_temp(self.jobSensors[0])
            #print "Temp: %s for target: %s" % (temp, target)

            # Single relay for COOL method
            coolerRelay = relayIds[0]

            # If temp == target, leave it alone
            if float(temp) > float(target):
                # Turn on the cooler relay.
                if not self.relay.isOn(coolerRelay):
                    self.relay.ON(coolerRelay)
                    self.liveUpdate()
                #print "Start COOLING"
            elif float(temp) < float(target):
                # Turn off the cooler relay.
                if self.relay.isOn(coolerRelay):
                    self.relay.OFF(coolerRelay)
                    self.liveUpdate()
                #print "Stop COOLING"
            else:
                if self.relay.isOn(coolerRelay):
                    self.relay.OFF(coolerRelay)
                    self.liveUpdate()
        elif self.processType == "SIMPLE_COOL_HEAT":
            # Assume a single sensor for a SIMPLE method
            temp = st.get_temp(self.jobSensors[0])
            #print "Temp: %s for target: %s" % (temp, target)

            # Assume 2 relays for COOL_HEAT method
            if len(relayIds) < 2:
                #print "Need 2 relays for COOL_HEAT method"
                # Cancel job somehow?
                return
            # Assume 1st is the cooler relay, 2nd is the heater
            coolerRelay = relayIds[0]
            heaterRelay = relayIds[1]

            # If temp == target, leave it alone
            if float(temp) > float(target):
                # Turn on the cooler relay.
                if not self.relay.isOn(coolerRelay):
                    self.relay.ON(coolerRelay)
                    self.liveUpdate()
                # Turn off the heater relay
                if self.relay.isOn(heaterRelay):
                    self.relay.OFF(heaterRelay)
                    self.liveUpdate()
                #print "Start COOLING"
            elif float(temp) < float(target):
                # Turn off the cooler relay.
                if self.relay.isOn(coolerRelay):
                    self.relay.OFF(coolerRelay)
                    self.liveUpdate()
                # Turn on the heater relay
                if not self.relay.isOn(heaterRelay):
                    self.relay.ON(heaterRelay)
                    self.liveUpdate()
                #print "Start HEATING"
            else:
                if self.relay.isOn(coolerRelay):
                    self.relay.OFF(coolerRelay)
                    self.liveUpdate()
                if self.relay.isOn(heaterRelay):
                    self.relay.OFF(heaterRelay)
                    self.liveUpdate()
        elif self.processType == "SIMPLE_HEAT":
            print "Using SIMPLE_HEAT method to temperatureAdjust: ", target


# ex:set ai shiftwidth=4 inputtab=spaces smarttab noautotab:
