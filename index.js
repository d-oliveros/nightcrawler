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
( function() {
	var debug = require('debug')('nightcrawler'),
		debugInternal = require('debug')('nightcrawler:internal'),
		request = require('request').defaults({jar: true}),
		cheerio = require('cheerio'),
		_ = require('lodash'),
		http = require('http'),
		net = require('net'),
		q = require('q');

	var TorClient = require('./lib/tor-client');

	function Nightcrawler(params) {
		var deferred = q.defer(),
			self = this;

		debug('Creating new Nightcrawler with params:', '\n', _.pick(params, ['proxy', 'tor']));

		this.proxy             = params.proxy || null;
		this.ipCheckerDelay    = params.ipCheckerDelay || 3000;

		this.waitForConnection = deferred.promise;
		this.resolveConnection = deferred.resolve;
		

		this.concealTimeout    = null
		this.promises          = [];
		this.authenticated     = false;
		this.ip                = null;

		// Handle the tor client
		var client = this.torClient = new TorClient(params.tor);

		client.on('authenticated', function() {

			// Resolve the connection
			self.resolveConnection();

			// set our external IP (no need to wait)
			self.getIp().then( function(ip) {
				self.ip = ip;
			});
		});

		client.on('message', function(message) {

			// Clear the promises queue
			if ( !_.isEmpty(self.promises) ) {
				_.each( self.promises, function(promise) {
					promise.resolve();
					_.pull(self.promises, promise);
				});
			}
		});
	};

	Nightcrawler.TorClient = TorClient;

	// Changes your IP
	//
	Nightcrawler.prototype.changeIp = function(originalDeferred) {
		var internalDeferred = q.defer(),
			deferred = originalDeferred || q.defer(),
			self = this,
			previousIp;

		self.waitForConnection.then( function() {

			// Signal the IP address change to tor
			debug('Changing the IP.');
			self.promises.push(internalDeferred);
			self.torClient.write("SIGNAL NEWNYM\r\n");

			// then...
			internalDeferred.promise.then( function() {

				// check if your IP has changed
				previousIp = self.ip;
				self.getIp().then( function(ip) {

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
}());