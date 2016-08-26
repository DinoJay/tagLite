"use strict";
require("./style/style.less");

import * as d3 from "d3";
import _ from "lodash";

import colaLayout from "./lib/colaFoci.js";
import computeTagGraph from "./lib/tagGraph.js";
import computeCompGraph from "./lib/componentGraph.js";

import tagListLayout from "./components/tagList.js";
var tagList = tagListLayout();
import offsetInterpolate from "./lib/polyOffset.js";
import timeCloudLayout from "./components/tagStream.js";
var timeCloud = timeCloudLayout();
import marching_squares from "./lib/marchingSquaresHelpers.js";

import {innerCircleCollide} from "./lib/utils.js";
import brewer from "colorbrewer";

const wordScale = d3.scaleLinear();
const circleSize = d3.scaleLinear();
const LABEL_OFFSET = 40;
const DUMMYNODE_SIZE = 5;

var WIDTH = window.innerWidth * 2/3;
var HEIGHT = 800; //window.innerHeight;

const DOC_WIDTH = 4;
const DOC_HEIGHT = 6;

const CORE_Class = ".core.view";

function pythag(r, b, coord, radius, w) {
 var hyp2 = Math.pow(radius, 2),
  strokeWidth = 2;
 // r += 1;

 // force use of b coord that exists in circle to avoid sqrt(x<0)
 b = Math.min(w - r - strokeWidth, Math.max(r + strokeWidth, b));

 var b2 = Math.pow((b - radius), 2),
  a = Math.sqrt(hyp2 - b2);

 // radius - sqrt(hyp^2 - b^2) < coord < sqrt(hyp^2 - b^2) + radius
 coord = Math.max(radius - a + r + strokeWidth,
  Math.min(a + radius - r - strokeWidth, coord));

 return coord;
}

function linkPath(d) {
  // Total difference in x and y from source to target
  var diffX = d.target.x - d.source.x;
  var diffY = d.target.y - d.source.y;

  // Length of path from center of source node to center of target node
  var pathLength = Math.sqrt((diffX * diffX) + (diffY * diffY));


  var offsetXS = (diffX * d.source.r) / pathLength;
  var offsetYS = (diffY * d.source.r) / pathLength;
  // x and y distances from center to outside edge of target node
  var offsetXT = (diffX * d.target.r) / pathLength;
  var offsetYT = (diffY * d.target.r) / pathLength;

  return "M" + (d.source.x + offsetXS) + "," + (d.source.y + offsetYS)
  + "L" + (d.target.x - offsetXT) + "," + (d.target.y - offsetYT);
}


function labelArc(radius) {
  return d3.arc()
  .innerRadius(0)
  .outerRadius(radius)
  .startAngle(-Math.PI / 3)
  .endAngle(2 * Math.PI)();

}


function zoomHandler(svg) {
 return d3.zoom()
  .extent(function() {
   var bbox = d3.select("#zoom-hull").node().getBoundingClientRect();
   return [
    [bbox.x, bbox.y],
    [bbox.x + bbox.width, bbox.y + bbox.height]
   ];
  })
  .scaleExtent([-100, 40])
  .on("zoom", function() {
   var translate = [d3.event.transform.x, d3.event.transform.y];
   var scale = d3.event.transform.k;
   svg
    .transition(1000)
    .attr("transform", "translate(" + translate + ")scale(" + scale + ")");
  });
}

function programmaticZoom(zoomHandler, svg) {
 return function(self) {
  var bbox = self.node().getBBox(),
   dx = bbox.width,
   dy = bbox.height,
   x = (bbox.x + bbox.x + bbox.width) / 2,
   y = (bbox.y + bbox.y + bbox.height) / 2,
   scale = Math.max(-20,
    Math.min(2.5, 1 / Math.max(dx / WIDTH, dy / HEIGHT))),
   translate = [WIDTH / 2 - scale * x,
    HEIGHT / 2 - scale * y
   ];

  zoomHandler.transform(svg,
   d3.zoomIdentity
    .translate(translate[0], translate[1])
    .scale(scale));
 };
}

function programmaticZoomCircle(zoomHandler, svg) {
  return function(d) {
   var offset = 50;
   var dx = d.w + offset,
    dy = d.w + offset,
    x = (d.x),
    y = (d.y),
    scale = Math.max(-40, Math.min(8, 1 / Math.max(dx / WIDTH, dy / HEIGHT))),
    translate = [WIDTH / 2 - scale * x,
     HEIGHT / 2 - scale * y
    ];

   zoomHandler.transform(svg,
    d3.zoomIdentity
    .translate(translate[0], translate[1])
    .scale(scale));
  };
 }
 // function zoomTo(v) {
 //     var k = diameter / v[2]; view = v;
 //     node.attr("transform", function(d) {
 //       return (d.x - v[0]) * k + "," + (d.y - v[1]) * k + ")"; });
 //
 //     zoomHandler.transform(svg,
 //       d3.zoomIdentity
 //       .translate(translate[0], translate[1])
 //       .scale(scale));
 //   }

function plotLabels(c, group, i, sets) {
 var tp = d3.selectAll(".textPath").filter(d => d.id === c.id),
  compNode = d3.select(".comp-" + c.id);

 tp.selectAll("tspan").remove();
 tp.selectAll("tspan")
  .data(sets, d => d.key)
  .enter()
  .append("tspan")
  //TODO: upd enter
  .call(styleTspan);

 d3.selectAll(".doc")
  .filter(d => c.nodes.map(e => e.id).includes(d.id))
  .style("opacity", 0.01);

 var ids = group.values.map(d => d.id);
 d3.selectAll(".doc")
  .filter(d => ids.includes(d.id))
  .style("opacity", 1);

 compNode.selectAll("g").select("path")
  .style("opacity", 0.01);
 compNode.selectAll(".bubble" + group.key + i).select("path")
  .style("opacity", 1);
}

function extractTags(docNodes) {
 var spreadNodes = _.flatten(docNodes.map(d => d.tags.map(t => {
  var copy = _.clone(d);
  copy.key = t;
  return copy;
 })));

 var allTags = d3.nest()
  .key(d => d.key)
  .entries(spreadNodes)
  .sort((a, b) => d3.descending(a.values.length, b.values.length));

 return {
  nested: allTags,
  spread: spreadNodes
 };

}

function styleTspan(d) {
 d3.select(this).attr("class", "tagLabel")
  .attr("font-size", function(d) {
   return wordScale(d.values.length);
  })
  .text(d => d.key + " · ")
  .on("mouseover", function(d) {
  })
  .on("mouseout", function(d) {

   // d3.selectAll(".bd")
   //   .style("stroke-opacity", linkOpacity);
  });
  // var parent = this.parentNode;
  // var tpLen = parent.getComputedTextLength();
  // var id = d3.select(parent).data()[0].id;
  // console.log("id", id);
  // var arc = d3.select("#circle" + id);
  // var pathLen = arc.node().getTotalLength();
  // console.log("tpLen", tpLen, pathLen);
  // if (tpLen > pathLen) {
  //   console.log("longer");
  //   d3.select(this).text("");
  // }

}

var o = d3.scaleOrdinal()
 .domain(["foo", "bar", "baz"])
 .range(brewer.Paired[9]);

var hullcurve = d3.line()
 .curve(d3.curveBasisClosed)
 .x(d => d.x)
 .y(d => d.y);

// var bundleLine = d3.line()
//             .x(d => d.x)
//             .y(d => d.y)
//             .curve(d3.curveBundle);


var fill = (i) => d3.schemeCategory10[i];

var groupPath = function(nodes) {
 var fakePoints = [];
 nodes.forEach(function(element) {
  var offset = element.r;
  fakePoints = fakePoints.concat([
   // "0.7071" scale the sine and cosine of 45 degree for corner points.
   [(element.x), (element.y + offset)],
   [(element.x + (0.7071 * offset)), (element.y + (0.7071 * offset))],
   [(element.x + offset), (element.y)],
   [(element.x + (0.7071 * offset)), (element.y - (0.7071 * offset))],
   [(element.x), (element.y - offset)],
   [(element.x - (0.7071 * offset)), (element.y - (0.7071 * offset))],
   [(element.x - offset), (element.y)],
   [(element.x - (0.7071 * offset)), (element.y + (0.7071 * offset))]
  ]);
 });

 var hull = d3.polygonHull(fakePoints);
 if (hull === null) return null;
 return offsetInterpolate(15)(hull.reverse());
};

function subGraphEnter(c) {
  var self = d3.select(this);
  var bubbleCont = self.append("g").attr("class", "bc");
  c.sets.forEach(s => s.isolevel = 0.030);

  var linkEnter = self.selectAll(".subLink")
    .data(c.links)
    .enter()
    .append("line")
    .attr("class", "sub-link");
 // .attr("marker-end", "url(#end)");

    var docEnter = d3.select(this).selectAll(".doc")
    .data(c.nodes)
    .enter()
    .append("g")
    .attr("class", "doc");

    docEnter.append("rect")
    .attr("rx", 0.5)
    .attr("ry", 0.5)
    // .attr("stroke", "black")
    // .attr("stroke-width", 0.3)
    .attr("fill", "none");
   // .attr("opacity",  0)
    docEnter.append("image").attr("xlink:href", "icon-file.png");
    docEnter.append("title").text(d => d.tags.join(","));

    c.nodes.forEach(n => {
      n.x = c.r;
      n.x = c.r;
    });
 var subSim = d3.forceSimulation(c.nodes)
                .force("link", d3.forceLink(c.links)
                  .strength(0.06)
                  .distance(8)
                )
                .force("center", d3.forceCenter(c.r, c.r))
                .force("innerCircle", innerCircleCollide(c.nodes, c.r, 2))
                .force("collide", d3.forceCollide(d => d.width * 2).strength(1))
                .alphaMin(0.3);

  c.subSim = subSim;

  subSim.on("tick", function() {
  // TODO: fix later

  // c.nodes.forEach(d => {
  //     d.x = pythag(2, d.y, d.x, c.r, c.r * 2);
  //     d.y = pythag(2, d.x, d.y, c.r, c.r * 2);
  // });
  docEnter
   .attr("transform", d => {
    return "translate(" + [d.x - d.width / 2, d.y - d.height / 2] + ")";
   });

  linkEnter
   .attr("x1", l => l.source.x)
   .attr("y1", l => l.source.y)
   .attr("x2", l => l.target.x)
   .attr("y2", l => l.target.y);

  bubbleCont.selectAll("*").remove();

  marching_squares(set => {
   // TODO: not running right now
   // this happens in a for loop
   bubbleCont
    .selectAll(".bubble-" + set.key).remove();

   var bubbleGroup = bubbleCont
    .selectAll(".bubble-" + set.key)
    .data([set]);

   var bubbleGroupEnter = bubbleGroup.enter()
    .append("g")
    .attr("class", "bubble-" + set.key);

   var bubble = bubbleGroupEnter.selectAll("path")
    .data(d => d.path);

   var bubbleEnter = bubble.enter()
    .append("path");

   var bubbleMerge = bubbleEnter.merge(bubble);

    bubbleMerge
    .attr("class", (_, i) => "bubble-" + i + set.key + "bubble")
    .attr("stroke-linejoin", "round")
    .attr("opacity", 0.5)
    .attr("d", d => hullcurve(d))
    .attr("fill", o(set.key))
    .style("cursor", "pointer")
    .on("click", () => bubbleGroupEnter.call(programmaticZoom(0.6)));

  bubble.exit().remove();
   bubbleGroup.exit().remove();

  }, c); // bigger: 0.0048, 0.024 (with updated bubble points)
 });

}

function subGraphUpdate(c) {
  var self = d3.select(this);
  var bubbleCont = self.select(".bc");

  var link = self.selectAll(".sub-link");

  var doc = self.selectAll(".doc");
  var t = 500;

  doc.select("rect")
    .transition(t)
    .attr("width", d => d.width)
    .attr("height", d => d.height);

  doc.select("image")
    .transition(t)
    .attr("width", d => d.width + "px")
    .attr("height", d => d.height + "px");


//  if (!c.selected) return;

 var subSim = d3.forceSimulation(c.nodes)
                .force("link", d3.forceLink(c.links)
                  .strength(0.06)
                  .distance(8)
                )
                .force("center", d3.forceCenter(c.r, c.r))
                .force("innerCircle", innerCircleCollide(c.nodes, c.r, 2))
                .force("collide", d3.forceCollide(d => {
                  return d.width === DOC_WIDTH ? d.width * 2 : d.width;
                }).strength(1))
                .alphaMin(0.6);


  c.subSim = subSim;


  subSim.on("tick", function() {
  // TODO: fix later

  doc
   .attr("transform", d => {
    return "translate(" + [d.x - d.width / 2, d.y - d.height / 2] + ")";
   });

  link
   .attr("x1", l => l.source.x)
   .attr("y1", l => l.source.y)
   .attr("x2", l => l.target.x)
   .attr("y2", l => l.target.y);

  bubbleCont.selectAll("*").remove();

  marching_squares(set => {
   // TODO: not running right now
   // this happens in a for loop
   bubbleCont
    .selectAll(".bubble-" + set.key).remove();

   var bubbleGroup = bubbleCont
    .selectAll(".bubble-" + set.key)
    .data([set]);

   var bubbleGroupEnter = bubbleGroup.enter()
    .append("g")
    .attr("class", "bubble-" + set.key);

   var bubble = bubbleGroupEnter.selectAll("path")
    .data(d => d.path);

   var bubbleEnter = bubble.enter()
    .append("path");

   var bubbleMerge = bubbleEnter.merge(bubble);

    bubbleMerge
    .attr("class", (_, i) => "bubble-" + i + set.key + "bubble")
    .attr("stroke-linejoin", "round")
    .attr("opacity", 0.5)
    .attr("d", d => hullcurve(d))
    .attr("fill", o(set.key))
    .style("cursor", "pointer")
    .on("click", () => bubbleGroupEnter.call(programmaticZoom(0.6)));

  bubble.exit().remove();
   bubbleGroup.exit().remove();

  }, c); // bigger: 0.0048, 0.024 (with updated bubble points)
  });
//  subSim.on("end", function() {});
}


function createCoreView(graph) {
 console.log("graph", graph);

 wordScale
  .domain(d3.extent(graph.tags, d => d.values.length))
  .rangeRound([7, 100]);

 var compGraph = computeCompGraph(graph.nodes, graph.edges, 3);
 compGraph.nodes.forEach(c => {
  c.nodes.forEach(d => {
    d.initW = _.clone(DOC_WIDTH);
    d.initH = _.clone(DOC_HEIGHT);
    d.width = _.clone(DOC_WIDTH);
    d.height = _.clone(DOC_HEIGHT);
  });
 });
 // var ext = d3.extent(compGraph.nodes.map(d => d.nodes.length));
 circleSize
  .domain([1, 100])
  .rangeRound([30, 100]);

 compGraph.nodes.forEach(n => {
   n.initR = circleSize(n.nodes.length);
   n.r = _.clone(n.initR);
 });
 console.log("compGraph", compGraph.nodes);

 var cola = (new colaLayout)
  .size([WIDTH, HEIGHT])
  .offset(LABEL_OFFSET)
  .dummyRad(DUMMYNODE_SIZE)
  .offset(50)
  .nodes(compGraph.nodes)
  .links(compGraph.edges)
  //[30, 20, 70]
  .iterations([10, 10, 10])
  .start();

 var svg = d3.select(CORE_Class).select("svg");
 var g = svg
  .attr("width", WIDTH)
  .attr("height", HEIGHT)
  .append("g")
  .attr("overflow", "hidden");



 var cont = d3.select(CORE_Class);


 // cont.append("div")
 //     .attr("class", "tipsy")
 cont.append("div")
  .attr("id", "tooltip")
  .attr("class", "tnt_tooltip");

 g.append("g")
  .attr("class", "backdrop-cont");

 g.append("g")
  .attr("class", "edge-seg");

 g.append("g")
  .attr("class", "hull-labels");

 g.append("g")
  .attr("class", "bubble-cont");

//  var defs = svg.append("defs");
//
//
//  defs.append("marker")
//   .attr("id", "end-arrow")
//   .attr("viewBox", "0 0 10 10")
//   .attr("refX", 4)
//   .attr("refY", 5)
//   .attr("orient", "auto")
//   .append("path")
//   .attr("d", "M0,0 L0,10 L10,5 z");
//
//  defs.selectAll("marker")
//   .data(["end"]) // Different link/path types can be defined here
//   .enter().append("svg:marker") // This section adds in the arrows
//   .attr("id", String)
//   .attr("viewBox", "0 -5 10 10")
//   .attr("refX", 10)
//   .attr("refY", 0)
//   .attr("markerWidth", 15)
//   .attr("markerHeight", 15)
//   .attr("orient", "auto")
//   .append("svg:path")
//   .attr("d", "M0,-5L10,0L0,5")
//   .attr("class", "marker");

 var simulation = d3.forceSimulation(cola.nodes())
  .force("link", d3.forceLink(cola.links())
   .strength(0)
  )
  .force("x", d3.forceX(d => d.pos.x)
   .strength(0.4)
  )
  .force("y", d3.forceY(d => d.pos.y)
   .strength(0.4)
  )
  .force("collide", d3.forceCollide(d => d.r + 10).strength(1))
  .alphaMin(0.6);

 updateCoreView(simulation);
 tagList.create(graph.tags, d3.select(".tag-list"), simulation, updateCoreView);
}



