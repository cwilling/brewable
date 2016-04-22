import time
import multiprocessing
import json
import copy
import os, errno
from collections import deque

from ds18b20 import SensorDevice

_home = os.path.expanduser('~')
USER_CONFIG_DIR = os.environ.get('USER_CONFIG_DIR') or os.path.join(_home, '.brewable')
USER_CONFIG_FILE = os.path.join(USER_CONFIG_DIR, 'brewable.conf')

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
        self.configuration = {}
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
        # First, read user config or generate default configuration
        try:
            os.makedirs(USER_CONFIG_DIR)
        except OSError as exc:
            if exc.errno == errno.EEXIST and os.path.isdir(USER_CONFIG_DIR):
                pass
            else:
                raise

        # Load saved configuration
        try:
            with open(USER_CONFIG_FILE) as json_file:
                json_data = json.load(json_file)
                print "CONFIGURATION DATA: ", json_data
                #for k,v in json_data.iteritems():
                #    self.configuration[k] = v
                for k in json_data.keys():
                    self.configuration[k] = json_data[k]
        except Exception as e:
            print e
            print "Generating new configuration from defaults"
            # Can't open user config file - either corrupted or doesn't exist,
            # so generate a default config and save that.
            self.configuration['sensorFudgeFactor'] = float(0.0);
            self.configuration['multiSensorMeanWeight'] = int(50);
            self.configuration['relayDelayPostON'] = int(180);
            self.configuration['relayDelayPostOFF'] = int(480);
            #print "CONFIGURATION: ", self.configuration
            with open(USER_CONFIG_FILE, 'w') as json_file:
                json.dump(self.configuration, json_file)

        for k in self.configuration.keys():
            print "config item: ", k, self.configuration[k]



        # Look for sensor devices
        try:
            sensor_file = open(SensorDevice.deviceDirectory())
            sensors = sensor_file.read()
            sensor_file.close
            for sensorId in sensors.split():
                self.sensorDevices.append(SensorDevice(sensorId, self.configuration['sensorFudgeFactor']))
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

        # Relay DelaySets look like:
        # {'on_time':180, 'off_time':480, 'isset':False}
        for id in range(self.relay.device_count()):
            self.relay.setDelaySetValue(id+1, 'on_time', self.configuration['relayDelayPostON'])
            self.relay.setDelaySetValue(id+1, 'off_time', self.configuration['relayDelayPostOFF'])

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
                                j.process()
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
                    elif jmsg['type'] == 'config_change':
                        self.configChange(jmsg);
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
            if _TESTING_:
                for job in self.runningJobs:
                    job.process()
            else:
                if count % 20  == 0:
                    for job in self.runningJobs:
                        job.process()




            count += 1

            #time.sleep(1)


    def configChange(self, jmsg):
        print "configChange() ", jmsg['data'], jmsg['data'].keys()
        for k in jmsg['data'].keys():
            try:
                print "Processing config change for: ", k,jmsg['data'][k]
                if k == 'multiSensorMeanWeight':
                    print "Changing config item %s to %d" % (k,int(jmsg['data'][k]))
                    self.configuration['multiSensorMeanWeight'] = int(jmsg['data'][k])
                    print "Changed multiSensorMeanWeight configuration to: ", self.configuration['multiSensorMeanWeight']
                elif k == 'sensorFudgeFactor':
                    print "Changing config item %s to %f" % (k,float(jmsg['data'][k]))
                    for sensor in self.sensorDevices:
                        sensor.set_fudge(float(jmsg['data'][k]))
                    self.configuration['sensorFudgeFactor'] = self.sensorDevices[0].get_fudge()
                    print "Changed fudge configuration to: ", self.configuration['sensorFudgeFactor']
                elif k == 'relayDelayPostON':
                    # {'on_time':180, 'off_time':480, 'isset':False}
                    print "Changing config item %s to %d" % (k,int(jmsg['data'][k]))
                    for id in range(self.relay.device_count()):
                        self.relay.setDelaySetValue(id+1, 'on_time', int(jmsg['data'][k]))
                    self.configuration['relayDelayPostON'] = self.relay.getDelaySetValue(1, 'on_time')
                    print "Changed relay on_time configuration to: ", self.configuration['relayDelayPostON']
                elif k == 'relayDelayPostOFF':
                    print "Changing config item %s to %d" % (k,int(jmsg['data'][k]))
                    for id in range(self.relay.device_count()):
                        self.relay.setDelaySetValue(id+1, 'off_time', int(jmsg['data'][k]))
                    self.configuration['relayDelayPostOFF'] = self.relay.getDelaySetValue(1, 'off_time')
                    print "Changed relay off_time configuration to: ", self.configuration['relayDelayPostOFF']
                else:
                    print "Unknown configuration item: ", k
                with open(USER_CONFIG_FILE, 'w') as json_file:
                    json.dump(self.configuration, json_file)
            except Exception as e:
                print "Unable to process configChange for item:", k
                print e

    def loadStartupData(self, jmsg):
        jdata = json.dumps({'type':'startup_data',
                            'data':{'testing':_TESTING_,
                                    'config':self.configuration,
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
            #sensor_state = list({'sensorId':sensor.getId(),'temperature':st.get_temp(sensor.getId())} for sensor in self.sensorDevices)
            sensor_state = list({'sensorId':sensor.getId(),'temperature':sensor.get_temp()} for sensor in self.sensorDevices)
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
        #print "live_update jdata: ", jdata

    def setupJobRun(self, jobIndex):
        try:
            self.runningJobs.append(JobProcessor(copy.deepcopy(self.jobs[jobIndex]), self.output_queue, self.runningJobs, self.stoppedJobs, self.relay, self.sensorDevices, self.configuration))
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

    def __init__(self, rawJobInfo, output_queue, runningJobs, stoppedJobs, relay, sensorDevices, configuration):
        self.configuration = configuration
        self.sensorDevices = sensorDevices
        self.runningJobs = runningJobs
        self.stoppedJobs = stoppedJobs
        self.output_queue = output_queue
        self.jobName    = rawJobInfo['name']
        self.jobPreheat = rawJobInfo['preheat']
        self.jobProfile = self.convertProfileTimes(rawJobInfo['profile'])
        self.jobSensorIds = self.validateSensors(rawJobInfo['sensors'])
        self.jobSensors = {sensor.getId():sensor for sensor in sensorDevices if sensor.getId() in self.jobSensorIds}
        self.jobRelays  = rawJobInfo['relays']
        self.startTime  = time.time()
        self.instanceId = time.strftime("%Y%m%d_%H%M%S",time.localtime(self.startTime))
        self.historyFileName = (self.name()  + "-"
                                            + self.instanceId
                                            + ".txt")
        self.processing  = False
        self.relay = relay
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
                  'jobSensorIds':self.jobSensorIds,
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
              'jobSensorIds':self.jobSensorIds,
              'jobRelays':self.jobRelays,
              'startTime':self.startTime,
             }
        return info

    def name(self):
        return self.jobName

    def profile(self):
        return self.jobProfile

    # Confirm specififed sensors exist in the system
    def validateSensors(self, sensorIds):
        valid_ids = [sensor.getId() for sensor in self.sensorDevices]
        valid_sensorIds = []
        for sensor in sensorIds:
            if sensor in valid_ids:
                valid_sensorIds.append(sensor)
            else:
                print "NOT validated: ", sensor
        return valid_sensorIds

    # Convert profile's duration fields into seconds
    # To speed testing, assume duration fields are minutes.seconds
    # whereas real version will have hours.minutes
    def convertProfileTimes(self, profile):
        hrs = mins = secs = '0';
        durMins = 0;
        for sp in profile:
            (hrs,dot,mins) = sp['duration'].partition('.')
            if len(hrs) > 0:
                durMins = 60 * int(hrs)
            else:
                durMins = 0
            if len(mins) > 0:
                durMins += int(mins)
            if _TESTING_:
                sp['duration'] = str(durMins)
            else:
                sp['duration'] = str(durMins * 60)
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
        for sensor in self.jobSensorIds:
            job_status['sensors'].append(sensor)
            job_status[sensor] = self.jobSensors[sensor].get_temp()
        for relay in self.jobRelays:
            if self.relay.isOn(int(relay.split()[1])):
                job_status[relay] = 'ON'
            else:
                job_status[relay] = 'OFF'
        if len(self.jobSensorIds) > 1:
            job_status['msmw'] = self.configuration['multiSensorMeanWeight']

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
        self.report()
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
        print "REPORT time", time.asctime()
        #print self.history

    def temperatureAdjust(self, target):
        relayIds = []
        for relay in self.jobRelays:
            relayIds.append(int(relay.split()[1]))
        #print "Relays:", relayIds

        if len(self.jobSensors) == 1:
            temp = self.jobSensors[self.jobSensorIds[0]].get_temp()
            print "Single temp: %s for target: %s" % (temp, target)
        elif len(self.jobSensors) == 2:
            temp0 = float(self.jobSensors[self.jobSensorIds[0]].get_temp())
            temp1 = float(self.jobSensors[self.jobSensorIds[1]].get_temp())
            mswm = float(self.configuration['multiSensorMeanWeight'])
            temp = (temp1 * mswm + temp0 * (100-mswm))/100.0
            #print "MSMW temp: {:.2f} for target: {:02}".format(temp, target)
        else:
            print "No recpipe for %d sensors" % len(self.jobSensors)

        if len(self.jobRelays) == 1:
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
        elif len(self.jobRelays) == 2:
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
        else:
            print "No recipe for %d relays" % len(self.jobRelays)


# ex:set ai shiftwidth=4 inputtab=spaces smarttab noautotab:
