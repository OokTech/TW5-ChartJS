/*\
title: $:/plugins/OokTech/ChartJS/viewChart.js
type: application/javascript
module-type: widget

The view3js widget displays a chart created by ChartJS.

```
<$view3js tiddler="TiddlerTitle" width="320" height="400" class="classnames"/>
```

The widget generates an HTML5 WebGL node with a 3D view produced by main javascript code tiddler.

The width and height attributes are interpreted as a number of pixels, and do not need to include the "px" suffix.
The path attribute contains a collection of pseudo-path directory to search files to be loaded.

\*/
(function() {

/*jslint node: true, browser: true */
/*global $tw: false */
"use strict";

var CONST_NODE_ID_PREFIX = "ThreejsWidget"; // prefix of root node's id attribute
var CONST_MIN_HEIGHT = 300;                 // root node minimal height
var CONST_PLUGIN_PATH = "$:/plugins/rboue/Three.js";
var CONST_CONFIG_TIDDLER = "$:/config/rboue/Three.js";
var CONST_CONFIG_DEFAULT_TIDDLER = CONST_PLUGIN_PATH+"/config.json";

// Get session configuration.
var sessionConfig = null;
var configTiddler = $tw.wiki.getTiddler(CONST_CONFIG_TIDDLER);
if ((typeof(configTiddler) != "undefined") && configTiddler) {
  sessionConfig = $tw.wiki.getTiddlerData(configTiddler, null)
}
if (!sessionConfig) {
  var configTiddlerDefault = $tw.wiki.getTiddler(CONST_CONFIG_DEFAULT_TIDDLER);
  if ((typeof(configTiddlerDefault) != "undefined") && configTiddlerDefault) {
    sessionConfig = $tw.wiki.getTiddlerData(configTiddlerDefault, null)
  }
}

// Create objects
var Widget = require("$:/core/modules/widgets/widget.js").widget;
//var StringView = require("./Lib/stringview.js").StringView;
//var TiddlyWiki = require("./tiddlywiki.js").TiddlyWiki;
//TiddlyWiki.init(sessionConfig);

var View3jsWidget = function(parseTreeNode,options) {
  this.initialise(parseTreeNode,options);
};
View3jsWidget.instanceNb = 0; // count class instances

// Inherit from the base widget class
View3jsWidget.prototype = new Widget();

//=======================================================================================

// Render this widget into the DOM
View3jsWidget.prototype.render = function(parent,nextSibling) {
  var fonc = "View3jsWidget.render";
  var self = this;
/*
  // Debug tools
  var hack = {
    flagActiv: true, // Activate the logs
    log: function(mess, flagNoLog, fonc) {
      if (!hack.flagActiv || flagNoLog) return;
      var id = "[]";
      if (tiddlyWiki) id = "["+tiddlyWiki.widget.nodeRootId+"]";
      console.log(id+(fonc ? fonc+": " : "")+mess);
    },
    logPoint: function(x,y) {return "("+x+","+y+")";},
    // Following are flags activating logs for specific fonctionnalities.
    // Value : false to activate, true to desactivate (no log).
    bug: false,      // current bug investigation
    filesystem: true, // filesystem
    loader: true,     // loader
    sceneLoader: true,  // Scene loader
    render: true      // rendering
  };
  window.hack = hack;
*/
  // Create objects (continued)
  // Unfortunately, we can't create THREE object at TiddlyWiki start time (i.e. before
  // any widget instance) :
  //   There is a complaint "ReferenceError: Float32Array is not defined" because a lot
  //   of code is running at load time (many functions auto-defines themselves, allocating
  //   Float32Array and returning a sub-function.
  //   Float32Array is an object specific to WebGL. It seems that TiddlyWiki denies the use
  //   of WebGL in sandbox environment !
  // The THREE module is loaded only once, thanks to the TiddlyWiki's load mechanism.
  //window.StringView = StringView;
  //window.TiddlyWiki = TiddlyWiki;
  //window.THREE = require("./Lib/three-min.js").THREE;

  this.parentDomNode = parent;
  this.computeAttributes();
  this.execute();

  // Create element and assign attributes
  this.nodeRoot = this.document.createElement("canvas");
  this.nodeRootId = "myChart";//CONST_NODE_ID_PREFIX + "-" + ++View3jsWidget.instanceNb;
  this.nodeRoot.setAttribute("id", this.nodeRootId);
  if (this["class"])
    this.nodeRoot.setAttribute("class", this["class"]);
  if (this.width) {
    var widthStyle = parseInt(this.width,10) + "px";
    this.nodeRoot.setAttribute("width", widthStyle);
    this.nodeRoot.style.width = widthStyle;
  }
  if (this.height) {
    var heightStyle = parseInt(this.height,10) + "px";
    this.nodeRoot.setAttribute("height", heightStyle);
    this.nodeRoot.style.height = heightStyle;
  } else {
    this.nodeRoot.setAttribute("height", "" + CONST_MIN_HEIGHT + "px");
    this.nodeRoot.style.height = "" + CONST_MIN_HEIGHT + "px";
  }

  // Insert element
  parent.insertBefore(this.nodeRoot,nextSibling);
  this.domNodes.push(this.nodeRoot);

  // UI template
  var uiNodeCreate = function(id, that) {
    // Create a node : <div id="<id>"></div>
    var node = that.document.createElement("div");
    node.setAttribute("id", id);
    parent.insertBefore(node, nextSibling);
    that.domNodes.push(node);
    return node;
  };
  this.nodeError = uiNodeCreate(this.nodeRootId + "-error", this);

  // Test browser compatibility with WebGL
  var webgl = (function () {
    try {
      var canvas = document.createElement("canvas");
      return !! window.WebGLRenderingContext && (canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));
    } catch(e) {
      return false;
    }
  })();
  if (!webgl) {
    this.nodeError.innerHTML = window.WebGLRenderingContext ?
      'Your graphics card does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" target="_blank">WebGL</a>.<br/>' +
      'Find out how to get it <a href="http://get.webgl.org/" target="_blank">here</a>.'
      :
      'Your browser does not seem to support <a href="http://khronos.org/webgl/wiki/Getting_a_WebGL_Implementation" target="_blank">WebGL</a>.<br/>' +
      'Find out how to get it <a href="http://get.webgl.org/" target="_blank">here</a>.';
    return;
  }

  // Get code tiddler
  if (!this.tiddler) {
    this.nodeError.innerHTML = "Error: you must specify a code tiddler";
    return;
  }
  var tiddler = this.wiki.getTiddler(this.tiddler);
  if ((typeof(tiddler) == "undefined") || !tiddler) {
    this.nodeError.innerHTML = "Error: unknown tiddler: "+this.tiddler;
    return;
  }

  // Get widget configuration
  var widgetConfig = {};
  if (this.path) {
    widgetConfig.filesystem = {PATH: this.path};
  } else {
    if (sessionConfig && sessionConfig.filesystem) {
      widgetConfig.filesystem = {};
      if (sessionConfig.filesystem.PATH)
        widgetConfig.filesystem.PATH = sessionConfig.filesystem.PATH;
    }
  }

  //window.tiddlyWiki = new TiddlyWiki(this, this.tiddler, widgetConfig);

  // Create viewer

  // Execute user code
  // Prototype :
  //   function main(input)
  //     Returns : {onTiddlerRefresh: <refresh function>}
  //
  this.input = {node: this.nodeRoot};
  try {
    this.output = eval(tiddler.fields.text+";main(this.input, this.opts);");
  } catch(e) {
    this.nodeError.innerHTML = "Error when executing javascript code in <b>"+this.tiddler+"</b> tiddler :<br><b>"+e+"</b>";
    alert("Stop on error"); // stop debug and log in case of deaf mad program
  }
};

// Compute the internal state of the widget
View3jsWidget.prototype.execute = function() {
  // Get our parameters
  this.tiddler = this.getAttribute("tiddler");
  this.width = this.getAttribute("width");
  this.height = this.getAttribute("height");
  this.path = this.getAttribute("path");
  this["class"] = this.getAttribute("class");
  this.opts = this.getAttribute("opts", undefined);

  if (this.opts) {
    try {
      this.opts = JSON.parse(this.opts);
    } catch (e) {

    }
  } else {
    this.opts = {};
  }
};

// Selectively refreshes the widget if needed. Returns true if the widget or any
// of its children needed re-rendering
View3jsWidget.prototype.refresh = function(changedTiddlers) {
  var fonc = "View3jsWidget.refresh";

  var changedAttributes = this.computeAttributes();
  if (changedAttributes.tiddler ||
      changedAttributes.width ||
      changedAttributes.height ||
      changedAttributes.path ||
      changedAttributes["class"] ||
      changedTiddlers[this.tiddler]) {
    this.refreshSelf();
    //hack.log("after this.refreshSelf()", false, fonc);
    return true;
  } else {
    //hack.log("other case", false, fonc);
    if (this.output && this.output.onTiddlerRefresh) this.output.onTiddlerRefresh();
    return false;
  }
};

exports.viewChart = View3jsWidget;

})();
