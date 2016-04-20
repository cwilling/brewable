import sys, os, os.path
import subprocess

DS18B20_DEFAULT_DEVICE = '28-00000726d151'
FUDGE = -1.0

def isValidTempDevice (device_id = DS18B20_DEFAULT_DEVICE):
    device_path = '/sys/bus/w1/devices/' + device_id + '/w1_slave'
    if os.path.exists(device_path):
        return True
    else:
        return False

def get_temp (device_id = DS18B20_DEFAULT_DEVICE):
    device_path = '/sys/bus/w1/devices/' + device_id + '/w1_slave'
    if os.path.exists(device_path):
        try:
            temperature_file = open(device_path)
            text = temperature_file.read()
            temperature_file.close()
            temperaturedata = text.split(" ")[20]
            temperature = float(temperaturedata[2:]) / 1000
            return temperature + FUDGE;
        except:
            return '-0.0'
    else:
        temp = '-0.0'
        #print temp
        return temp


# ex:set ai shiftwidth=4 inputtab=spaces smarttab noautotab:
