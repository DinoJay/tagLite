import * as d3 from "d3";
import treeLayout from "../lib/oldTree/tree.js";
import _ from "lodash";

// var line = d3.line()
//   .interpolate("basis")
//   .x(d => d.y)
//   .y(d => d.x);

console.log("d3", d3);

var duration = 200;

var stepLine = d3.line().curve(d3.curveStepBefore) .x(d => d.x)
        .y(d => d.y);

var margin = {top: 0, right: 0, bottom: 0, left: 30},
    width = 400 - margin.left - margin.right;
// function neighbors(a, linkedByIndex, nodes) {
//   var nb;
//   var nbs = [];
//
//   // console.log("a", a); for (var property in linkedByIndex) { var s = property.split(",").map(d => parseInt(d));
//     if (s[0] === a.index) {
//       nb = nodes[s[1]];
//       // console.log("nb", nb);
//       nbs.push(nb);
//     }
//   }
//   return nbs;
// }
console.log("d3.curveCatmullRom", d3.curveCatmullRom);
// function hierarchy(cur, nodes, linkedByIndex) {
//   cur._children = neighbors(cur, linkedByIndex, nodes);
//   cur.value = cur._children.length;
//   cur.children = [];
//   console.log("cur", cur, "children", cur._children);
//   // console.log("cur", cur);
//   // console.log("cur children", cur.children);
//
//   cur._children.forEach(next => {
//     // if(seen.indexOf(next) === -1)
//     hierarchy(next, nodes, linkedByIndex);
//   });
// }


function nbs_map(d, nodeMap) {
  return d.relatedTags.reduce((acc, t) => {
    var nb = nodeMap.get(t);
    var pathTest =  _.intersection(nb.path, nb.relatedTags).length === nb.path.length;
    if (pathTest) acc.push(nb);
    return acc;
  }, []);
  // var nbs = nodes.filter(n => n.relatedTags.some(t => nodes.some(n0 => n0.relatedTags.indexOf(t) !== -1)));
  // console.log("nbs", nbs);
  // return nbs;
}

function traverse(cur, key, nodes) {
  if (cur.children) {
    if (key !== cur.key)
      cur.children = cur.children.filter(c => nodes.indexOf(c.key) === -1);
    return cur.children.map(next => {
      traverse(next, key, nodes);
    });
  }
}

function filterOut(cur, tagKey) {
  if (cur.children) {
    cur.children.forEach(next => {
      filterOut(next, tagKey);
    });
  }
}

function getCur_helper(cur, res) {
  if (cur.children) {
    cur.children.forEach(next => {
      getCur_helper(next, res);
    });
  } else {
    res = cur;
  }
}

var findByDepth = function(start, depth) {
  var q = [],
    cur;

  q.push(start);
  while (q.length > 0) {
    cur = q.pop();
    if (cur.depth === depth) return cur;
    if (cur.children) q.push(...cur.children);
  }
};

// function findByDepth(cur, depth) {
//   if (cur.depth === depth){
//     return cur;
//   }
//   else {
//     if (cur.children) {
//       return cur.children.filter(next => {
//         return findByDepth(next, depth);
//       });
//     }
//     return null;
//   }
// }

function yield0(cur, nodes) {
  if (cur.children) {
    nodes.push(...cur.children);
    cur.children.forEach(next => {
      yield0(next, nodes);
    });
    return nodes;
  }
}

function reinsert(cur, key, children, nodeMap) {
  if (cur.depth === 0)  {
    console.log("shortcut");
    cur.children.push(...children);
    return;
  }
  var nbs = nbs_map(cur, nodeMap);
  var selected = nbs.filter(c => children.map(c => c.key).indexOf(c.key) !== -1);
  var selected_keys = selected.map(s => s.key);
  var newChildren = children.filter(c => selected_keys.indexOf(c.key) === -1);

  cur.children.push(...selected);

  if (cur.parent) {
    reinsert(cur.parent, key, newChildren, nodeMap);
  }
}


function tagListCreate(nodes, cont, sim, coreUpdate) {
  cont.selectAll("*").remove();
  var allTags = nodes.map(n => n.key);

  nodes.forEach(n => {
    n.relatedTags = _.uniq(_.flatten(n.values.map(d => d.tags)))
      .filter(t => t !== n.key);
    n._children = [];
    n.path = [];
  });

  // var allValues = _.flatten((nodes.map(n => n.values)));

  var root = {
    index:       nodes.length,
    level:       0,
    "__key__":   "root",
    key:         "root",
    sets:        [],
    children:    nodes,
    relatedTags: allTags,
    path:        [],
    // values:      allValues,
    height:      23,
    x:          0
  };

  root.yScale = d3.scaleLinear()
    .domain([1, d3.max(root.children, d => d.values.length)])
    .range([10, root.height]);

  nodes.push(root);

  // nodes.forEach(d => {
  //   d.xScale = d3.scale.linear()
  //     .domain([0, d.values.length])
  //     .range([0, maxBarWidth]);
  // });

  var nodeMap = d3.map(nodes, d => d.key);

  root.children = nbs_map(root, nodeMap);

      // maxBarWidth = width * 0.8;

  d3.select(".tag-list")
    .insert("div", ":first-child")
    .attr("class", "view-name")
    .style("position", "relative")
    // .style("right", "0px")
    .append("h3")
    .text("SearchTree");

  d3.select(".tag-list")
      .append("div")
      .append("input")
      .attr("id", "search-tree")
      .style("position", "relative");


  // TODO: make dynamic
  // var cont = d3.select("body")
  //   .append("div")
  //   .style("height", "600px")
  //   .attr("class", "tag-list");

  var svg = cont.append("svg");

  svg
      .attr("width", width + margin.left + margin.right)
      .attr("id", "dynTreeCont")
      .style("margin-top", - root.height - 10 +"px")
    .append("g")
      .attr("overflow", "scroll")
      .attr("transform", "translate(" + margin.left + "," + margin.top + ")")
      .attr("id", "dynTree");

    root.x0 = 0; root.y0 = 0;
    this._nodeMap = nodeMap;
    this._nbs_map = nbs_map;

    // this._root = root;
    this.curTag = root.key;
    this._tmpSource = root;
    this._traverse = traverse;
    // root._children = root.children;
    // root.children = root._children;
    this._root = root;
    this._path = [];
    tagListUpdate.bind(this)(root, sim, coreUpdate);
}


