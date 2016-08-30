// import d3 from "d3";
import * as d3 from "d3";
import _ from "lodash";

var isCutEdge = (l, nodes, linkedByIndex, maxDepth) => {
  var tgt = nodes[l.target];
  var targetDeg = outLinks(tgt, nodes, linkedByIndex).length;
  return l.level % maxDepth === 0 && targetDeg > 0;
};

var collide = function(nodes) {
  return function(alpha) {
    var quadtree = d3.quadtree()
                     .x(d => d.x)
                     .y(d => d.y)
                     .addAll(nodes);

      for (var i = 0, n = nodes.length; i < n; ++i) {
        var d = nodes[i];
        // TODO: adopt to size of diigo
        d.r = 100;
        var nx1 = d.x - d.r,
          nx2 = d.x + d.r,
          ny1 = d.y - d.r,
          ny2 = d.y + d.r;
        quadtree.visit(function(quad, x1, y1, x2, y2) {
          // important check
          if (quad.data && (quad.data !== d)
            && quad.data.comp !== d.comp && !d.label && !quad.data.label) {
            var x = d.x - quad.data.x,
                y = d.y - quad.data.y,
                l = Math.sqrt(x * x + y * y),
                r = d.r + quad.data.r;

            if (l < r) {
              l = (l - r) / l * (alpha * 0.035);
              d.x -= x *= l;
              d.y -= y *= l;
              quad.data.x += x;
              quad.data.y += y;
            }
          }
          return x1 > nx2 || x2 < nx1 || y1 > ny2 || y2 < ny1;
        });
      }
    };
};

function simple_comp(nodes, links) {
  var groups = [];
  var visited = {};
  var v;

  // this should look like:
  // {
  //   "a2": ["a5"],
  //   "a3": ["a6"],
  //   "a4": ["a5"],
  //   "a5": ["a2", "a4"],
  //   "a6": ["a3"],
  //   "a7": ["a9"],
  //   "a9": ["a7"]
  // }

  var vertices = nodes.map(d => d.index);
  var edgeList = links.map(l => {
    var edge = [l.source.index, l.target.index];
    return edge;
  });
  // console.log("edgeList", edgeList);

  var adjlist = convert_edgelist_to_adjlist(vertices, edgeList);
  // console.log("adjList", adjlist, adjlist.length, "vertices", vertices,
  // vertices.length);

  for (v in adjlist) {
    if (adjlist.hasOwnProperty(v) && !visited[v]) {
      var indices = bfs(v, adjlist, visited);
      groups.push(indices.map(i => nodes[i]));
    }
  }
  return groups.map(g => g.filter(d => d));
}

var bfs = function(v, adjlist, visited) {
  var q = [];
  var current_group = [];
  var i, len, adjV, nextVertex;
  q.push(v);
  visited[v] = true;
  // var max = 10;
  while (q.length > 0) {
    v = q.shift();
    current_group.push(v);
    // Go through adjacency list of vertex v, and push any unvisited
    // vertex onto the queue.
    // This is more efficient than our earlier approach of going
    // through an edge list.
    adjV = adjlist[v];
    for (i = 0, len = adjV.length; i < len; i += 1) {
      nextVertex = adjV[i];
      if (!visited[nextVertex]) {
        q.push(nextVertex);
        visited[nextVertex] = true;
      }
    }
  }
  return current_group;
};

var convert_edgelist_to_adjlist = function(vertices, edgelist) {
  var adjlist = {};
  var i, len, pair, u, v;
  for (i = 0, len = edgelist.length; i < len; i += 1) {
    pair = edgelist[i];
    u = pair[0];
    v = pair[1];
    // if (vertices.indexOf(u) === -1 || vertices.indexOf(v) === -1) continue;
    if (adjlist[u]) {
      // append vertex v to edgelist of vertex u
      adjlist[u].push(v);
    } else {
      // vertex u is not in adjlist, create new adjacency list for it
      adjlist[u] = [v];
    }
    // two way
    if (adjlist[v]) {
      adjlist[v].push(u);
    } else {
      adjlist[v] = [u];
    }
  }
  vertices.forEach(v => {
    if (!adjlist.hasOwnProperty(v)) adjlist[v] = [];
  });
  return adjlist;
};

function deriveSets(nodes) {
  if (!nodes) return this._groups;

  var realNodes = nodes.filter(d => !d.label);

  var spread_data = _.flatten(realNodes.map(n => {
    var clones = n.tags.map(t => {
      var clone = _.cloneDeep(n);
      clone.tag = t;
      return clone;
    });
    return clones;
  }));

  var nested_data = d3.nest()
    .key(d => d.tag)
    .entries(spread_data).filter(d => d.values.length > 0);

  var groups = nested_data.map(g => {
    g.id = g.key;
    return g;
  });

  // labelNodes.forEach(l => {
  //   groups.forEach(g => {
  //     if (l.interSet.indexOf(g.key) !== -1) {
  //       // l.text = g.id;
  //       // TODO: dirty hack, fix this
  //       // l.id = g.id + " label";
  //       // console.log("label with group!");
  //       g.values.push(l);
  //     }
  //     // else console.log("label without group!");
  //   });
  // });

  // groups.forEach(d => {
  //   d.values = d.values.map(d => d.data);
  // });

  return groups;
}


function runForce() {

  var center = this._size.map(d => d * 2/3);
  var nodes = this._nodes;
  var links = this._links;

  var linkedByIndex = {};
  links.forEach(function(l) {
    linkedByIndex[l.source + "," + l.target] = l;
  });


  nodes.forEach(n => {
    n.outLinks = outLinks(n, nodes, linkedByIndex);
    n.inLinks = inLinks(n, nodes, linkedByIndex);
  });

  links.forEach(l => {
    l.cut = isCutEdge(l, nodes, linkedByIndex, this._maxDepth);
  });

  // console.log("NODES", nodes);

  var cc = nodes.length;
  var cutLinks = links.filter(l => l.cut);
  var newLinks = [];
  cutLinks.forEach(function(link) {
    if (link.cut) {
      var s = link.source = nodes[link.source],
          t = link.target = nodes[link.target],
          sTags = s.sets.reduce((acc, d) => acc.concat(d.intersetArray)),
          tTags = t.sets.reduce((acc, d) => acc.concat(d.intersetArray)),
          is = _.intersection(sTags, tTags),
          dummy = {
            "__key__": s.__key__ + t.__key__ + "dummy",
            dummy: true,
            interset: is,
            src: s,
            tgt: t,
            r: 30
          }; // intermediate
      nodes.push(dummy);
      newLinks.push({source: link.source, target: cc, cut: link.cut,
        outLinks: s.outLinks},
        {source: cc, target: link.target, cut: link.cut, outLinks: t.outLinks});
      cc += 1;
    }
  });

  console.log("ISSS");
  newLinks = newLinks.concat(links.filter(l => !l.cut));


  var simulation = d3.forceSimulation(nodes)
    // .force("charge", d3.forceManyBody())
    .force("link", d3.forceLink()
             .distance(l => l.cut ? 0 : 9)
             .strength(l => {
               // var maxLen = Math.min(l.source.outLinks.length,
               //   l.target.outLinks.length);
               // console.log("1/maxLen", 1/maxLen);
               return l.cut ? 1 : 1;
               // return 1;
             }))
    // .force("position", d3_force.forcePosition());
    .force("collide", d3.forceCollide((d) => d.dummy ? 25 : 7))
    .force("intraCollide", collide(nodes))
    .force("center", d3.forceCenter(...center));
    // .alphaMin(0.4);

  simulation.force("link").links(newLinks);
  simulation.stop();

  // TODO: dirty hack
  this._nodes = nodes;
  this._links = newLinks;
  this._cutEdges = newLinks.filter(l => l.cut);

  var reducedEdges = newLinks.filter(l => !l.cut);
  var comps = simple_comp(nodes, reducedEdges).map((g, i) => {
    var id = i + "comp";
    var compNodes = _.flatten(g.map(d => d.nodes)).filter(d => d);
    compNodes.forEach(cn => {
      nodes.forEach(n => {
        if (cn.__setKey__ === n.__key__) {
          n.nodes.forEach(n => n.comp = id);
          n.comp = id;
        }
      });
    });

    var tags = d3.nest()
      .key(d => d)
      // TODO: check it later
      .entries(_.flatten(compNodes.filter(d => d).map(d => d.tags)))
    .sort((a, b) => d3.descending(a.values.length, b.values.length));

    var interTags = _.intersection(compNodes.filter(d => d)
      .map(d => d.tags));

    return {
      id: id,
      values: g,
      tags: tags,
      // TODO: check later
      nodes: compNodes,
      interTags: interTags,
      sets: deriveSets(compNodes)
      // nodes: g
    };
  });

  // for (var i = 0, n = 50; i < n; ++i) {
  for (var i = 0, n = Math.ceil(Math.log(simulation.alphaMin()) /
    -simulation.alphaDecay()); i < n; ++i) {
    simulation.tick();
  }


  this._comps = comps;

  console.log("foci comps", comps);

  nodes.forEach(function(d) {
    d.center = {
      x: d.x,
      y: d.y
      // r: d.r
    };

    if (d.nodes)
    d.nodes.forEach((e)=> {
      e.center = Object.assign({}, d.center);
      });
  });
  return nodes;
}


function start() {
  runForce.bind(this)(this._nodes, this._links);

  return this;
}

function links(arg) {
  if (!arg) return this._links;

  // this._bicomps = bicomps.map(g => g.map(i => setData[i]));
  this._cutEdges = arg.filter(l => {
    return l.level % this._maxDepth === 0;
  });

  this._links = arg;
  return this;
}

function nodes(arg) {
  if (!arg) return this._nodes;

  this._nodes = arg;

  return this;
}

function size(wh) {
  if (!wh) return this._size;
  this._size = wh;
  return this;
}

function outLinks(a, nodes, linkedByIndex) {
  var links = [];
  // if (!a.index) console.log("aindex", a);
  for (var property in linkedByIndex) {
    var s = property.split(",");
    if ((s[0] == a.index) && linkedByIndex[property])
      links.push(linkedByIndex[property]);
  }
  return links;
}

function inLinks(a, nodes, linkedByIndex) {
  var links = [];
  for (var property in linkedByIndex) {
    var s = property.split(",");
    if ((s[1] == a.index) && linkedByIndex[property])
      links.push(linkedByIndex[property]);
  }
  return links;
}

const d3Foci = function() {
  return {
    _sets: null,
    _maxDepth: 3,
    _size: [1, 1],
    _fociLinks: null,
    _cutEdges: [],

    size: size,
    nodes: nodes,
    links: links,
    start: start,
    groups: deriveSets,
    comps: function() {return this._comps;},
    cutEdges: function() {return this._cutEdges;},
    reducedEdges: function() {return this._reducedEdges;}
  };
};

export default function() {
  return new d3Foci;
}