function updateCoreView(simulation) {
 simulation.restart();
 var cont = d3.select(CORE_Class),
  svg = cont.select("svg g");

 var zh = zoomHandler(svg);

 svg
  .call(zh)
  .on("dblclick", null)
  .on("wheel", function() {
   console.log("d");
  });

 var dummyData = simulation.nodes().filter(d => d.dummy);
 console.log("dummyData", dummyData);
 var dummy = svg.selectAll(".dummy").data(dummyData, d => d.id);

 var dummyEnter = dummy
  .enter()
  .append("g")
  .attr("class", "dummy");

 dummyEnter.append("circle")
  .attr("r", d => d.r)
  .attr("marker-end", "url(#end)");

 var dummyMerge = dummyEnter.merge(dummy);

 dummy.exit().remove();

 var link = svg.selectAll(".link")
  .data(simulation.force("link").links(), d => d.source.id + d.target.id);
 // TODO: where are the labels?
 var linkEnter = link
  .enter()
  .append("path")
  .attr("class", "link");

 var linkMerge = linkEnter.merge(link);

 var comp = svg.selectAll(".comp")
   .data(simulation.nodes().filter(d => !d.dummy), d => d.id);

 var compEnter = comp
  .enter()
  .append("g")
  .attr("class", "comp");

 compEnter.append("circle")
  .attr("fill", "white");

 compEnter
  .append("path")
  .attr("fill", "none")
  .attr("class", "label-arc")
  .attr("id", d => "circle" + d.id);

 compEnter
  .append("g")
  .attr("class", "node-cont")
  .each(subGraphEnter);

  var compMerge = compEnter.merge(comp);

  compMerge.selectAll(".node-cont")
    .each(subGraphUpdate)
    .attr("transform", c => "translate(" + [-c.r, -c.r] + ")");

 compMerge.select(".label-arc")
  .transition(1000)
   .attr("d", d => labelArc(d.r + 5));

 compMerge.select("circle")
  .transition(1000)
  .attr("r", d => d.r);
  // .on("click", growComp(simulation));

 var textPathEnter = compEnter
  .append("g")
  .attr("class", "label-cont")
  .append("text")
  // .attr("dy","-10")
  .append("textPath")
  // .style("text-anchor","start") //place the text halfway on the arc
  // .attr("startOffset", "50%")
  .attr("xlink:href", d => "#circle" + d.id);

 textPathEnter.selectAll("tspan")
  .data(d => d.sets)
  .enter()
  .append("tspan")
  .each(styleTspan);

 simulation.on("tick", function() {

  dummyMerge
   .attr("transform", d => {
    return "translate(" + [d.x, d.y] + ")";
   });

  compMerge
   .attr("transform", d => { return "translate(" + [d.x, d.y] + ")"; });

  linkMerge.attr("d", linkPath);

 });

 simulation.on("end", function() {


  d3.select("#zoom-hull").remove();
  var zoomHull = svg
   // .attr("class", "group")
   // .append("path", "circle")
   .insert("path", ":first-child")
   .attr("class", "hull")
   .attr("id", "zoom-hull")
   .attr("d", groupPath(simulation.nodes().filter(d => !d.dummy)))
   .attr("fill", "none");
  // .style("opacity", 0.5)
  // .on("click", function() {programmaticZoom(zh, svg);});
  //
  zoomHull.call(programmaticZoom(zh, svg));

 });

 // console.log("hull", hull, "doc", doc);

}

d3.json("diigo.json", function(error, data) {
 var diigo = data.slice(0, 100).map((d, i) => {
  d.tags = d.tags.split(",");
  d.id = i;
  return d;
 });
 var graph = computeTagGraph(diigo);
 createCoreView(graph);

 // tagList.createCoreView(nodes.nestedTags, d3.select(".tag-list"), foci, updateCoreView);
 // timeCloud.create(nodes.spreadTags, foci, timeCloudDiv, update, tagList);
});
