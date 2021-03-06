import _ from "lodash";
import * as d3 from "d3";
import {parseTime} from "./utils.js";

// function isCutEdge(l, nodes, linkedByIndex, maxDepth) {
//   var tgt = nodes[l.target];
//   var targetDeg = outLinks(tgt, nodes, linkedByIndex).length;
//   return l.level % maxDepth === 0 && targetDeg > 0;
// }
//

function nbsByTag(a, linkedByIndex, nodes, seen) {

  var nbs = [];
  for (var property in linkedByIndex) {
    var s = property.split(",").map(d => parseInt(d));
    var source = nodes[s[0]];
    var target = nodes[s[1]];
    var diff, interset;

    if (s[0] === a) {
      diff = _.difference(source.sets, seen);
      interset = _.intersection(diff, target.sets);
      if (interset.length > 0)
        nbs.push(s[1]);
    }
  }
  return _.uniq(nbs);
}

function connectionsIndex(a, linkedByIndex, nodes) {
  var connections = 0;
  var nb;
  for (var property in linkedByIndex) {
    var s = property.split(",").map(d => parseInt(d));
    if (s[0] === a && nodes[s[1]]) {
      nb = nodes[s[1]];
      // console.log("nb", nb);
      connections += nb.nodes.length;
    } else {
      if (s[1] === a && nodes[s[0]]) {
        nb = nodes[s[0]];
        // console.log("nb", nb);
        connections += nb.nodes.length;
      }

    }

  }
  return connections;
}

function extractSets(data) {

  var copyData = data.map(d => d);
  // console.log("copyData", copyData);
  // var oldSets = null; //this._sets, //foci.sets() ,

  var sets = d3.map({}, function(d) {
    return d.__key__;
  });

  var individualSets = d3.map(),
    set,
    key,
    i,
    n = copyData.length;

  // TODO: rename __key__
  for (i = -1; ++i < n;) {
    // TODO: change it later, too specific
    set = copyData[i].tags;
    // if (!set) continue;
    key = set.sort().join(",");
    if (set.length) {
      set.forEach(function(val) {
        if (individualSets.get(val)) {
          individualSets.get(val).size += 1;
        } else {
          individualSets.set(val, {
            __key__: val,
            size: 1,
            sets: [val],
            nodes: []
          });
        }
      });
      copyData[i].__setKey__ = key;
      if (sets.get(key)) {
        var e = sets.get(key);
        e.size++;
        e.nodes.push(copyData[i]);
      } else {
        sets.set(key, {
          __key__: key,
          sets: set,
          size: 1,
          nodes: [copyData[i]]
        });
      }
    }
  }

  individualSets.each(function(v, k) {
    if (!sets.get(k)) {
      sets.set(k, v);
    }
  });

  return sets;
}

function initSets(data) {
  data.forEach(d => d.date = parseTime(d.created_at));
  var setData = extractSets(data);
  console.log("setData", setData);
  var graph = prepareGraph(setData.values());

  // this._bicomps = bicomps.map(g => g.map(i => setData[i]));
  // this._cutEdges = graph.edges.filter(l => {
  //   console.log("lINk", l);
  //   console.log("nodeCount", l.nodeCount);
  //   return l.level % this._maxDepth === 0;
  // });
  return graph;
}



