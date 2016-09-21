"use strict";
require("./style/style.less");

import * as d3 from "d3";
import _ from "lodash";

import colaLayout from "./lib/colaFoci.js";
import computeTagGraph from "./lib/tagGraph.js";
import computeCompGraph from "./lib/componentGraph.js";

import tagListLayout from "./components/tagList.js";
var tagList = tagListLayout();
import marching_squares from "./lib/marchingSquaresHelpers.js";
import {
  innerCircleCollide,
  programmaticZoom,
  programmaticZoomCircle,
  zoomHandler,
  groupPath
} from "./lib/utils.js";
import brewer from "colorbrewer";

const colorScale = d3.scaleOrdinal()
  .range(brewer.Dark2[8]);

const wordScale = d3.scaleLinear();
const circleSize = d3.scaleLinear();
const LABEL_OFFSET = 40;
const DUMMYNODE_SIZE = 5;

var WIDTH = window.innerWidth * 2 / 3 - 20;
var HEIGHT = window.innerHeight;
var DIM = {
  width: WIDTH,
  height: HEIGHT
};

const DOC_WIDTH = 4;
const DOC_HEIGHT = 6;

const CORE_Class = ".core.view";

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

  return "M" + (d.source.x + offsetXS) + "," + (d.source.y + offsetYS) +
    "L" + (d.target.x - offsetXT) + "," + (d.target.y - offsetYT);
}


function labelArc(radius) {
  return d3.arc()
    .innerRadius(0)
    .outerRadius(radius)
    .startAngle(-Math.PI / 3)
    .endAngle(2 * Math.PI)();

}


var hullcurve = d3.line()
  .curve(d3.curveBasisClosed)
  .x(d => d.x)
  .y(d => d.y);

// var bundleLine = d3.line()
//             .x(d => d.x)
//             .y(d => d.y)
//             .curve(d3.curveBundle);


function subGraphEnter(c) {
  var self = d3.select(this);
  self.append("g").attr("class", "bc");
  c.sets.forEach(s => s.isolevel = 0.030);

  self.selectAll(".subLink")
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
}

function subGraphUpdate(zh, svg) {
  return function(c) {
    var self = d3.select(this);
    var bubbleCont = self.select(".bc");

    var link = self.selectAll(".sub-link")
      .style("opacity", d => d.selected ? 1 : 0.1);

    var doc = self.selectAll(".doc");
    var t = 500;

    doc.select("rect")
      .transition(t)
      .attr("width", d => d.width)
      .attr("height", d => d.height)
      .style("opacity", d => d.selected ? 1 : 0.1);

    doc.select("image")
      .transition(t)
      .attr("width", d => d.width + "px")
      .attr("height", d => d.height + "px")
      .style("opacity", d => d.selected ? 1 : 0.1);

    c.subSim = d3.forceSimulation(c.nodes)
      .force("link", d3.forceLink(c.links)
        .strength(0.06)
        .distance(8)
      )
      .force("center", d3.forceCenter(c.r, c.r))
      .force("innerCircle", innerCircleCollide(c.nodes, c.r))
      .force("collide", d3.forceCollide(d => {
        if (!d.selected) return 0;
        return (d.width === DOC_WIDTH) ? d.width * 2 : d.width;
      }).strength(1))
      // .alpha(1)
      .alphaTarget(0.5)
      .alphaMin(0.8);

    c.subSim.on("tick", function() {
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
          .attr("class", "bubble-" + set.key)
          .attr("stroke-linejoin", "round")
          .attr("d", d => hullcurve(d))
          .attr("fill", colorScale(set.key))
          .style("cursor", "pointer")
          .style("opacity", c.selected ? 0.3 : 0.01)
          // .on("click", function() {programmaticZoom(zh, svg);});
          .on("click", () => programmaticZoomCircle(zh, svg, DIM)(c))
          .on("mouseover", function() {
            bubbleCont.selectAll("path").style("opacity", 0.3);
            bubbleCont.selectAll(".bubble-" + set.key).style("opacity", 1);
            console.log("set", set);
            var parent = d3.select(self.node().parentNode);
            var labelCont = parent.select(".label-cont");
            var tspan = labelCont.select("text").select("textPath")
              .selectAll("tspan");
            tspan
              .transition(1000)
              .attr("font-size", d => set.intersetArray.includes(d.key) ? wordScale(d.values.filter(d => d.selected).length) : 0);

          })
          .on("mouseout", function() {
            bubbleCont.selectAll("path").style("opacity", 0.3);
            var parent = d3.select(self.node().parentNode);
            var labelCont = parent.select(".label-cont");

            var tspan = labelCont.select("text").select("textPath")
              .selectAll("tspan");

            tspan
              .transition(1000)
              .attr("font-size", d => wordScale(d.values.filter(d => d.selected).length))
              .text(d => d.key + " •");
          });
        // .on("click", () => bubbleGroupEnter.call(programmaticZoom(0.6)));

        bubble.exit().remove();
        bubbleGroup.exit().remove();

      }, c); // bigger: 0.0048, 0.024 (with updated bubble points)
    });
    //  subSim.on("end", function() {});
  };
}


function createCoreView(graph) {
  console.log("graph", graph);

  wordScale
    .domain(d3.extent(graph.tags, d => d.values.length))
    .rangeRound([7, 150]);

  colorScale
    .domain(graph.tags.map(d => d.id));

  var compGraph = computeCompGraph(graph.nodes, graph.edges, 3);
  compGraph.nodes.forEach(c => {
    c.selected = true;
    c.nodes.forEach(d => {
      d.initW = _.clone(DOC_WIDTH);
      d.initH = _.clone(DOC_HEIGHT);
      d.width = _.clone(DOC_WIDTH);
      d.height = _.clone(DOC_HEIGHT);
      d.selected = true;
    });
    c.sets.forEach(s => s.selected = true);
  });
  // var ext = d3.extent(compGraph.nodes.map(d => d.nodes.length));
  circleSize
    .domain([1, 100])
    .rangeRound([30, 150]);

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

  g.append("rect")
    .attr("width", WIDTH)
    .attr("height", HEIGHT)
    .style("opacity", 0);

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
  //  c.selected = true;
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

  dummyEnter.append("title").text(d => d.interSet ? d.interSet.join(",") : "test");
  console.log("dummyData", dummyEnter.data());
  var dummyMerge = dummyEnter.merge(dummy);

  dummyMerge
    .style("opacity", d => d.src.selected && d.tgt.selected ? 1 : 0.1)
    .on("click", d => {
      d3.select("#part-zoom-hull").remove();
      console.log("mouseover");

      var zoomHull = svg
        .insert("path", ":first-child")
        .attr("class", "hull")
        .attr("id", "part-zoom-hull")
        .attr("d", groupPath([d.src, d.tgt]))
        .attr("fill", "none");

      zoomHull.call(programmaticZoom(zh, svg, DIM));
    })
    .on("mouseover", d => {
      svg.selectAll(".comp")
        .transition(1000)
        .style("opacity", e => e.id === d.src.id || e.id === d.tgt.id ? 1 : 0.1);

      svg.selectAll(".dummy")
        .transition(1000)
        .style("opacity", e => e.id === d.id ? 1 : 0.1);

      svg.selectAll(".link")
        .transition(1000)
        .style("opacity",
          l => l.target.id === d.id || l.source.id === d.id ? 1 : 0.1);

      var srcComp = d3.selectAll("#comp" + d.src.id);
      var tgtComp = d3.selectAll("#comp" + d.tgt.id);

      var labelContSrc = srcComp.select(".label-cont");
      var tspanSrc = labelContSrc.select("text").select("textPath")
        .selectAll("tspan");

      tspanSrc
        .transition(1000)
        .attr("font-size", e => d.interSet.includes(e.key) ? wordScale(e.values.filter(d => d.selected).length) : 0);

      var labelContTgt = tgtComp.select(".label-cont");
      var tspanTgt = labelContTgt.select("text").select("textPath")
        .selectAll("tspan");

      tspanTgt
        .transition(1000)
        .attr("font-size", e => d.interSet.includes(e.key) ? wordScale(e.values.filter(d => d.selected).length) : 0);

      srcComp.select(".bc").selectAll("g")
        .style("opacity", e => d.interSet.includes(e.key) ? 1 : 0.1);
      tgtComp.select(".bc").selectAll("g")
        .style("opacity", e => d.interSet.includes(e.key) ? 1 : 0.1);
      // console.log("gs", srcComp.select(".bc").selectAll("g").data(), d.interSet);
      srcComp.select(".node-cont").selectAll(".doc")
        .style("opacity", e => _.intersection(e.tags, d.interSet).length > 0 ? 1 : 0.1);
      tgtComp.select(".node-cont").selectAll(".doc")
        .style("opacity", e => _.intersection(e.tags, d.interSet).length > 0 ? 1 : 0.1);
    })
    .on("mouseout", (d) => {
      svg.selectAll(".comp")
        .transition(1000)
        .style("opacity", d => d.selected ? 1 : 0.1);
      svg.selectAll(".dummy")
        .transition(1000)
        .style("opacity", 1);

      svg.selectAll(".link")
        .transition(1000)
        .style("opacity", l => {
          var dummy = l.source.dummy ? l.source : l.target;
          return dummy.src.selected && dummy.tgt.selected ? 1 : 0.1;
        });

      var srcComp = d3.selectAll("#comp" + d.src.id);
      var tgtComp = d3.selectAll("#comp" + d.tgt.id);

      var labelCont = srcComp.select(".label-cont");
      var tspan = labelCont.select("text").select("textPath")
        .selectAll("tspan");

      tspan
        .transition(1000)
        .attr("font-size", e => wordScale(e.values.filter(d => d.selected).length));

      var labelContTgt = tgtComp.select(".label-cont");
      var tspanTgt = labelContTgt.select("text").select("textPath")
        .selectAll("tspan");

      tspanTgt
        .transition(1000)
        .attr("font-size", e => wordScale(e.values.filter(d => d.selected).length));

      srcComp.select(".bc").selectAll("g")
        .style("opacity", 1);
      tgtComp.select(".bc").selectAll("g")
        .style("opacity", 1);

      srcComp.select(".node-cont").selectAll(".doc")
        .style("opacity", 1);

      tgtComp.select(".node-cont").selectAll(".doc")
        .style("opacity", 1);
    })
    .select("circle")
    .on("mouseover", () => {
      svg.selectAll(".comp")
        .style("opacity", d => d.selected ? 1 : 0.1);
      svg.selectAll(".dummy")
        .style("opacity", 1);

      svg.selectAll(".link").style("opacity", l => {
        var dummy = l.source.dummy ? l.source : l.target;
        return dummy.src.selected && dummy.tgt.selected ? 1 : 0.1;
      });
    })
    .on("click", programmaticZoomCircle(zh, svg, DIM));

  dummy.exit().remove();

  var link = svg.selectAll(".link")
    .data(simulation.force("link").links(), d => d.source.id + d.target.id);

  var linkEnter = link
    .enter()
    .append("path")
    .attr("class", "link");

  var linkMerge = linkEnter.merge(link);

  linkMerge.style("opacity", l => {
    var dummy = l.source.dummy ? l.source : l.target;
    return dummy.src.selected && dummy.tgt.selected ? 1 : 0.1;
  });

  var comp = svg.selectAll(".comp")
    .data(simulation.nodes().filter(d => !d.dummy), d => d.id);

  var compEnter = comp
    .enter()
    .append("g")
    .attr("class", "comp")
    .attr("id", d => "comp" + d.id);

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
    .each(subGraphUpdate(zh, svg))
    .attr("transform", c => "translate(" + [-c.r, -c.r] + ")");

  compMerge.select(".label-arc")
    .transition(1000)
    .attr("d", d => labelArc(d.r + 5));

  compMerge.select("circle")
    // transition not working here
    // .transition(1000)
    .attr("r", d => d.r)
    .on("click", programmaticZoomCircle(zh, svg, DIM));
  // .style("opacity", d => d.selected ? 1 : 0.1);
  // .on("click", growComp(simulation));

  comp.select("circle")
    .transition(1000)
    .style("opacity", d => d.selected ? 1 : 0.1);

  comp.select(".label-cont").select("text")
    .transition(1000)
    .style("opacity", d => d.selected ? 1 : 0.1);

  var textPathEnter = compEnter
    .append("g")
    .attr("class", "label-cont")
    .append("text")
    // .attr("dy","-10")
    .append("textPath")
    // .style("text-anchor","start") //place the text halfway on the arc
    // .attr("startOffset", "50%")
    .attr("xlink:href", d => "#circle" + d.id);

  console.log("compEnter", textPathEnter.data());
  textPathEnter.selectAll("tspan")
    .data(d => d.sets)
    .enter()
    .append("tspan")
    .attr("class", "tagLabel")
    .attr("font-size", d => wordScale(d.values.length))
    .text(d => d.id + " •");

  comp.filter(c => c.selected).select(".label-cont").selectAll("tspan")
    .transition(1000)
    .attr("font-size", s => s.selected ? wordScale(s.values.filter(d => d.selected).length) : 0);

  simulation.on("tick", function() {
    dummyMerge
      .attr("transform", d => {
        return "translate(" + [d.x, d.y] + ")";
      });

    compMerge
      .attr("transform", d => {
        return "translate(" + [d.x, d.y] + ")";
      });

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
      .attr("d", groupPath(simulation.nodes().filter(c => c.selected)
        .filter(d => !d.dummy)))
      .attr("fill", "none");

    zoomHull.call(programmaticZoom(zh, svg, DIM));

    svg
      .call(zh)
      .on("dblclick", null);
  });
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
