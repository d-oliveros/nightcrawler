/*

 ███▄    █ ██▓ ▄████ ██░ ██▄▄▄█████▓▄████▄  ██▀███  ▄▄▄      █     █░██▓   ▓█████ ██▀███  
 ██ ▀█   █▓██▒██▒ ▀█▓██░ ██▓  ██▒  ▓▒██▀ ▀█ ▓██ ▒ ██▒████▄   ▓█░ █ ░█▓██▒   ▓█   ▀▓██ ▒ ██▒
▓██  ▀█ ██▒██▒██░▄▄▄▒██▀▀██▒ ▓██░ ▒▒▓█    ▄▓██ ░▄█ ▒██  ▀█▄ ▒█░ █ ░█▒██░   ▒███  ▓██ ░▄█ ▒
▓██▒  ▐▌██░██░▓█  ██░▓█ ░██░ ▓██▓ ░▒▓▓▄ ▄██▒██▀▀█▄ ░██▄▄▄▄██░█░ █ ░█▒██░   ▒▓█  ▄▒██▀▀█▄  
▒██░   ▓██░██░▒▓███▀░▓█▒░██▓ ▒██▒ ░▒ ▓███▀ ░██▓ ▒██▒▓█   ▓██░░██▒██▓░██████░▒████░██▓ ▒██▒
░ ▒░   ▒ ▒░▓  ░▒   ▒ ▒ ░░▒░▒ ▒ ░░  ░ ░▒ ▒  ░ ▒▓ ░▒▓░▒▒   ▓▒█░ ▓░▒ ▒ ░ ▒░▓  ░░ ▒░ ░ ▒▓ ░▒▓░
         ░ ░       ░ ░  ░  ░       ░ ░        ░          ░  ░   ░       ░  ░  ░  ░  ░     
                                   ░                                                      
/*
/**  Tor Control + Anonymizer
/*   MIT - David Oliveros 2014
*/

var debug = require('debug')('nightcrawler'),
	debugInternal = require('debug')('nightcrawler:internal'),
	cheerio = require('cheerio'),
	request = require('request'),
	_ = require('lodash'),
	http = require('http'),
	net = require('net'),
	q = require('q');


function Nightcrawler(params) {
	var self = this,
		deferred = q.defer();

	debug('Creating new Nightcrawler with params:', '\n', _.pick(params, ['proxy', 'tor']));

	this.proxy             = params.proxy || null;
	this.ipCheckerDelay    = params.ipCheckerDelay || 3000;

	this.waitForConnection = deferred.promise;
	this.resolveConnection = deferred.resolve;
	this.concealTimeout    = null
	this.promises          = [];
	this.authenticated     = false;
	this.ip                = null;

	this.tor               = {
		client: null,
		config: params.tor,
	};

	// Get our external IP
	this.getIp().then( function(ip) {
		self.ip = ip;
	});

	// Start Tor's control interface
	this.startTorClient();
};


// Initiates the TorControl interface
//
Nightcrawler.prototype.startTorClient = function() {
	var self = this;

	if ( !_.isEmpty( this.tor.client) )
		throw new Error('Can not restart tor client.');

	// Initialize the tor client
	this.tor.client = net.connect(self.tor.config.controlPort, function() {
		debugInternal('Connected to tor control interface.');
		debugInternal('Authenticating using password: ' + self.tor.config.password);

		// Authenticate the client on connection
		self.tor.client.write('AUTHENTICATE "' + self.tor.config.password + "\"\r\n");
	});

	// Tor listener: Data
	this.tor.client.on('data', function(data) {
		var message = data.toString().trim();

		if (message !== '250 OK')
			return debug('Received message, but was not OK: ' + message);
		
		if (self.authenticated) {

			// Resolve any promises
			if ( !_.isEmpty( self.promises ) ) {
				_.each(self.promises, function(promise) {
					promise.resolve();
				});
				self.promises = [];
			}
		}

		else {
			debug('Successfully authenticated.');

			self.authenticated = true;
			self.resolveConnection();
		}
	});

	// Tor listener: Error
	this.tor.client.on('error', function(err) {
		if (err.code == 'ECONNREFUSED')
			console.error('Nightcrawler: Connection to '+self.tor.config.controlPort+' refused.');
		else 
			console.log(err);
	});
};


// Changes your IP
//
Nightcrawler.prototype.changeIp = function(originalDeferred) {
	var internalDeferred = q.defer(),
		deferred = originalDeferred || q.defer(),
		self = this,
		previousIp;

	self.waitForConnection.then( function() {

		// Signal the IP address change to tor
		debugInternal('Sending a NEWNYM signal to tor control');
		self.tor.client.write("SIGNAL NEWNYM\r\n");
		
		self.promises.push(internalDeferred);

		internalDeferred.promise.then( function() {

			// Get your current IP
			previousIp = self.ip;
			self.getIp().then( function(ip) {

				// Check if the IP has actually changed
				if ( previousIp !== ip ) {
					debug('Changed IP: New IP is '+ip+'. (Was '+previousIp+')');
					deferred.resolve(ip);
				}

				else {
					debugInternal('IP remains the same. Retrying in '+(self.ipCheckerDelay/1000)+' seconds.');
					
					// Try to change the IP again
					setTimeout( function() { 
						self.changeIp(deferred);
					}, self.ipCheckerDelay);
				}

				debug(message);
			});
		});
	});

	return deferred.promise;
};


// Get the current external IP
//
Nightcrawler.prototype.getIp = function() {
	var deferred = q.defer(),
		self = this;

	this.info().then( function(info) {
		if ( !info.usingTor )
			console.warn('Warning: Not using TOR.');

		self.ip = info.ip;
		deferred.resolve(info.ip);
	}, deferred.reject);
	
	return deferred.promise;
};


// Change the external IP every x seconds,
// or stop changing the IP if delay == 0
//
Nightcrawler.prototype.conceal = function(delay) {
	var intervalDelay = ( delay || 30 )*1000,
		self = this;
	
	// Clear any previous timeout
	clearTimeout(self.concealTimeout);

	var concealCallback = function() { 
		self.changeIp().then( function() {
			self.concealTimeout = setTimeout(concealCallback, intervalDelay);
		}); 
	};

	if ( delay > 0 ){
		debug('Changing my IP every '+(intervalDelay/1000)+' seconds.');
		self.concealTimeout = setTimeout(concealCallback, intervalDelay);
	}

	else
		debug('Stopped changing the IP.');
};


// Returns information: Tor connection status and external IP
//
Nightcrawler.prototype.info = function() {
	var deferred = q.defer();

	request({
		url: 'https://check.torproject.org',
		proxy: this.proxy,

	}, function(err, res, body) {
		if (err) return deferred.reject(err);

		var $ = cheerio.load(body);
		
		var info = {
			usingTor: $('h1').hasClass('not'),
			ip: $('p strong').text(),
		};

		deferred.resolve(info);
	});

	return deferred.promise;
};

exports = module.exports = Nightcrawler;