var d3 = require("d3");
var cola = require("webcola");
var _ = require("lodash");

function runColaForce() {
  // var center = this._size.map(d => d/2);

  this.d3cola().start(this._iterations[0], this._iterations[1], this._iterations[2] + 5);
  var n = d3.sum(this._iterations + 5);
  for (var i = 0; i < n; ++i) d3cola().tick();

  d3cola().stop();

  this.d3cola().nodes().forEach(function(d) {
    d.variable = null;
    d.cIn = null;
    d.cOut = null;
    d.block = null;

    d.center = {
      x: d.x,
      y: d.y
    };
    return d;
  });

  this._links = this.d3cola().links().map(l => {
    l.source = l.source.index;
    l.target = l.target.index;
    return l;
  });

  return this;
}


function size(wh) {
  if (!wh) return this._size;
  this._size = wh;
  return this;
}

function iterations(i) {
  if (!i) return this._iterations;
  this._iterations = i;
  return this;
}

function start() {
  return runColaForce.bind(this)();
}

function links(arg) {
  if (!arg) return this._links;
  var links = arg;

  _.remove(this.d3cola().links());
  links.forEach(n => this.d3cola().links().push(n));
  this._links = this.d3cola().links();
  return this;
}

function nodes(arg) {
  if (!arg) return this.d3cola().nodes();
  var nodes = arg;

  this.d3cola().nodes().forEach(n => n.endure = false);

  nodes.forEach(d => {
    d.width = d.width || 10;
    d.height = d.height || 10;
  });

  var newNodes = nodes.reduce((acc, d, i) => {
    var oldNode = this.d3cola().nodes().find(n => n.id === d.id);
    if(oldNode) {
      oldNode.endure = true;
      oldNode.fixed = i % 2;
      d.color = d.color === "white" ? "yellow" : d.color;
    }
    else {
      switch(i % 3) {
        case 0:
          d.color = "white";
          break;
        case 1:
          d.color = "green";
          break;
        case 2:
          d.color = "red";
          break;
        }
      acc.push(d);
    }
    return acc;
  }, []);

  _.remove(this.d3cola().nodes(), n => !n.endure);
  newNodes.forEach(n => this.d3cola().nodes().push(n));
  return this;
}

const d3cola = () => {
  if (this._d3cola) return this._d3cola;
  var colaLayout = cola.d3adaptor()
  // .avoidOverlaps(true)
      .size([200, 200]);

  this._d3cola = colaLayout
      .nodes([])
      .links([])
      .flowLayout("y", 60)
      .symmetricDiffLinkLengths(7);

  return this._d3cola;
};

const graphLayout = function() {
  return {
    _size: [1, 1],
    _nodes: null,
    _links: null,
    _iterations: [30, 20, 70],

    d3cola: d3cola,
    nodes: nodes,
    links: links,
    size: size,
    iterations: iterations,
    start: start
  };
};

module.exports = graphLayout;
