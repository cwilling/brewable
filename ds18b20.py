import sys, os, os.path
import subprocess

DEVICE_DIR = '/sys/bus/w1/devices/w1_bus_master1/w1_master_slaves'

DS18B20_DEFAULT_DEVICE = '28-00000726d151'
#FUDGE = -1.0
#
#def isValidTempDevice (device_id = DS18B20_DEFAULT_DEVICE):
#    device_path = '/sys/bus/w1/devices/' + device_id + '/w1_slave'
#    if os.path.exists(device_path):
#        return True
#    else:
#        return False
#
#def get_temp (device_id = DS18B20_DEFAULT_DEVICE):
#    device_path = '/sys/bus/w1/devices/' + device_id + '/w1_slave'
#    if os.path.exists(device_path):
#        try:
#            temperature_file = open(device_path)
#            text = temperature_file.read()
#            temperature_file.close()
#            temperaturedata = text.split(" ")[20]
#            temperature = float(temperaturedata[2:]) / 1000
#            return temperature + FUDGE;
#        except:
#            return '-0.0'
#    else:
#        temp = '-0.0'
#        #print temp
#        return temp

class SensorDevice():
    @staticmethod
    def deviceDirectory():
        return DEVICE_DIR

    def __init__(self, id, fudge=0.0):
        self._id = id
        self._name = ""
        self._fudge = float(fudge)
        self._device_path = os.path.join('/sys/bus/w1/devices/', self._id, 'w1_slave')
        if os.path.exists(self._device_path):
            print "Found sensor device: ", self._id
        else:
            raise ValueError('No such sensor device ')

    def getId(self):
        return self._id

    def set_fudge(self, val):
        self._fudge = float(val)

    def get_fudge(self):
        return self._fudge

    def isValidTempDevice(self):
        print "XXXXXXXXXX ", self._device_path
        if os.path.exists(self._device_path):
            return True
        else:
            return False

    def get_temp(self):
        device_path = '/sys/bus/w1/devices/' + self._id + '/w1_slave'
        if os.path.exists(device_path):
            try:
                temperature_file = open(device_path)
                text = temperature_file.read()
                temperature_file.close()
                temperaturedata = text.split(" ")[20]
                temperature = float(temperaturedata[2:]) / 1000
                return temperature + self.get_fudge();
            except:
                return '-0.0'
        else:
            temp = '-0.0'
            #print temp
            return temp


# ex:set ai shiftwidth=4 inputtab=spaces smarttab noautotab:
