import _ from "lodash";
import * as d3 from "d3";

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
    .entries(spread_data).filter(d => d.values.length > 1);

  var groups = nested_data.map(g => {
    g.id = g.key;
    return g;
  });

  return groups;
}


function simple_comp(nodes, links) {
  var groups = [];
  var visited = {};
  var v;

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
var isCutEdge = (l, nodes, linkedByIndex, maxDepth) => {
  var tgt = nodes[l.target];
  var targetDeg = outLinks(tgt, nodes, linkedByIndex).length;
  return l.level % maxDepth === 0 && targetDeg > 0;
};

const computeComponents = function(ns, es, limit) {
  var nodes = _.cloneDeep(ns),
      edges = _.cloneDeep(es);

  var linkedByIndex = {};
  edges.forEach(function(d) {
    linkedByIndex[d.source + "," + d.target] = d;
  });


  edges.forEach(l => {
    l.cut = isCutEdge(l, nodes, linkedByIndex, limit);
  });

  var links = edges.map(e => {
    e.source = nodes[e.source];
    e.target = nodes[e.target];
    return e;
  });

  var reducedEdges = links.filter(l => !l.cut);
  var cutEdges = links.filter(l => l.cut);
  console.log("cutEdges", cutEdges);

  var comps = simple_comp(nodes, reducedEdges).map((g, i) => {
    var id = i + "comp";
    var compNodes = _.flatten(g.map(d => d.nodes)).filter(d => d);

    var tags = d3.nest()
      .key(d => d)
      .entries(_.flatten(compNodes.filter(d => d).map(d => d.tags)))
      .sort((a, b) => d3.descending(a.values.length, b.values.length));

    // tags intersection of all comp nodes
    var interTags = _.intersection(compNodes.filter(d => d)
      .map(d => d.tags));

    var sets = deriveSets(compNodes);

    sets.forEach(s => {
      s.values = s.values.map(n => {
        var f = compNodes.find(m => m.id === n.id);
        return f;
      });
    });
    return {
      id: id,
      values: g,
      tags: tags,
      nodes: compNodes,
      width: compNodes.length * 2,
      height: compNodes.length * 2,
      interTags: interTags,
      sets: sets
      // nodes: g
      };
  });

  var cutIndex = {};
  cutEdges.forEach(function(d) {
    var src = d.source.index ? d.source.index : d.source;
    var tgt = d.target.index ? d.target.index : d.target;
    cutIndex[src + "," + tgt] = true;
  });
  console.log("comps", comps, cutIndex);
  var compLinks = [];
  comps.forEach(src => {
    comps.forEach(tgt => {
      src.values.forEach(sn => {
        tgt.values.forEach(tn => {
          var str = sn.index + "," + tn.index;
          // console.log("sn", sn, tn);
          if (cutIndex[str]) {
            compLinks.push({
              source: comps.findIndex(c => c.id === src.id),
              target: comps.findIndex(c => c.id === tgt.id)});
          }
        });
      });
    });
  });
  return {nodes: comps, edges: compLinks};

};
export default computeComponents;
