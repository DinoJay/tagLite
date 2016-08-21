import * as d3 from "d3";
import cola from "webcola";

function runColaForce() {
  // var center = this._size.map(d => d/2);

  var colaLayout = cola.d3adaptor()
    .avoidOverlaps(true)
      // .linkDistance(100)
      .size(this._size);

  var d3cola = colaLayout
      .nodes(this._nodes)
      .links(this._links)
      // .jaccardLinkLengths(40,0.7)
      .flowLayout("y", 100);
      // .symmetricDiffLinkLengths(7);


  d3cola.start(...this._iterations);
  var n = d3.sum(this._iterations + 5);
  for (var i = 0; i < n; ++i) d3cola.tick();

  d3cola.stop();

  d3cola.nodes().forEach(function(d) {
    d.variable = null;
    d.cIn = null;
    d.cOut = null;
    d.block = null;
    d.r = d.w / 2;

      d.pos = {
        x: d.x,
        y: d.y,
        cx: d.x - d.w / 2,
        cy: d.y - d.h / 2
    };
    d.x = 0;
    d.y = 0;

    return d;
  });

  // this._links = d3cola().links().map(l => {
  //   l.source = l.source.index;
  //   l.target = l.target.index;
  //   return l;
  // });

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

  this._links = arg;
  return this;
}

function nodes(arg) {
  if (!arg) return this._nodes;
  var nodes = arg;

  var labelSize = 40;
  var sizeScale = d3.scaleLinear()
    .domain(d3.extent(nodes, d => d.nodes.length))
    .rangeRound([40 + labelSize, 200 + labelSize]);

  nodes.forEach(d => {
    d.width = sizeScale(d.nodes.length);
    d.height = d.width;
    d.w = d.width - labelSize;
    d.h = d.w;
  });

  this._nodes = nodes;
  return this;
}

const graphLayout = function() {
  return {
    _size: [1, 1],
    _nodes: null,
    _links: null,
    _iterations: [30, 20, 70],

    nodes: nodes,
    links: links,
    size: size,
    iterations: iterations,
    start: start
  };
};

export default graphLayout;
