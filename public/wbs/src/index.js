var EventEmitter = require('events').EventEmitter
var inherits = require('inherits')

var Display = require('./display/display')
var mixer = require('./lib/mixer')
var rtmp = require('./lib/rtmp')

inherits(WBS, EventEmitter)

function WBS (element, opts) {
  var self = this
  if (!(self instanceof WBS)) return new WBS(element, opts)

  if (typeof element === 'string') {
    element = document.querySelector(element)
  }

  opts = opts || {}
  
  var audioContext = new AudioContext()

  mixer.setAudioContext(audioContext)
  opts.output = opts.output || {
    width: 1280,
    height: 720,
    fps: 24,
    audioContext: audioContext
  }
  opts.inputs = opts.inputs || []
  opts.injectStyles = opts.injectStyles || true

  if (opts.injectStyles) require('./../less/wbs.css')

  self._display = new Display(element, opts)

  rtmp.onStop = ()=>{
    console.log("Stopped From Server");
    self._display.controls.stopStream();
  };
  rtmp.onAlreadyInUse = ()=>{
    console.log("Already in use");
    alert("RTMP flux is already in use");
  };
  self._display.on('stream', function (stream) {
    self.emit('stream', stream)
    rtmp.connectServer();
    rtmp.startStreaming(stream);
  })
  self._display.on('stopstream', function () {
    self.emit('stopstream')
    rtmp.stopStreaming();
  })
}

module.exports = WBS
