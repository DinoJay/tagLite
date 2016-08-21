"use strict";
import * as d3 from "d3";
import _ from "lodash";
import fociLayout from "./foci";
import colaLayout from "./colaFoci.js";
import * as d3_force from "d3-force";
import computeTagGraph from "./tagGraph.js";
import computeCompGraph from "./componentGraph.js";
// import computeCompGraph2 from "./componentGraph2.js";

import marching_squares from "./marchingSquaresHelpers.js";
import offsetInterpolate from "./polyOffset.js";

// import edgeBundling from "./edgebundling.js";
import brewer from "colorbrewer";

var wordScale = d3.scaleLinear();

require("./style/style.less");

function zoomHandler(svg) {
  return d3.zoom()
     .extent(function() {
       var bbox = d3.select("#zoom-hull").node().getBoundingClientRect();
       console.log("client rect");
       console.log("bbox", bbox);
       return [[bbox.x, bbox.y], [bbox.x + bbox.width, bbox.y + bbox.height]];
     })
     .scaleExtent([-100, 40])
     .on("zoom", function() {
        var translate = [d3.event.transform.x, d3.event.transform.y];
        var scale = d3.event.transform.k;
        svg
          .transition(1000)
          .attr("transform", "translate(" + translate  + ")scale(" + scale + ")");
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
          height / 2 - scale * y];

      zoomHandler.transform(svg,
        d3.zoomIdentity
        .translate(translate[0], translate[1])
        .scale(scale));
    };
  }

function plotLabels(c, group, i, sets) {
  var tp = d3.selectAll(".textPath").filter(d => d.id === c.id),
      compNode = d3.select(".comp-" +c.id);
  console.log("compNode", compNode);

  tp.selectAll("tspan").remove();
  tp.selectAll("tspan")
              .data(sets, d => d.key)
              .enter()
              .append("tspan")
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
  console.log("compNode", compNode, tp);
  var ns = compNode.data()[0];
  console.log("ns", ns);
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

  return {nested: allTags, spread: spreadNodes};

}

function extractNodes(foci) {
  var docNodes = _.flatten(foci.nodes().filter(d => !d.dummy).map(d => {
    return d.nodes.map(e => {
      e.center = d.center;
      e.width = 3; // bigger 1: 10, 20
      e.height = 4;
      e.clicked = false;
      e.level = d.level;
      // e.tags = e.sets;
      return e;
    });
  }));

  var appliedComps = foci.comps().map(c => {
    c.sets.map(s => {
      s.values = s.values.map(on => {
        return docNodes.find(n => n.id === on.id);
      });
      // if(s.values.length === s.nodes.length) return [];
      return s;
    });
    return c;
  });

  console.log("AppliedComps", appliedComps);

  var tags = extractTags(docNodes);

  return {
    docs: docNodes,
    dummies: foci.nodes().filter(d => d.dummy),
    comps: appliedComps,
    spreadTags: tags.spread,
    nestedTags: tags.nested
  };

}

function styleTspan(self) {
  self.attr("class", "tagLabel")
  .attr("font-size", function(d) {
    return wordScale(d.values.length);
  })
.text(d => d.key+ " · ")
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
      .style("font-size", d => wordScale(d.values.length) + 10);
      // .style("fill", "red");

    // selComps.forEach(src => {
    //   selComps.forEach(c => {
    //     var q = ".bundle-link-" + src.id + "-" + c.id;
    //     d3.selectAll(q)
    //       .style("stroke-opacity", 0.2);
    //   });
    // });

  })
  .on("mouseout", function(d){
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
var height = 800 * scale;//window.innerHeight;

var fill = (i) => d3.schemeCategory10[i];

var groupPath = function(nodes) {
  var fakePoints = [];
  var offset = 5;
  nodes.forEach(function(element) {
    fakePoints = fakePoints.concat([
      // "0.7071" scale the sine and cosine of 45 degree for corner points.
      [(element.x), (element.y + offset)],
      [(element.x + (0.7071 * offset)),
        (element.y + (0.7071 * offset))],
      [(element.x + offset), (element.y)],
             [(element.x + (0.7071 * offset)),
               (element.y - (0.7071 * offset))],
             [(element.x), (element.y - offset)],
             [(element.x - (0.7071 * offset)),
               (element.y - (0.7071 * offset))],
             [(element.x - offset), (element.y)],
             [(element.x - (0.7071 * offset)),
               (element.y + (0.7071 * offset))]
      ]);
  });

  var hull = d3.polygonHull(fakePoints);
  if (hull === null) return null;
  return offsetInterpolate(15)(hull.reverse());
};

function create(diigo) {
  var graph = computeTagGraph(diigo);
  var compGraph = computeCompGraph(graph.nodes, graph.edges, 2);


  var cola = (new colaLayout)
                .size([2000, 2000])
                .nodes(compGraph.nodes)
                .links(compGraph.edges)
                //[30, 20, 70]
                .iterations([30, 20, 33])
                .start();
  console.log("cola nodes", cola.nodes());
  console.log("cola edges", cola.links());

  var foci = fociLayout()
                .nodes(graph.nodes)
                .links(graph.edges)
                .size([width, height])
                .start();
  d3.select(".node-map")
    .style("width", width - 25 + "px")
    .style("height", height - 25 + "px");

  var g = d3.select(".node-map").select("svg")
              .attr("width", width * scale)
              .attr("height", height * scale)
              .append("g")
              .attr("overflow", "hidden");



  var cont = d3.select(".node-map");


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


  d3.select("svg").append("svg:defs").selectAll("marker")
      .data(["end"])      // Different link/path types can be defined here
    .enter().append("svg:marker")    // This section adds in the arrows
      .attr("id", String)
      .attr("viewBox", "0 -5 10 10")
      .attr("refX", 10)
      .attr("refY", 0)
      .attr("markerWidth", 5)
      .attr("markerHeight", 5)
      .attr("orient", "auto")
    .append("svg:path")
      .attr("d", "M0,-5L10,0L0,5")
      .attr("class", "marker");

  update(foci);
}



function update(foci) {

  var cont = d3.select(".node-map"),
  svg = cont.select("svg g"),
  hullLabelCont = d3.select(".hull-labels"),
  // bubbleCont = svg.select(".bubble-cont"),
  backdropCont = svg.select(".backdrop-cont"),
  tooltip = d3.select("#tooltip");

  hullLabelCont.selectAll("*").remove();
  d3.selectAll(".bubble").remove();
  d3.selectAll(".bd").remove();

  var zh = zoomHandler(svg);

  svg
    .call(zh)
    .on("dblclick", null)
    .on("wheel", function() {
      console.log("d");
    });


  var nodes = extractNodes(foci);

  console.log("nodes comps", nodes.comps);

  var simulation = d3.forceSimulation(nodes.docs)
      .force("charge", d3_force.forceManyBody()
                         .strength(- 2)
                         // .distanceMin(9)
                         // .distanceMax(200)
      )
      .force("x", d3_force.forceX(d => d.center.x)
        .strength(0.5)
      )
      .force("y", d3_force.forceY(d => d.center.y)
        .strength(0.5)
      )
      // .force("collide", rectCollide(nodes, 0.6))
      .alphaMin(0.7);


    wordScale
      .domain(d3.extent(nodes.nestedTags, d => d.values.length))
      .rangeRound([7, 60]);

  var labelG = hullLabelCont
      .selectAll("g")
      .data(nodes.comps, d => d.id);

  labelG.exit().remove();
  var labelGEnter = labelG.enter();
  var labelGMerge = labelGEnter.merge(labelG);

  var textPath = labelGEnter
    .append("g")
    .attr("class", d => "comp-"+ d.id)
    .append("text")
    .append("textPath")
      .attr("class", d => "label-cont-" + d.id + " textPath")
      .attr("text-anchor", "start")
      .attr("startOffset", "35%")
      // .attr("alignment-baseline", "text-after-edge")
      // .attr("dominant-baseline", "baseline")
      .attr("id", d => "tp-hull" + d.id)
      .attr("xlink:href", d => "#hull-" + d.id);

  textPath.selectAll("tspan")
    .data(d => d.sets.slice(0, 7))
    .enter()
    .append("tspan")
    .call(styleTspan);

  var hull = labelGEnter
      // .attr("class", "group")
      // .append("path", "circle")
      .insert("path", ":first-child")
      // .attr("transform", function()"rotate(20)")
      .attr("class", "hull")
      .attr("id", d => "hull-" + d.id)
      .style("fill", fill);
      // .on("click", boundzoom)
      // .attr("title", d => d.key);

  labelGMerge.selectAll("path")
    .attr("d", null)
      .on("click", function(d) {
        d.clicked = true;
        // d.isolevel = 0.0120;
        var ids = d.nodes.map(d => d.id);
        var hullNodes = d3.selectAll(".doc")
          .filter(e => ids.indexOf(e.id) !== -1);

        hullNodes.each(function(d) {
          d.width = 20;
          d.height = 40;
          d.clicked = true;
          // d.fixed = true;
        });

        simulation.restart();
        // hullNodes
        // simulation.alphaTarget(0.7);
      });

  // var circle = svg.selectAll(".circle")
  //   .data(foci.data().filter(d => d.cut))
  //   .enter()
  //   .append("circle")
  //     // .attr("transform", d => "translate(" + (-d.width / 2) + "," + (-d.height/ 2) + ")")
  //     .attr("class", "circle")
  //     .attr("r", 7)
  //     .attr("cx", d => d.x)
  //     .attr("cy", d => d.y)
  //     .attr("stroke", "red")
  //     .attr("stroke-width", 2)
  //     .attr("fill",  "none");

  var doc = svg.selectAll(".doc")
    .data(nodes.docs, d => d.id);

  var docEnter = doc
    .enter()
    .append("g")
    .attr("width", d => d.width)
    .attr("height", d => d.height)
    .attr("class", "doc")
    .on("click", function() {programmaticZoom(zh, d3.select(this));})
    .on("mouseover", function(d) {
      console.log("d3 event", d3.event);
      var x = d3.event.clientX + 30;
      var y = d3.event.clientY - 30;
      tooltip
        .style("left", x + "px")
        .style("top", y + "px")
        .style("opacity", 0.7);

      var table = tooltip.append("table").append("tbody");

      var tr0 = table.append("tr");
      tr0.append("td").text("title");
      tr0.append("td").text(d.title);

      var tr1 = table.append("tr");
      tr1.append("td").text("tags");
      tr1.append("td").text(d.tags.join(","));

      var tr2 = table.append("tr");
      tr2.append("td").text("created_at");
      tr2.append("td").text(d.created_at);


      // var allTags = d3.nest()
      //   .key(d => d.key)
      //   .entries(spreadNodes)
      // .sort((a, b) => d3.descending(a.values.length, b.values.length));

    })
    .on("mouseout", function() {
      tooltip.style("opacity", 0);
      tooltip.selectAll("*").remove();
    });

  doc.exit().remove();


  var dummy = svg.selectAll(".dummy")
    .data(nodes.dummies, d => d.__key__);

  var dummyEnter = dummy
    .enter()
    .append("g")
    .attr("class", "dummy")
    .on("mouseover", d => {

      var x = d3.event.clientX + 3;
      var y = d3.event.clientY - 12;
      d3.select("#tag-tooltip")
        .style("left", x + "px")
        .style("top", y + "px")
        .style("display", "block")
        .style("opacity", 0.8)
        .style("visibility", "visible")
        .select(".tipsy-inner")
        .text(d.interSet.join(", "));

        console.log("d", d);
        plotLabelsLite(d.src.comp, d.interSet);
    })
    .on("click", function(d) {
      // console.log("src", d.source, "tgt", d.target);
      // d3.selectAll(".bundle-link-" + d.source + "-" + d.target + " bd")
      //   .attr("opacity", 1);

      console.log("d compId", d);
      d.focus = d.focus === d.src.comp ? d.tgt.comp : d.src.comp;
      var hull = d3.select("#hull-" + d.focus);
      console.log("hull", hull);
      hull.call(programmaticZoom(0.6));

    });


  dummyEnter.append("circle")
    .attr("r", 5)
    .attr("fill", "gray");

  dummyEnter.append("title")
    .text(d => d.interSet.join(", "));

  var dummyMerge = dummyEnter.merge(dummy);
  dummy.exit().remove();
  // var zoomDoc = function(d) {
  //   zoomDetail(d);
  //   var parent = d3.select(this.parentNode);
  //
  //   var rectBox = d3.select(this).node().getBoundingClientRect();
  //
  //   // var thumbForeign = parent
  //   //     .append("foreignObject", ":first-child")
  //   //     .attr("class", "frame-cont");
  //   //       // .attr("transform", null)
  //   //       // .attr("width", d => d.width)
  //   //       // .attr("height", d => d.height);
  //   //
  //   // var thumbnail = thumbForeign.append("xhtml:div")
  //   //       .attr("class", "thumbnail");
  //   //       // .style("width", d => d.width + "px")
  //   //       // .style("height", d => d.height + "px");
  //   //
  //   // thumbnail
  //   //   // .append("foreignObject")
  //   //   // .append("body")
  //   //   // .attr("xmlns", "http://www.w3.org/1999/xhtml")
  //   //   .append("iframe")
  //   //   // .attr("class", "thu")
  //   //   .attr("src", d => d.url)
  //   //   .attr("scrolling", "no")
  //   //   .style("width", rectBox.width * 4 + "px")
  //   //   .style("height", rectBox.height * 4 + "px");
  // };

  docEnter.append("rect")
      .attr("rx", 0.5)
      .attr("ry", 0.5)
      // .attr("stroke", "black")
      // .attr("stroke-width", 0.3)
      .attr("fill",  "white")
      // .attr("opacity",  0)
      .attr("width", d => d.width)
      .attr("height", d => d.height);
      // .on("click", zoomDoc);


  docEnter.append("image")
    .attr("xlink:href", "icon-file.png")
    .attr("width", d => d.width + "px")
    .attr("height", d => d.height + "px");
    // .on("click", zoomDoc);

  // docEnter.append("title")
  //     .text(d => d.__setKey__);

  var docMerge = docEnter.merge(doc);

  simulation.on("end", function() {
    var flatLinks = foci._cutEdges.map(l => {
                        return {
                          source: l.source,
                          target: l.target
                        };
                    });

  console.log("foci cutEdges", foci._cutEdges);

    // var fbundling = edgeBundling()
    //                 .step_size(0.1)
    //                 .compatibility_threshold(0.35)
    //                 .nodes(foci.nodes())
    //                 .edges(flatLinks);
    //
    // var bundledEdgeSegments = fbundling();
    var edgeCont = svg.select(".edge-seg");

    edgeCont.selectAll(".link")
      .data(flatLinks, (d) => d.id)
      .enter()
      // .append("g")
      // .attr("class", "bundle-link-" + src.comp + "-" + tgt.comp + " bd")
      .append("line")
      .attr("class", "link")
      .style("stroke-width", 5)
      .style("stroke", "gray")
      .style("fill", "none")
      .style("stroke-opacity", 0.5) //use opacity as blending;
      .attr("x1", d => d.source.x)
      .attr("y1", d => d.source.y)
      .attr("x2", d => d.target.x)
      .attr("y2", d => d.target.y)
      // .attr("d", d => bundleLine([{x: d.source.x, y: d.source.y},
      //                             {x: d.target.x, y: d.target.y}]))
      .on("mouseover", function(){
        var segs = d3.select(this);
        segs
          .attr("opacity", 1);

        segs.attr("fill", "red");
      });


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

    marching_squares(group => {
      // TODO: hull zoom
      // this happens in a for loop
      var bubbleGroup = backdropCont
         .selectAll(".bubble" + group.key)
         .data([group]);

      var bubbleGroupEnter = bubbleGroup.enter()
        .append("g")
        .attr("class", "bubble" + group.key +  " bubble");

      var bubble = bubbleGroupEnter.selectAll("path")
        .data(d => d.path);

      var bubbleEnter = bubble.enter()
        .append("path");

      var bubbleMerge = bubbleEnter.merge(bubble);

      bubbleMerge
        .attr("class", (_, i) => "bubble-"+ i + group.key + "bubble")
        .attr("stroke-linejoin", "round")
        .attr("d", d => hullcurve(d))
        .attr("fill", "#6699cc")
        .attr("opacity", 0.05)
        .style("cursor", "pointer")
        .on("click", function(){programmaticZoom()(d3.select(this));});

      bubble.exit().remove();
      bubbleGroup.exit().remove();

      // TODO: divide
      }, [{values: foci.nodes()}], 0.003);

    nodes.comps.forEach((c, i) => {

      var compNode = d3.select(".comp-" +c.id);
      marching_squares(group => {
        // TODO: not running right now
        // this happens in a for loop
        var bubbleGroup = compNode
           .selectAll(".bubble" + group.key + i)
           .data([group]);

        var bubbleGroupEnter = bubbleGroup.enter()
          .append("g")
          .attr("class", "bubble" + group.key + i);

        var bubble = bubbleGroupEnter.selectAll("path")
          .data(d => d.path);

        var bubbleEnter = bubble.enter()
          .append("path");

        var bubbleMerge = bubbleEnter.merge(bubble);

        bubbleMerge
          .attr("class", (_, i) => "bubble-"+ i + group.key + "bubble")
          .attr("stroke-linejoin", "round")
          .attr("opacity", 0.5)
          .attr("d", d => hullcurve(d))
          .attr("fill", o(group.key))
          .style("cursor", "pointer")
          .on("click", () => bubbleGroupEnter.call(programmaticZoom(0.6)))
          .on("mouseover", function() {

            d3.select(this).transition(200).attr("opacity", 1);
            // d3.select(this).attr("opacity", 1);
            //
            // var tp = d3.select(".label-cont-" + c.id);
            var sets = c.sets.filter(d => group.interTags.includes(d.key));
            console.log("sets", sets);
            plotLabels(c, group, i, sets);

          })
          .on("mouseout", function() {
            d3.select(this).attr("opacity", 0.5);
            d3.selectAll(".doc").style("opacity", 1);

            compNode.selectAll("g").select("path")
              .style("opacity", 0.5);

            var tp = d3.selectAll(".textPath").filter(d => d.id === c.id);
            tp.selectAll("tspan").remove();
            tp.selectAll("tspan")
                        .data(c.sets, d => d.key)
                        .enter()
                        .append("tspan")
                        .call(styleTspan);
            // var tp = d3.select(".label-cont-" + c.id);
            // tp.selectAll("tspan").remove();
            // tp.selectAll("tspan")
            //   .data(c.sets)
            //   .enter()
            //   .append("tspan")
            //   .call(styleTspan(wordScale));

            d3.select("#tooltip").selectAll("*").remove();
            // tagList.update(tagList._root, foci, create);
          });

        bubble.exit().remove();
        bubbleGroup.exit().remove();

      }, c.sets, 0.024); // bigger: 0.0048, 0.024 (with updated bubble points)
    });

    d3.select("#zoom-hull").remove();
    var zoomHull = svg
        // .attr("class", "group")
        // .append("path", "circle")
        .insert("path", ":first-child")
        .attr("class", "hull")
        .attr("id", "zoom-hull")
        .attr("d", groupPath(nodes.docs))
        .attr("fill", "gray")
        .style("opacity", 0.5)
        .on("click", function() {programmaticZoom()(d3.select(this));});

    zoomHull.call(programmaticZoom(zh, svg));

    });

  // console.log("hull", hull, "doc", doc);
  simulation.on("tick", function() {

    hull.attr("d", d => {
      return !d.dummy ? groupPath(d.nodes) : null;
    });

    docMerge
      .attr("transform", d => {
        return "translate(" + [d.x - d.width / 2, d.y - d.height / 2] + ")";
      });

    dummyMerge
      .attr("transform", d => {
        return "translate(" + [d.x, d.y] + ")";
      });

  });

}

d3.json("diigo.json", function(error, data) {
  var diigo = data.slice(0, 100).map((d, i) => {
    d.tags = d.tags.split(",");
    d.id = i;
    return d;
  });
  create(diigo);
});
