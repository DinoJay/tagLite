import * as d3 from "d3";
import cola from "webcola";
import _ from "lodash";

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
      .jaccardLinkLengths(40,0.7)
      // .flowLayout("y", 50)
      .symmetricDiffLinkLengths(7);


  d3cola.start(...this._iterations);
  var n = d3.sum(this._iterations + 5);
  for (var i = 0; i < n; ++i) d3cola.tick();

  d3cola.stop();

  d3cola.nodes().forEach(function(d) {
    // d.variable = null;
    // d.cIn = null;
    // d.cOut = null;
    // d.block = null;

      d.pos = {
        x: d.x,
        y: d.y
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
          sTags = s.sets.reduce((acc, d) => acc.concat(d.intersetArray), []),
          tTags = t.sets.reduce((acc, d) => acc.concat(d.intersetArray), []),
          is = _.intersection(sTags, tTags),
          dummy = {
            id: s.id + t.id + "dummy",
            dummy: true,
            interSet: is,
            src: s,
            tgt: t,
            r: this._dummyRad,
            width: this._dummyRad + this._offset,
            height: this._dummyRad + this._offset
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

  this._nodes = arg;
  this._nodes.forEach(n => {
    n.width = n.r * 2 + this._offset;
    n.height = n.r * 2 + this._offset;
  });
  return this;
}

function offset(arg) {
  if (!arg) return this._offset;
  // var min = d3.min(nodes, d => d.nodes.length);

  this._offset = arg;
  return this;
}

function dummyRad(arg) {
  if (!arg) return this._dummyRad;
  // var min = d3.min(nodes, d => d.nodes.length);

  this._dummyRad = arg;
  return this;
}
const graphLayout = function() {
  return {
    _size: [1, 1],
    _nodes: null,
    _links: null,
    _iterations: [30, 20, 70],
    _offset: 5,
    _dummyRad: 15,

    nodes: nodes,
    offset: offset,
    dummyRad: dummyRad,
    links: links,
    size: size,
    iterations: iterations,
    start: start
  };
};

export default graphLayout;