function tagListUpdate(source, sim, coreUpdate, inputVal) {
  this._click = d => {
    var nbs;
    this._curTag = d.key;
    if (d.children) {
      d.path.pop();
      console.log("D:PATH", d.path);
      nbs = nbs_map(d, nodeMap);
      var succs = [];
      var clonedChilds = _.cloneDeep(d.children);
      d.children = [];
      reinsert(d.parent, d.key, clonedChilds.concat(yield0(d, succs)),
        nodeMap);

      console.log("d.path", d.path);
      tagListUpdate.bind(this)(source, sim, coreUpdate);
      this._tmpSource =_.cloneDeep(source);

      sim.sets(d.path)
          .timerange(null)
          .start();

      coreUpdate(sim, {search: false, main: true, cloud: true}, {});

    } else {
      d.path = _.uniq(d.path.concat(d.parent.path, [d.key]));
      nbs = nbs_map(d, nodeMap);

      d.children = nbs;
      // var children_ids = nbs.map(d => d.key);
      // d.old_children = d._children;
      traverse(source, d.key, nbs.map(d => d.key));
      tagListUpdate.bind(this)(source, sim, coreUpdate);

      sim.sets(d.path)
          .start();

      coreUpdate(sim, {search: false, main: true, cloud: true}, {});
    }
  };


  var g = d3.select("#dynTree");
  var svg = d3.select("#dynTreeCont");

  console.log("this", this);
  var nodeMap = this._nodeMap;

  console.log("source NODE", source);
  var tree = treeLayout()
      .nodeSize([0, 30]);
  // Compute the flattened node list. TODO use d3.layout.hierarchy.
  var treeNodes = tree.nodes(source);//_.orderBy(tree.nodes(source), d => d.values.length, "desc");
  var rootDatum = treeNodes.find(d => d.depth === 0);
  // console.log("rootDatum", rootDatum);
  var nodes = treeNodes;

  nodes.forEach(n => {
    if (n.children && n.depth !== 0) {
      n.yScale = d3.scaleLinear()
        .domain([1, d3.max(n.children, d => d.values.length)])
        .range([10, n.parent.yScale(n.values.length)]);
    }
  });

  rootDatum.x = 0;
  rootDatum.height = 20;
  rootDatum.width = 50;


    // nodes.length * barHeight + margin.top + margin.bottom);

  // tagListUpdate the nodes…

  // rootEnter
  //   .on("focusin", function(d) {
  //     console.log("focusin");
  //     var input = d3.select(this).node().value;
  //     if (input === "") {
  //       d.oldSrc = _.cloneDeep(source);
  //       console.log("empty", "oldSrc", d.oldSrc);
  //       // tagListUpdate(d.oldSrc);
  //     }
  //   })
  //   .on("focusout", function(d) {
  //     var input = d3.select(this).node().value;
  //     if (input === "")
  //       tagListUpdate(d.oldSrc);
  //
  //     var maxDepth = d3.max(treeNodes.filter(n => n.children),
  //       d => d.depth);
  //     console.log("maxDepth", maxDepth);
  //     var newSrc = findByDepth(source, maxDepth);
  //     console.log("newSrc", newSrc);
  //     newSrc.children = newSrc.children
  //       .filter(d => d.key.includes(input));
  //
  //     newSrc.yScale = d3.scaleLinear()
  //       .domain([1, d3.max(source.children, d => d.values.length)])
  //       .range([10, source.height]);
  //
  //     tagListUpdate(source);
  //   });

  // rootEnter
  //   .append("foreignObject", ":first-child")
  //     .append("xhtml:input")
  //     .attr("type", "text")
  //     .on("focusin", function(d) {
  //       console.log("focusin");
  //       var input = d3.select(this).node().value;
  //       if (input === "") {
  //         d.oldSrc = _.cloneDeep(source);
  //         console.log("empty", "oldSrc", d.oldSrc);
  //         // tagListUpdate(d.oldSrc);
  //       }
  //     })
  //     .on("focusout", function(d) {
  //
  //       var input = d3.select(this).node().value;
  //       if (input === "")
  //         tagListUpdate(d.oldSrc);
  //
  //       var maxDepth = d3.max(treeNodes.filter(n => n.children), d => d.depth);
  //       console.log("maxDepth", maxDepth);
  //       var newSrc = findByDepth(source, maxDepth);
  //       console.log("newSrc", newSrc);
  //       newSrc.children = newSrc.children
  //         .filter(d => d.key.includes(input));
  //
  //       newSrc.yScale = d3.scaleLinear()
  //         .domain([1, d3.max(source.children, d => d.values.length)])
  //         .range([10, source.height]);
  //
  //       tagListUpdate(source);
  //     });

  // rootEnter
  //     // .attr("y", d => -d.height / 2)
  //     .style("height", d => d.height + "px")
  //     .style("width", 100 + "px")
  //     .style("transform", "translate(" + margin.left + "px," + margin.top + "px)");
      // .attr("width", maxBarWidth)
      // .style("background", "orange")
      // .style("opacity", 1e-6)


  var node = g.selectAll("g.node")
      .data(nodes, d => d.key);

  var nodeEnter = node.enter().append("g")
      .attr("class", "node")
      // .attr("transform", () => "translate(" + [root.y0, root.x0] + ")")
      .style("opacity", 1e-6);

  // Enter any new nodes at the parent's previous position.
  nodeEnter.append("rect")
    .style("fill", color)
    .on("click", this._click)
    .on("mouseover", d => {

      // var tp = d3.selectAll(".tps").filter(e => {
      //   // console.log("ET", d.key, e, e.tags.find(a => a.key === d.key));
      //   // return e.tags.indexOf(d.key) !== -1;
      //   return e.tags.find(a => a.key === d.key) ? true : false;
      // });
      //
      // var toRem = tp.selectAll("tspan").filter(e => {
      //   // console.log("tspan data", e, e.key !== d.key);
      //   return e.key !== d.key;
      // });
      //
      // toRem.remove();
      //
      // console.log("toRem", toRem);
      // // tp.data([d.key]);
      // // var others = d3.selectAll(".tagLabel").filter(e => e.key !== d.key);
      // // others.style("opacity", 0.3);
      // // d.prevSize = parseInt(tp.attr("font-size"));
      //
      // console.log("tp", tp);
    })
    .on("mouseout", d => {
      // console.log("d", d);
      // d3.selectAll(".tagLabel").filter(e => e.key === d.key)
      //   .attr("font-size", d.prevSize);
      //
      // d3.selectAll(".tagLabel").filter(e => e.key !== d.key)
      //   .style("opacity", 1);

    });

  nodeEnter.append("text");

  var nodeMerge = nodeEnter.merge(node);

  nodeMerge.select("text")
    .style("font-size", d => d.parent ? d.parent.yScale(d.values.length) : 23)
    .text(d => d.key)
    .each(function(d) {d.bbox = d3.select(this).node().getBBox();});

  var padding = 7;
  var height = nodes.reduce((h, n) => {
    n.x = h;
    n.height = n.bbox.height; //yScale(n.values.length);
    n.width = n.bbox.width + 5;
    h += n.height + padding;
    return h;
  }, rootDatum.height);

  svg.attr("height", height);

  nodeMerge.select("text").transition()
    .duration(duration)
    .attr("dy", d => d.height / 2)
    .attr("dx", d => d.width / 2)
    .style("text-anchor", "middle")
    .style("alignment-baseline", "central");

  // Transition nodes to their new position.
  nodeEnter.transition()
    .duration(duration)
    .attr("transform", d => "translate(" + [d.y, d.x] + ")")
    .style("opacity", 1);

  nodeMerge.transition()
    .duration(duration)
    .attr("transform", d => "translate(" + [d.y, d.x] + ")")
    .style("opacity", 1)
  .select("rect")
    .style("fill", color)
    .attr("height", d => d.height)
    .attr("width", d => d.width);
    // .on("click", click);

  // Transition exiting nodes to the parent's new position.
  node.exit().transition()
    .duration(duration)
    .attr("transform", () => "translate(" + [source.y, source.x] + ")")
    .style("opacity", 1e-6)
    .remove();

  // tagListUpdate the links…
  var link = g.selectAll("path.link")
      .data(tree.links(treeNodes), d => d.target.key);

  // Enter any new links at the parent's previous position.
  var linkEnter = link.enter().insert("path", "g")
      .attr("class", "link");

  var linkMerge = linkEnter.merge(link);
      // .attr("d", (d) => {
      //   return stepLine([{
      //     x: d.source.y,
      //     y: d.source.x + d.source.height / 2
      //   }, {
      //     x: d.target.y + d.target.height / 2,
      //     y: d.target.x
      //   }]);
      // })
    // .transition()
      // .duration(duration)
      // .attr("d", d => {
      //   return stepLine([{
      //     x: d.source.y,
      //     y: d.source.x + d.source.height / 2
      //   }, {
      //     x: d.target.y,
      //     y: d.target.x + d.target.height / 2
      //   }]);
      // });

  // Transition links to their new position.
  linkMerge
    // .transition()
    // .duration(duration)
     .attr("d", d => {
        return stepLine([{
          x: d.source.y,
          y: d.source.x + d.source.height / 2
        }, {
          x: d.target.y,
          y: d.target.x + d.target.height / 2
        }]);
      });

  // Transition exiting nodes to the parent's new position.
  link.exit().transition()
    .duration(duration)
    .attr("d", (d) => {
      return stepLine([{
        y: d.source.x + d.source.height / 2,
        x: d.source.y
      }, {
        y: d.target.x,
        x: d.target.y + d.target.height / 2
      }]);
    })
    .remove();

  // Stash the old positions for transition.
  nodes.forEach(function(d) {
    d.x0 = d.x;
    d.y0 = d.y;
  });

  // if (d3.select("#search-tree").empty()) {
  d3.select("#search-tree")
    .style("transform", "translate("+rootDatum.x +"px,"+ rootDatum.bbox.height/2 +"px)")
    .style("font-size", "large")
    .style("height", rootDatum.bbox.height + "px")
    .style("top", rootDatum.y + "px");
  // }

  var root = d3.select("#search-tree")
    .attr("value", inputVal ? inputVal : null)
    .on("focusout", () => {
      var input = d3.select(".tag-list input").node().value;
      if (input !== "") {
        console.log("source", source, "value", inputVal);
        this._tmpSource = _.cloneDeep(source);

        source.children = source.children.filter(d => d.key.includes(input));
        tagListUpdate.bind(this)(source, sim, coreUpdate, input);
        var sets = source.children.map(d => d.key);
      //   console.log("sets", sets);
        sim.sets(sets, true)
            .start();
      coreUpdate(sim, {search: false, main: true, cloud: true}, {});

      }
      else {
        tagListUpdate.bind(this)(this._tmpSource, sim, coreUpdate, input);
        sim.sets(this._tmpSource.children.map(d => d.key), true)
            .start();
        coreUpdate(sim, {search: false, main: true, cloud: true}, {});
      }
    });



  // var rootEnter = root.enter()
  //   .append("div")
  //     .attr("class", "root");


}

  // function focusout() {
  //           var input = d3.select(this).node().value;
  //           root.children = root.children.filter(d => d.key.includes(input));
  //           tagListUpdate(root);
  // }

  function color(d) {
    return d.children ? "orange" : "white";
    // return "orange";
  }

const tagList = function() {
  return {
    create: tagListCreate,
    update: tagListUpdate,
    _nodeMap: null,
    _root: null
  };
};

export default function() {
  return new tagList;
}