function prepareGraph(setData) {
  // if (!data) return this._sets;

  // TODO: filter out before
  var nodes = setData.filter(v => v.nodes.length > 0);

  nodes.forEach((d, i) => {
    d.level = 0;
    d.index = i;
  });

  var fociLinks = [];
  nodes.forEach(s => {
    nodes.forEach(t => {
      var interSet = _.intersection(s.sets, t.sets);
      // var linkExist = fociLinks.findIndex(l => (
      //   l.source === s.index && l.target === t.index || l.target === s.index && l.source === t.index)) === -1 ? false : true;

      if (s.index !== t.index && interSet.length > 0)
        fociLinks.push({
          source: s.index,
          target: t.index,
          interSet: interSet,
          strength: t.sets.length / s.sets.length
        });
    });
  });

  // console.log("foci nodes", nodes);
  // console.log("fociLinks", fociLinks);
  // console.log("fociLinks length", fociLinks.length);

  var linkedByIndex = {};
  fociLinks.forEach(function(d) {
    var src = d.source.index ? d.source.index : d.source;
    var tgt = d.target.index ? d.target.index : d.target;
    linkedByIndex[src + "," + tgt] = true;
  });

  // console.log("linkedByIndex", linkedByIndex);

  // TODO
  // this._linkedByIndex = linkedByIndex;

  // TODO: do more testing
  return forest(nodes, linkedByIndex);
  // return {nodes: nodes, edges: fociLinks};


  function forest(nodes, linkedByIndex) {
      function graphToDAG(startIndex) {
        var G = {
          nodes: [],
          vertices: [],
          edges: []
        };
        var q = [];
        var visitedTags = [];
        var level = 1;
        var nodeCount = 0;

        q.push(startIndex);
        G.vertices.push(startIndex);

        var startNode = nodes[startIndex];

        startNode.level = level;
        // level += 1;
        // console.log("startLevel", startNode.level);

        G.nodes.push(startNode);

        // console.log("startIndex", startIndex);

        while (q.length !== 0) {

          // console.log("q", q);
          var u = q.pop(); // pop front

          // console.log("u index", u);
          // console.log("u", nodes[u]);
          // console.log("seen", tags);
          // console.log("sets", nodes[u].sets);
          // console.log("diff", _.difference(nodes[u].sets, tags));
          var vs = nbsByTag(u, linkedByIndex, nodes, visitedTags);

          var sorted = _.sortBy(vs.map(i => nodes[i]), d => {
            // return d.sets.length;
            // return d.nodes.length;
            var conn = connectionsIndex(d.index, linkedByIndex,
              sv.map(i => nodes[i]));
            return 100 * conn * d.nodes.length / d.sets.length;
          }).map(d => d.index).reverse();

          // console.log("vs", sorted.map(u => nodes[u].__key__));

          // console.log("sorted", sorted.map(i => nodes[i]));

          sorted.forEach(v => {
            if (G.vertices.indexOf(v) !== -1) {
              var filterOut = G.edges.filter(l => {
                // var tgtNode = nodes[l.target];
                // console.log("tgtNodes", tgtNodes);
                return l.target === v; //&& tgtNode.nodes.length > 1;
              });
              // TODO:
              // console.log("filterOut", filterOut);
              G.edges = _.difference(G.edges, filterOut);
              G.edges.push({
                source: u,
                target: v,
                nodeCount: nodeCount,
                interSet: _.intersection(nodes[u].sets, nodes[v].sets),
                level: level,
                strength: nodes[v].sets.length / nodes[u].sets.length
              });
            } else {
              G.vertices.push(v);
              var node = nodes[v];
              node.level = level;
              nodeCount += node.nodes.length;
              node.count = nodeCount;
              G.nodes.push(node);

              G.edges.push({
                source: u,
                target: v,
                interSet: _.intersection(nodes[u].sets, nodes[v].sets),
                level: level,
                nodeCount: nodeCount,
                strength: nodes[v].sets.length / nodes[u].sets.length
              });
              q.push(v);

              q = _.uniq(q);
              q = _.sortBy(q.map(i => nodes[i]), d => {
                return d.sets.length;
              }).map(d => d.index).reverse();
            }
          });
          level += 1;
          visitedTags.push(...nodes[u].sets);
        }
        return G;
      }

      var sortedNodes = _.sortBy(nodes, d => {
        // console.log("d.index", d.index);
        // var conn = connectionsIndex(d.index, linkedByIndex, nodes);
        // return conn * d.nodes.length;

        return d.sets.length;
      }).reverse();

      var sv = sortedNodes.map(n => n.index);
      // console.log("sortedNodes", sortedNodes);

      var edges = [];
      var newNodes = [];
      while (sv.length > 0) {
        var G = graphToDAG(sv.pop(), nodes);
        // console.log("G.nodes", G.vertices);
        // console.log("sv", sv);
        sv = _.difference(sv, G.vertices);
        // console.log("diff", sv);
        edges = edges.concat(G.edges);
        newNodes = newNodes.concat(G.nodes);
      }

      newNodes = _.sortBy(newNodes, d => d.index);
      console.log("G nodes", newNodes);

      var spreadNodes = _.flattenDeep(newNodes.map(d => d.nodes.map(n => {
        return n.tags.map(t => {
          var copy = _.clone(n);
          copy.key = t;
          return copy;
        });
      })));

      var allTags = d3.nest()
        .key(d => d.key)
        .entries(spreadNodes)
        .sort((a, b) => d3.descending(a.values.length, b.values.length));
      return {
        nodes: newNodes,
        edges: edges,
        linkedByIndex: linkedByIndex,
        tags: allTags
      };
    }
}
export default initSets;
