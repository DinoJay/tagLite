"use strict";
import * as d3 from "d3";
import _ from "lodash";

import colaLayout from "./lib/colaFoci.js";
import computeTagGraph from "./lib/tagGraph.js";
import computeCompGraph from "./lib/componentGraph.js";

import tagListLayout from "./components/tagList.js";
var tagList = tagListLayout();
// import tagList from "./tagList.js";
import timeCloudLayout from "./components/tagStream.js";
var timeCloud = timeCloudLayout();

import marching_squares from "./lib/marchingSquaresHelpers.js";
import offsetInterpolate from "./lib/polyOffset.js";

import {innerCircleCollide} from "./lib/utils.js";
import brewer from "colorbrewer";

var wordScale = d3.scaleLinear();
var circleSize = d3.scaleLinear();
var LABEL_OFFSET = 40;
var DUMMYNODE_SIZE = 50;

require("./style/style.less");

const DOC_WIDTH = 4;
const DOC_HEIGHT = 6;

const bubbleScale = d3.scaleLinear()
                          .domain([1, 100])
                          .range([0.035, 0.14]);


const CORE_Class = ".core.view";


function growCompBubble(c, sim) {
 // programmaticZoomCircle(zh, svg)(d);
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

 return "M" + (d.source.x + offsetXS) + "," + (d.source.y + offsetYS) + "L" + (d.target.x - offsetXT) + "," + (d.target.y - offsetYT);
}

function labelArc(innerRadius, outerRadius) {
 return d3.arc()
  .innerRadius(innerRadius)
  .outerRadius(outerRadius)
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
    Math.min(2.5, 1 / Math.max(dx / width, dy / height))),
   translate = [width / 2 - scale * x,
    height / 2 - scale * y
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
    scale = Math.max(-40, Math.min(8, 1 / Math.max(dx / width, dy / height))),
    translate = [width / 2 - scale * x,
     height / 2 - scale * y
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

function plotLabelsLite(compId, sets) {
  // TODO: get the tspan objects of nbs
  var tp = d3.selectAll(".textPath").filter(d => d.id === compId),
   compNode = d3.select(".comp-" + compId).select("textpath");
  var ns = compNode.data()[0];
  sets = ns.sets.filter(n => sets.includes(n.key));
  tp.selectAll("tspan").remove();
  tp.selectAll("tspan")
   .data(sets, d => d.key)
   .enter()
   .append("tspan")
   .call(styleTspan);

  // d3.selectAll(".doc")
  //   .filter(d => compNode.data().nodes.map(e => e.id).includes(d.id))
  //   .style("opacity", 0.01);
 }
 // bigger scale :0.0048
 //
 // const linkOpacity = 0.05;
 // var dbg = d => {
 //   console.log("dbg", d);
 //   return d;
 // };

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

function styleTspan(self) {
 self.attr("class", "tagLabel")
  .attr("font-size", function(d) {
   return wordScale(d.values.length);
  })
  .text(d => d.key + " · ")
  .on("mouseover", function(d) {

   var lc = d3.selectAll(".textPath")
    .filter(e => e.tags.map(d => d.key).includes(d.key));
   // var selComps = lc.data();

   d3.select(this)
    .style("font-weight", "bold");
   // .style("fill", "red");

   d.tmpSel = lc.selectAll("tspan").filter(e => e.key === d.key);
   d.tmpSel
    .style("font-weight", "bold")
    .style("font-size", d => wordScale(d.nodes.length) + 10);
   // .style("fill", "red");

   // selComps.forEach(src => {
   //   selComps.forEach(c => {
   //     var q = ".bundle-link-" + src.id + "-" + c.id;
   //     d3.selectAll(q)
   //       .style("stroke-opacity", 0.2);
   //   });
   // });

  })
  .on("mouseout", function(d) {
   d.tmpSel
    .style("font-weight", null)
    .style("font-size", d => wordScale(d.values.length))
    .style("fill", null);

   // d3.selectAll(".bd")
   //   .style("stroke-opacity", linkOpacity);
  });
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

var scale = 1;
var width = window.innerWidth * scale;
var height = 800 * scale; //window.innerHeight;

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
  c.sets.forEach(c => c.isolevel = 0.035);

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
    docEnter.append("title").text(d => d.title);

 var subSim = d3.forceSimulation(c.nodes)
                .force("link", d3.forceLink(c.links)
                  .strength(0.06)
                  .distance(8)
                )
                .force("center", d3.forceCenter(c.r, c.r))
                .force("innerCircle", innerCircleCollide(c.nodes, c.r, 2))
                .force("collide", d3.forceCollide(d => d.width * 2).strength(1))
                .alphaMin(0.6);


  subSim.on("tick", function() {
  // TODO: fix later

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

  }, c.sets, 4, c.r * 2); // bigger: 0.0048, 0.024 (with updated bubble points)
 });

}

function subGraphUpdate(c) {
  var self = d3.select(this);
  var bubbleCont = self.select(".bc");

  var link = self.selectAll(".sub-link");

  var doc = self.selectAll(".doc");

  doc.select("rect")
    .attr("width", d => d.width)
    .attr("height", d => d.height);

  doc.select("image")
    .attr("width", d => d.width + "px")
    .attr("height", d => d.height + "px");


 if (!c.clicked) return;
 var subSim = d3.forceSimulation(c.nodes)
                .force("link", d3.forceLink(c.links)
                  .strength(0.06)
                  .distance(8)
                )
                .force("center", d3.forceCenter(c.r, c.r))
                .force("innerCircle", innerCircleCollide(c.nodes, c.r, 2))
                .force("collide", d3.forceCollide(d => d.width * 1.5).strength(1))
                .alphaMin(0.6);


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

  }, c.sets, 4, c.r * 2); // bigger: 0.0048, 0.024 (with updated bubble points)
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
   d.width = DOC_WIDTH;
   d.height = DOC_HEIGHT;
  });
 });
 // var ext = d3.extent(compGraph.nodes.map(d => d.nodes.length));
 circleSize = d3.scaleLinear()
  .domain([1, 100])
  .rangeRound([30, 100]);

 compGraph.nodes.forEach(n => n.r = circleSize(n.nodes.length));
 console.log("compGraph", compGraph.nodes);

 var cola = (new colaLayout)
  .size([width, height])
  .offset(LABEL_OFFSET)
  .dummyRad(5)
  .nodes(compGraph.nodes)
  .links(compGraph.edges)
  //[30, 20, 70]
  .iterations([10, 10, 10])
  .start();

 d3.select()
  .style("width", width - 25 + "px")
  .style("height", height - 25 + "px");

 var svg = d3.select(CORE_Class).select("svg");
 var g = svg
  .attr("width", width * scale)
  .attr("height", height * scale)
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

 var defs = svg.append("defs");


 defs.append("marker")
  .attr("id", "end-arrow")
  .attr("viewBox", "0 0 10 10")
  .attr("refX", 4)
  .attr("refY", 5)
  .attr("orient", "auto")
  .append("path")
  .attr("d", "M0,0 L0,10 L10,5 z");

 defs.selectAll("marker")
  .data(["end"]) // Different link/path types can be defined here
  .enter().append("svg:marker") // This section adds in the arrows
  .attr("id", String)
  .attr("viewBox", "0 -5 10 10")
  .attr("refX", 10)
  .attr("refY", 0)
  .attr("markerWidth", 15)
  .attr("markerHeight", 15)
  .attr("orient", "auto")
  .append("svg:path")
  .attr("d", "M0,-5L10,0L0,5")
  .attr("class", "marker");

 var simulation = d3.forceSimulation(cola.nodes())
  .force("link", d3.forceLink(cola.links())
   .strength(0)
   .distance(80)
  )
  // .force("charge", d3_force.forceManyBody()
  //                    .strength(- 2)
  //                    // .distanceMin(9)
  //                    // .distanceMax(200)
  // )
  .force("x", d3.forceX(d => d.pos.x)
   .strength(0.2)
  )
  .force("y", d3.forceY(d => d.pos.y)
   .strength(0.2)
  )
  .force("collide", d3.forceCollide(d => d.r).strength(1))
  .alphaMin(0.3);

 updateCoreView(simulation);
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

 var comp = svg.selectAll(".comp").data(simulation.nodes().filter(d => !d.dummy),
  d => d.id);

 var compEnter = comp
  .enter()
  .append("g")
  .attr("class", "comp");

 compEnter.append("circle")
  .attr("fill", "white");

 var radOffset = 3;
 compEnter
  .append("path")
  .attr("fill", "none")
  .attr("id", d => "circle" + d.id);

 compEnter
  .append("g")
  .attr("class", "node-cont")
  .each(subGraphEnter);

  var compMerge = compEnter.merge(comp);

  compMerge.selectAll(".node-cont")
    .attr("transform", c => "translate(" + [-c.r, -c.r] + ")")
    .each(subGraphUpdate);

 compMerge.select("path").attr("d", d => labelArc(d.r, d.r + radOffset));

 compMerge.select("circle")
  .attr("r", d => d.r)
  .on("click", function(c) {
    c.r *= 2.5;

    c.nodes.forEach(d => {
      d.width *= 3;
      d.height *= 3;
   });

    c.clicked = true;
    c.sets.forEach(c => c.isolevel = 0.007);

   var sim = d3.forceSimulation(simulation.nodes())
    .force("link", d3.forceLink(simulation.force("link").links())
     .strength(0)
     .distance(80)
    )
    // .force("charge", d3_force.forceManyBody()
    //                    .strength(- 2)
    //                    // .distanceMin(9)
    //                    // .distanceMax(200)
    // )
    .force("x", d3.forceX(d => d.pos.x)
     .strength(0.2)
    )
    .force("y", d3.forceY(d => d.pos.y)
     .strength(0.2)
    )
    .force("collide", d3.forceCollide(d => d.r).strength(1))
    .alphaMin(0.3);
    updateCoreView(sim);
  });

 var textPathEnter = compEnter
  .append("g")
  .attr("class", "label-cont")
  .append("text")
  .append("textPath")
  .attr("xlink:href", d => "#circle" + d.id);

 textPathEnter.selectAll("tspan")
  .data(d => d.sets.slice(0, 5))
  .enter()
  .append("tspan")
  .call(styleTspan);

 // var tl = textPath.node().getComputedTextLength();
 // textPath
 //   .attr("textLength", tl);

  // compMerge.select(".node-cont")
  //  .attr("transform", c => "translate(" + [-c.r, -c.r] + ")");

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
  //   var flatLinks = foci._cutEdges.map(l => {
  //                       return {
  //                         source: l.source,
  //                         target: l.target
  //                       };
  //                   });
  //
  // console.log("foci cutEdges", foci._cutEdges);
  //
  //   // var fbundling = edgeBundling()
  //   //                 .step_size(0.1)
  //   //                 .compatibility_threshold(0.35)
  //   //                 .nodes(foci.nodes())
  //   //                 .edges(flatLinks);
  //   //
  //   // var bundledEdgeSegments = fbundling();
  //   var edgeCont = svg.select(".edge-seg");
  //
  //   edgeCont.selectAll(".link")
  //     .data(flatLinks, (d) => d.id)
  //     .enter()
  //     // .append("g")
  //     // .attr("class", "bundle-link-" + src.comp + "-" + tgt.comp + " bd")
  //     .append("line")
  //     .attr("class", "link")
  //     .style("stroke-width", 5)
  //     .style("stroke", "gray")
  //     .style("fill", "none")
  //     .style("stroke-opacity", 0.5) //use opacity as blending;
  //     .attr("x1", d => d.source.x)
  //     .attr("y1", d => d.source.y)
  //     .attr("x2", d => d.target.x)
  //     .attr("y2", d => d.target.y)
  //     // .attr("d", d => bundleLine([{x: d.source.x, y: d.source.y},
  //     //                             {x: d.target.x, y: d.target.y}]))
  //     .on("mouseover", function(){
  //       var segs = d3.select(this);
  //       segs
  //         .attr("opacity", 1);
  //
  //       segs.attr("fill", "red");
  //     });


  // bundledEdgeSegments.forEach((d, i) => {
  // // for each of the arrays in the results
  // // draw a line between the subdivions points for that edge
  //
  //   var src = d[0];
  //   var tgt = d[d.length - 1];
  //   var edgeSegs = edgeCont.selectAll("g")
  //     .data([{source: src.comp, target: tgt.comp, path: d, id: i, focus: tgt.comp}], (d) => d.id)
  //     .enter()
  //     .append("g")
  //     // .attr("class", "bundle-link-" + src.comp + "-" + tgt.comp + " bd")
  //     .append("path")
  //     .attr("class", "bundle-link-" + src.comp + "-" + tgt.comp + " bd")
  //     .style("stroke-width", 5)
  //     .style("stroke", "gray")
  //     .style("fill", "none")
  //     .style("stroke-opacity", 0.5) //use opacity as blending;
  //     .attr("d", d => bundleLine(d.path))
  //     .on("click", function(d) {
  //       console.log("src", src, "tgt", src);
  //       d3.selectAll(".bundle-link-" + d.source + "-" + d.target + " bd")
  //         .attr("opacity", 1);
  //
  //       d.focus = d.focus === d.source ? d.target : d.source;
  //       d3.select("#hull-" + d.focus).call(programmaticZoom(0.6));
  //     })
  //     .on("mouseover", function(d){
  //       var segs = d3.select(this);
  //       console.log("link", src);
  //       segs
  //         .attr("opacity", 1);
  //
  //       segs.attr("fill", "red");
  //     });
  // });


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
 var diigo = data.slice(0, 300).map((d, i) => {
  d.tags = d.tags.split(",");
  d.id = i;
  return d;
 });
 var graph = computeTagGraph(diigo);
 createCoreView(graph);
 // tagList.createCoreView(nodes.nestedTags, d3.select(".tag-list"), foci, updateCoreView);
 // timeCloud.create(nodes.spreadTags, foci, timeCloudDiv, update, tagList);
});
