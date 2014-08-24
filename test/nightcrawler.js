var should = require('chai').should(),
	expect = require('chai').expect,
	_ = require('lodash'),
	q = require('q');

var settings = require('./settings'),
	Nightcrawler = require('../index.js'),
	nightcrawler = new Nightcrawler(settings);


describe('Nightcrawler', function() {
	this.timeout(300000); // 5 mins

	it('should return the current external IP', function(done) {
		nightcrawler.getIp().then( function(ip) {

			ip.should.exist;
			ip.should.be.a('string');
			ip.should.have.length.above(6);

			done();
		});
	});

	it('should change your external IP', function(done) {
		var previousIp = nightcrawler.ip;

		nightcrawler.changeIp().then( function(newIp) {
			newIp.should.be.a('string');
			newIp.should.not.equal(previousIp);

			done();
		});
	});

	it('should return the current status', function(done) {

		nightcrawler.info().then( function(info) {

			info.should.be.an('object');
			info.usingTor.should.be.a('boolean');

			info.ip.should.be.a('string');
			info.ip.should.have.length.above(6);

			done();
		});
	});
});