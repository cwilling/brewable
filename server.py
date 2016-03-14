#!/usr/bin/env python

import tornado.httpserver
import tornado.ioloop
import tornado.web
import tornado.websocket
import tornado.gen
from tornado.options import define, options
import os
import time
import multiprocessing
import json
import gpioworker
 
define("port", default=7080, help="run on the given port", type=int)
 
#clients = [] 
clients = set()

input_queue = multiprocessing.Queue()
output_queue = multiprocessing.Queue()


 
class IndexHandler(tornado.web.RequestHandler):
    def get(self):
        self.render('status.html')
 
class ProfileHandler(tornado.web.RequestHandler):
    def get(self):
        self.render('profiles.html')

class StaticFileHandler(tornado.web.RequestHandler):
	def get(self):
		self.render('main.js')
 
class WebSocketHandlerStatus(tornado.websocket.WebSocketHandler):
    def open(self):
        print '(status) new connection'
        clients.add(self)
	jdata = json.dumps({'type':'info','data':'status page connected'})
	print "New connection SSS %d" % len(clients)
        #self.write_message("SSS connected")
        self.write_message(jdata)
 
    def on_message(self, message):
        #print 'tornado received from client: %s' % json.dumps(message)
        print 'tornado received from client (SSS): %s' % message
        self.write_message('SSS ack')
        input_queue.put(message)
 
    def on_close(self):
        clients.discard(self)
        print "connection closed %d" % len(clients)
 
class WebSocketHandlerProfiles(tornado.websocket.WebSocketHandler):
    def open(self):
        print '(profiles) new connection'
        clients.add(self)
	jdata = json.dumps({'type':'info','data':'profile page connected'})
	print "New connection PPP %d" % len(clients)
        #self.write_message("PPP connected")
        self.write_message(jdata)
 
    def on_message(self, message):
        #print 'tornado received from client: %s' % json.dumps(message)
        print 'tornado (PPP) received from client (PPP): %s' % message
        self.write_message('PPP ack')
        input_queue.put(message)
 
    def on_close(self):
        print 'PPP connection closed'
        clients.discard(self)


## check the queue for pending messages, and relay that to all connected clients
def checkQueue():
	if not output_queue.empty():
		message = output_queue.get()
		for c in clients:
			c.write_message(message)
			print "YYY " + message


if __name__ == '__main__':
	## start the device worker in background (as a deamon)
	gpio = gpioworker.GPIOProcess(input_queue, output_queue)
	gpio.daemon = True
	gpio.start()
	tornado.options.parse_command_line()
	app = tornado.web.Application(
	    handlers=[
	        (r"/", IndexHandler),
	        (r"/profile", ProfileHandler),
	        (r"/static/(.*)", tornado.web.StaticFileHandler, {'path':  './'}),
	        (r"/wsStatus", WebSocketHandlerStatus),
	        (r"/wsProfiles", WebSocketHandlerProfiles)
	    ]
	)
	httpServer = tornado.httpserver.HTTPServer(app)
	httpServer.listen(options.port)
	print "Listening on port:", options.port

	mainLoop = tornado.ioloop.IOLoop.instance()
	## adjust the scheduler_interval according to the frames sent by the device port
	scheduler_interval = 100
	scheduler = tornado.ioloop.PeriodicCallback(checkQueue, scheduler_interval, io_loop = mainLoop)
	scheduler.start()
	mainLoop.start()
