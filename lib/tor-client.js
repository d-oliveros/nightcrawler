( function() {
	'use strict';

	var net = require('net'),
		events = require('events'),
		debug = require('debug')('nightcrawler:tor');

	var TorClient = exports = module.exports = function TorClient(config) {
		var self = this;

		this.authenticated = false;

		// Initialize the tor client
		var client = net.connect( config.controlPort, function() {
			debug('Connected to tor control interface.');
			debug('Authenticating using password: ' + config.password);

			// Authenticate the client on connection
			self.emit('authenticating', config.password);
			client.write('AUTHENTICATE "' + config.password + "\"\r\n");
		});

		this.client = client;

		// When we get a response
		client.on('data', function(data) {
			var message = data.toString().trim();

			if (message !== '250 OK') {
				self.emit('error', message);
			}
			
			else if (self.authenticated) {
				self.emit('message');
			}

			else {
				debug('Authenticated');
				self.authenticated = true;
				self.emit('authenticated');
			}
		});

		// Tor listener: Error
		client.on('error', function(err) {
			if ( err.code == 'ECONNREFUSED' )
				err.message = 'Connection to '+self.tor.config.controlPort+' refused.';

			self.emit('error', err);
		});
	};

	// `TorClient` is an `EventEmitter`
	TorClient.prototype = Object.create( events.EventEmitter.prototype );

	TorClient.prototype.write = function(data) {
		debug('Writing data: '+data);
		this.client.write(data);
	};

}());