import * as d3 from "d3";
import cola from "webcola";

function runColaForce() {
  // var center = this._size.map(d => d/2);
  var size = this._size;
  var colaLayout = cola.d3adaptor()
    .avoidOverlaps(true)
      // .linkDistance(100)
      .size(size);

  var d3cola = colaLayout
      .nodes(this._nodes)
      .links(this._links)
      // .jaccardLinkLengths(40,0.7)
        .flowLayout("y", 50);
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
    // TODO: fix
    d.x = size[0] * 1/3;
    d.y = size[1] * 1/3;

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

  var links = arg;
  var nodes = this._nodes;
  var cc = nodes.length;

  var newLinks = [];
  links.forEach(link => {
      var s = link.source = nodes[link.source],
          t = link.target = nodes[link.target],
          dummy = {
            "__key__": s.id + t.id + "dummy",
            dummy: true,
            interSet: link.interSet,
            src: s,
            tgt: t,
            r: 10,
            width: 15,
            height: 15,
            w: 10,
            h: 10
          }; // intermediate
      nodes.push(dummy);
      newLinks.push({source: link.source, target: cc, cut: link.cut,
        outLinks: s.outLinks},
        {source: cc, target: link.target, cut: link.cut, outLinks: t.outLinks});
      cc += 1;
  });
  this._links = newLinks;

  return this;
}

function nodes(arg) {
  if (!arg) return this._nodes;
  var nodes = arg;
  // var min = d3.min(nodes, d => d.nodes.length);
  var labelSize = 40;
  var sizeScale = d3.scaleLinear()
    .domain([1, 100])
    .rangeRound([40 + labelSize, 300 + labelSize]);

  nodes.forEach(d => {
    d.width = sizeScale(d.nodes.length);
    d.height = d.width;
    d.w = d.width - labelSize;
    d.h = d.w;
    d.r = d.w / 2;
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
