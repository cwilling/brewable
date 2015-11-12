import sys, os, os.path
import subprocess

def get_temp ():
    if os.path.exists('/opt/vc/bin/vcgencmd'):
        try:
            s = subprocess.check_output(["/opt/vc/bin/vcgencmd","measure_temp"])
            temp = s.split('=')[1][:-3]
            #print temp
            return temp
        except:
            return '-0.0'
    elif os.path.exists('/sys/class/thermal/thermal_zone2/temp'):
        try:
            s = subprocess.check_output(["cat", "/sys/class/thermal/thermal_zone2/temp"])
            temp = str(float(s) / 1000)
            #print temp
            return temp
        except:
            return '-0.0'
    else:
        temp = '-0.0'
        #print temp
        return temp


# ex:set ai shiftwidth=4 inputtab=spaces smarttab noautotab:
